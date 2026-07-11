import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type {
  LowStockAlertDto,
  OrderDto,
  OrderItemDto,
  OrderStatus,
  TableDto,
  TableSessionDto,
} from '@astar-pos/shared';
import { MenuService } from '../menu/menu.service';
import { MenuItem } from '../menu/entities/menu-item.entity';
import {
  AddItemsToOrderDto,
  CloseTableSessionDto,
  MarkItemServedDto,
  VoidOrderItemDto,
} from './dto/orders-actions.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { OpenTableSessionDto } from './dto/open-table-session.dto';
import { AuditLog } from './entities/audit-log.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { TableSession } from './entities/table-session.entity';
import { OrdersGateway } from './orders.gateway';

const MAX_SESSION_HOURS = 4;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(RestaurantTable)
    private readonly tableRepo: Repository<RestaurantTable>,
    @InjectRepository(TableSession)
    private readonly sessionRepo: Repository<TableSession>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly menuService: MenuService,
    private readonly gateway: OrdersGateway,
  ) {}

  // ── Tables ───────────────────────────────────────────────────────────────

  async createTable(dto: CreateTableDto): Promise<RestaurantTable> {
    const table = this.tableRepo.create({
      tableNumber: dto.tableNumber,
      capacity: dto.capacity,
      location: dto.location ?? null,
    });
    return this.tableRepo.save(table);
  }

  async findAllTables(): Promise<TableDto[]> {
    const tables = await this.tableRepo.find({ where: { isActive: true } });
    const openSessions = await this.sessionRepo.find({
      where: { closedAt: IsNull() },
      relations: { table: true },
    });

    return tables.map((t) => {
      const session = openSessions.find((s) => s.tableId === t.id) ?? null;
      return this.tableToDto(t, session);
    });
  }

  async findTableById(id: string): Promise<TableDto> {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException(`Table ${id} not found`);
    const session = await this.sessionRepo.findOne({
      where: { tableId: id, closedAt: IsNull() },
    });
    return this.tableToDto(table, session ?? null);
  }

  // ── Table Sessions ───────────────────────────────────────────────────────

  async openSession(dto: OpenTableSessionDto): Promise<TableSession> {
    const existing = await this.sessionRepo.findOne({
      where: { tableId: dto.tableId, closedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException(`Table already has an open session`);
    }
    const session = this.sessionRepo.create({
      tableId: dto.tableId,
      openedBy: dto.openedBy,
      guestCount: dto.guestCount ?? null,
      closedAt: null,
      isFlagged: false,
      flagReason: null,
    });
    return this.sessionRepo.save(session);
  }

  async closeSession(dto: CloseTableSessionDto): Promise<TableSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: dto.tableSessionId, closedAt: IsNull() },
      relations: { orders: { items: true } },
    });
    if (!session)
      throw new NotFoundException(`Session not found or already closed`);

    // Block close if any order has unserved, non-voided items
    for (const order of session.orders) {
      const hasUnserved = order.items.some(
        (i) =>
          !i.isVoided &&
          i.voidedAt === null &&
          order.status !== 'served' &&
          order.status !== 'cancelled',
      );
      if (hasUnserved) {
        throw new BadRequestException(
          `Cannot close table: order ${order.id} has unserved items`,
        );
      }
    }

    const oldData = { closedAt: session.closedAt };
    session.closedAt = new Date();
    const saved = await this.sessionRepo.save(session);

    await this.logAudit({
      tableName: 'table_sessions',
      recordId: session.id,
      action: 'UPDATE',
      oldData,
      newData: { closedAt: saved.closedAt },
      performedBy: dto.closedBy,
    });

    return saved;
  }

  async getSessionById(id: string): Promise<TableSessionDto> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: {
        table: true,
        openedByStaff: true,
        orders: { items: { menuItem: true }, takenByStaff: true },
      },
    });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return this.sessionToDto(session);
  }

  async getFlaggedSessions(): Promise<TableSessionDto[]> {
    const sessions = await this.sessionRepo.find({
      where: { closedAt: IsNull() },
      relations: {
        table: true,
        openedByStaff: true,
        orders: { items: { menuItem: true }, takenByStaff: true },
      },
    });

    const now = Date.now();
    const maxMs = MAX_SESSION_HOURS * 60 * 60 * 1000;

    return sessions
      .filter((s) => s.isFlagged || now - s.openedAt.getTime() > maxMs)
      .map((s) => this.sessionToDto(s));
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  async createOrder(dto: CreateOrderDto): Promise<OrderDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: dto.tableSessionId },
    });
    if (!session || session.closedAt !== null) {
      throw new BadRequestException(`Table session is closed or not found`);
    }

    // Load menu items and snapshot prices — all in one transaction
    const menuItems = await Promise.all(
      dto.items.map((i) =>
        this.menuItemRepo.findOne({ where: { id: i.menuItemId } }),
      ),
    );

    for (let idx = 0; idx < menuItems.length; idx++) {
      if (!menuItems[idx]) {
        throw new NotFoundException(
          `MenuItem ${dto.items[idx].menuItemId} not found`,
        );
      }
    }

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        tableSessionId: dto.tableSessionId,
        takenBy: dto.takenBy,
        notes: dto.notes ?? null,
        status: 'pending' as OrderStatus,
      }),
    );

    const orderItems = dto.items.map((i, idx) =>
      this.itemRepo.create({
        orderId: order.id,
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        unitPrice: menuItems[idx]!.price, // snapshot
        modifiers: i.modifiers ? JSON.stringify(i.modifiers) : null,
        isVoided: false,
        voidReason: null,
        voidedBy: null,
        voidedAt: null,
      }),
    );
    const savedItems = await this.itemRepo.save(orderItems);

    const fullOrder = await this.loadOrderDto(
      order.id,
      savedItems,
      menuItems as MenuItem[],
    );
    this.gateway.emitNewOrder(fullOrder);
    return fullOrder;
  }

  async addItemsToOrder(dto: AddItemsToOrderDto): Promise<OrderDto> {
    const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    const menuItems = await Promise.all(
      dto.items.map((i) =>
        this.menuItemRepo.findOne({ where: { id: i.menuItemId } }),
      ),
    );

    const newItems = dto.items.map((i, idx) =>
      this.itemRepo.create({
        orderId: order.id,
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        unitPrice: menuItems[idx]!.price,
        modifiers: i.modifiers ? JSON.stringify(i.modifiers) : null,
        isVoided: false,
        voidReason: null,
        voidedBy: null,
        voidedAt: null,
      }),
    );
    const savedItems = await this.itemRepo.save(newItems);

    const fullOrder = await this.loadOrderDto(
      order.id,
      savedItems,
      menuItems as MenuItem[],
    );
    this.gateway.emitOrderUpdated(fullOrder);
    return fullOrder;
  }

  async voidOrderItem(dto: VoidOrderItemDto): Promise<OrderItem> {
    const item = await this.itemRepo.findOne({
      where: { id: dto.orderItemId },
      relations: { order: true },
    });
    if (!item)
      throw new NotFoundException(`OrderItem ${dto.orderItemId} not found`);
    if (item.isVoided) throw new BadRequestException(`Item is already voided`);
    if (item.order.status === 'served') {
      throw new BadRequestException(`Cannot void a served item`);
    }

    const oldData = { isVoided: item.isVoided, voidReason: item.voidReason };

    item.isVoided = true;
    item.voidReason = dto.reason;
    item.voidedBy = dto.voidedBy;
    item.voidedAt = new Date();
    const saved = await this.itemRepo.save(item);

    await this.logAudit({
      tableName: 'order_items',
      recordId: item.id,
      action: 'UPDATE',
      oldData,
      newData: { isVoided: true, voidReason: dto.reason },
      performedBy: dto.voidedBy,
    });

    this.gateway.emitItemVoided(this.itemToDto(saved));
    return saved;
  }

  async markItemServed(dto: MarkItemServedDto): Promise<OrderItem> {
    const item = await this.itemRepo.findOne({
      where: { id: dto.orderItemId },
      relations: { order: { items: true }, menuItem: true },
    });
    if (!item)
      throw new NotFoundException(`OrderItem ${dto.orderItemId} not found`);

    item.voidedAt = null; // clear any stale value — status tracked via order
    const saved = await this.itemRepo.save(item);

    // STOCK DEDUCTION TRIGGER — never throws by design
    const deductResult = await this.menuService.deductStockForSale({
      orderItemId: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      performedBy: dto.servedBy,
    });

    if (deductResult.warnings.length > 0) {
      for (const w of deductResult.warnings) {
        const alert: LowStockAlertDto = {
          ingredientId: w.ingredientId,
          ingredientName: w.ingredientName,
          currentStock: w.newStock,
          lowStockThreshold: 0,
          consumptionUnit: '',
          stockStatus: w.stockStatus,
        };
        this.gateway.emitLowStockAlert(alert);
      }
    }

    // Check if all items in the parent order are served or voided
    const allDone = item.order.items.every(
      (i) => i.isVoided || i.id === item.id || i.voidedAt !== null,
    );
    if (allDone) {
      await this.orderRepo.update(item.orderId, { status: 'served' });
    }

    this.gateway.emitItemServed(this.itemToDto(saved));
    return saved;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    _updatedBy: string,
  ): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    order.status = status;
    return this.orderRepo.save(order);
  }

  // ── Audit Log ────────────────────────────────────────────────────────────

  private async logAudit(params: {
    tableName: string;
    recordId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    oldData?: object;
    newData?: object;
    performedBy?: string;
  }): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        tableName: params.tableName,
        recordId: params.recordId,
        action: params.action,
        oldData: params.oldData ?? null,
        newData: params.newData ?? null,
        performedBy: params.performedBy ?? null,
        ipAddress: null,
      });
      await this.auditRepo.save(entry);
    } catch (err) {
      // Audit failure must never break a business transaction
      this.logger.error(`Audit log insert failed: ${String(err)}`);
    }
  }

  // ── Mappers ──────────────────────────────────────────────────────────────

  private tableToDto(
    table: RestaurantTable,
    session: TableSession | null,
  ): TableDto {
    return {
      id: table.id,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      location: table.location,
      isActive: table.isActive,
      currentSession: session ? this.sessionToDto(session) : null,
    };
  }

  private sessionToDto(session: TableSession): TableSessionDto {
    return {
      id: session.id,
      tableId: session.tableId,
      tableNumber: session.table?.tableNumber ?? '',
      openedBy: session.openedBy,
      openedByName: session.openedByStaff?.fullName ?? '',
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
      guestCount: session.guestCount,
      isFlagged: session.isFlagged,
      flagReason: session.flagReason,
      orders: (session.orders ?? []).map((o) => this.orderToDto(o)),
      totalAmount: session.totalAmount,
      isOpen: session.isOpen,
    };
  }

  private orderToDto(order: Order): OrderDto {
    return {
      id: order.id,
      tableSessionId: order.tableSessionId,
      takenBy: order.takenBy,
      takenByName: order.takenByStaff?.fullName ?? '',
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      notes: order.notes,
      items: (order.items ?? []).map((i) => this.itemToDto(i)),
      subtotal: order.subtotal,
    };
  }

  private itemToDto(item: OrderItem): OrderItemDto {
    return {
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItem?.name ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      modifiers: item.parsedModifiers,
      status: item.isVoided ? 'voided' : 'pending',
      isVoided: item.isVoided,
      voidReason: item.voidReason,
      voidedBy: item.voidedBy,
      voidedAt: item.voidedAt?.toISOString() ?? null,
    };
  }

  private async loadOrderDto(
    orderId: string,
    items: OrderItem[],
    menuItems: MenuItem[],
  ): Promise<OrderDto> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const mappedItems: OrderItemDto[] = items.map((item, idx) => ({
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      menuItemName: menuItems[idx]?.name ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
      modifiers: item.parsedModifiers,
      status: 'pending',
      isVoided: false,
      voidReason: null,
      voidedBy: null,
      voidedAt: null,
    }));

    return {
      id: order.id,
      tableSessionId: order.tableSessionId,
      takenBy: order.takenBy,
      takenByName: '',
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      notes: order.notes,
      items: mappedItems,
      subtotal: mappedItems.reduce((s, i) => s + i.lineTotal, 0),
    };
  }
}
