import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MenuItem } from '../menu/entities/menu-item.entity';
import { MenuService } from '../menu/menu.service';
import { AuditLog } from './entities/audit-log.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { TableSession } from './entities/table-session.entity';
import { OrdersGateway } from './orders.gateway';
import { OrdersService } from './orders.service';

// ── Mock factories ────────────────────────────────────────────────────────────

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

function makeSession(overrides: Partial<TableSession> = {}): TableSession {
  const s = new TableSession();
  s.id = 'session-1';
  s.tableId = 'table-1';
  s.openedBy = 'staff-1';
  s.openedAt = new Date();
  s.closedAt = null;
  s.guestCount = null;
  s.isFlagged = false;
  s.flagReason = null;
  s.orders = [];
  return Object.assign(s, overrides);
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const o = new Order();
  o.id = 'order-1';
  o.tableSessionId = 'session-1';
  o.takenBy = 'staff-1';
  o.createdAt = new Date();
  o.status = 'pending';
  o.notes = null;
  o.items = [];
  return Object.assign(o, overrides);
}

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  const i = new OrderItem();
  i.id = 'item-1';
  i.orderId = 'order-1';
  i.menuItemId = 'menu-1';
  i.quantity = 2;
  i.unitPrice = 75;
  i.modifiers = null;
  i.isVoided = false;
  i.voidReason = null;
  i.voidedBy = null;
  i.voidedAt = null;
  i.order = makeOrder();
  return Object.assign(i, overrides);
}

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  const m = new MenuItem();
  m.id = 'menu-1';
  m.name = 'Butlers Breakfast';
  m.price = 75;
  m.isActive = true;
  m.groupId = 'group-1';
  return Object.assign(m, overrides);
}

const mockGateway = {
  emitNewOrder: jest.fn(),
  emitOrderUpdated: jest.fn(),
  emitItemVoided: jest.fn(),
  emitItemServed: jest.fn(),
  emitLowStockAlert: jest.fn(),
};

const mockMenuService = {
  deductStockForSale: jest.fn().mockResolvedValue({
    success: true,
    deductions: [],
    warnings: [],
  }),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;
  let tableRepo: ReturnType<typeof mockRepo>;
  let sessionRepo: ReturnType<typeof mockRepo>;
  let orderRepo: ReturnType<typeof mockRepo>;
  let itemRepo: ReturnType<typeof mockRepo>;
  let menuItemRepo: ReturnType<typeof mockRepo>;
  let auditRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    tableRepo = mockRepo();
    sessionRepo = mockRepo();
    orderRepo = mockRepo();
    itemRepo = mockRepo();
    menuItemRepo = mockRepo();
    auditRepo = mockRepo();

    // Reset gateway mocks between tests
    Object.values(mockGateway).forEach((fn) => fn.mockClear());
    mockMenuService.deductStockForSale.mockResolvedValue({
      success: true,
      deductions: [],
      warnings: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(RestaurantTable), useValue: tableRepo },
        { provide: getRepositoryToken(TableSession), useValue: sessionRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: itemRepo },
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: MenuService, useValue: mockMenuService },
        { provide: OrdersGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  // ── openSession ───────────────────────────────────────────────────────────

  describe('openSession', () => {
    it('should create a new session for an available table', async () => {
      sessionRepo.findOne.mockResolvedValue(null); // no existing open session
      const session = makeSession();
      sessionRepo.create.mockReturnValue(session);
      sessionRepo.save.mockResolvedValue(session);

      const result = await service.openSession({
        tableId: 'table-1',
        openedBy: 'staff-1',
      });

      expect(result.id).toBe('session-1');
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if table already has an open session', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession()); // existing open session

      await expect(
        service.openSession({ tableId: 'table-1', openedBy: 'staff-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── closeSession ──────────────────────────────────────────────────────────

  describe('closeSession', () => {
    it('should close session when all orders are served or cancelled', async () => {
      const order = makeOrder({ status: 'served', items: [] });
      const session = makeSession({ orders: [order] });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((s: TableSession) =>
        Promise.resolve(s),
      );
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      const result = await service.closeSession({
        tableSessionId: 'session-1',
        closedBy: 'staff-1',
      });

      expect(result.closedAt).toBeInstanceOf(Date);
    });

    it('should throw BadRequestException if any order item is still pending or sent', async () => {
      const item = makeOrderItem({ isVoided: false, voidedAt: null });
      const order = makeOrder({ status: 'pending', items: [item] });
      const session = makeSession({ orders: [order] });
      sessionRepo.findOne.mockResolvedValue(session);

      await expect(
        service.closeSession({
          tableSessionId: 'session-1',
          closedBy: 'staff-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set closedAt to current timestamp', async () => {
      const session = makeSession({ orders: [] });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((s: TableSession) =>
        Promise.resolve(s),
      );
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      const before = Date.now();
      const result = await service.closeSession({
        tableSessionId: 'session-1',
        closedBy: 'staff-1',
      });
      const after = Date.now();

      expect(result.closedAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.closedAt!.getTime()).toBeLessThanOrEqual(after);
    });
  });

  // ── createOrder ───────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('should snapshot the current menu item price at time of order', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      const menuItem = makeMenuItem({ price: 75 });
      menuItemRepo.findOne.mockResolvedValue(menuItem);
      const order = makeOrder();
      orderRepo.create.mockReturnValue(order);
      orderRepo.save.mockResolvedValue(order);
      const savedItem = makeOrderItem({ unitPrice: 75 });
      itemRepo.create.mockReturnValue(savedItem);
      itemRepo.save.mockResolvedValue([savedItem]);
      orderRepo.findOne.mockResolvedValue(order);

      await service.createOrder({
        tableSessionId: 'session-1',
        takenBy: 'staff-1',
        items: [{ menuItemId: 'menu-1', quantity: 1 }],
      });

      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ unitPrice: 75 }),
      );
    });

    it('should throw BadRequestException if table session is already closed', async () => {
      sessionRepo.findOne.mockResolvedValue(
        makeSession({ closedAt: new Date() }),
      );

      await expect(
        service.createOrder({
          tableSessionId: 'session-1',
          takenBy: 'staff-1',
          items: [{ menuItemId: 'menu-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create all order items in a single transaction', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      menuItemRepo.findOne.mockResolvedValue(makeMenuItem());
      const order = makeOrder();
      orderRepo.create.mockReturnValue(order);
      orderRepo.save.mockResolvedValue(order);
      const item = makeOrderItem();
      itemRepo.create.mockReturnValue(item);
      itemRepo.save.mockResolvedValue([item]);
      orderRepo.findOne.mockResolvedValue(order);

      await service.createOrder({
        tableSessionId: 'session-1',
        takenBy: 'staff-1',
        items: [
          { menuItemId: 'menu-1', quantity: 1 },
          { menuItemId: 'menu-1', quantity: 2 },
        ],
      });

      // Both items saved in one call
      expect(itemRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── voidOrderItem ─────────────────────────────────────────────────────────

  describe('voidOrderItem', () => {
    it('should set isVoided to true with reason and timestamp', async () => {
      const item = makeOrderItem();
      itemRepo.findOne.mockResolvedValue(item);
      itemRepo.save.mockImplementation((i: OrderItem) => Promise.resolve(i));
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      const result = await service.voidOrderItem({
        orderItemId: 'item-1',
        reason: 'Customer changed mind',
        voidedBy: 'staff-1',
      });

      expect(result.isVoided).toBe(true);
      expect(result.voidReason).toBe('Customer changed mind');
      expect(result.voidedAt).toBeInstanceOf(Date);
    });

    it('should throw BadRequestException if item is already voided', async () => {
      itemRepo.findOne.mockResolvedValue(makeOrderItem({ isVoided: true }));

      await expect(
        service.voidOrderItem({
          orderItemId: 'item-1',
          reason: 'test',
          voidedBy: 'staff-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if item has already been served', async () => {
      const item = makeOrderItem({
        order: makeOrder({ status: 'served' }),
      });
      itemRepo.findOne.mockResolvedValue(item);

      await expect(
        service.voidOrderItem({
          orderItemId: 'item-1',
          reason: 'test',
          voidedBy: 'staff-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create an audit_log entry for every void', async () => {
      const item = makeOrderItem();
      itemRepo.findOne.mockResolvedValue(item);
      itemRepo.save.mockImplementation((i: OrderItem) => Promise.resolve(i));
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.voidOrderItem({
        orderItemId: 'item-1',
        reason: 'Customer changed mind',
        voidedBy: 'staff-1',
      });

      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  // ── markItemServed ────────────────────────────────────────────────────────

  describe('markItemServed', () => {
    function setupServedItem(warnings = false) {
      const item = makeOrderItem();
      item.order = makeOrder({ items: [item] });
      itemRepo.findOne.mockResolvedValue(item);
      itemRepo.save.mockImplementation((i: OrderItem) => Promise.resolve(i));
      orderRepo.update.mockResolvedValue({});

      if (warnings) {
        mockMenuService.deductStockForSale.mockResolvedValue({
          success: true,
          deductions: [],
          warnings: [
            {
              ingredientId: 'ing-1',
              ingredientName: 'Bacon',
              newStock: 0,
              stockStatus: 'out',
            },
          ],
        });
      }
    }

    it('should call deductStockForSale with correct parameters', async () => {
      setupServedItem();

      await service.markItemServed({
        orderItemId: 'item-1',
        servedBy: 'staff-1',
      });

      expect(mockMenuService.deductStockForSale).toHaveBeenCalledWith(
        expect.objectContaining({
          orderItemId: 'item-1',
          menuItemId: 'menu-1',
          quantity: 2,
          performedBy: 'staff-1',
        }),
      );
    });

    it('should set order item status to served', async () => {
      setupServedItem();

      const result = await service.markItemServed({
        orderItemId: 'item-1',
        servedBy: 'staff-1',
      });

      expect(itemRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should update parent order status to served when all items are done', async () => {
      setupServedItem();

      await service.markItemServed({
        orderItemId: 'item-1',
        servedBy: 'staff-1',
      });

      expect(orderRepo.update).toHaveBeenCalledWith('order-1', {
        status: 'served',
      });
    });

    it('should emit low stock alert when deductStockForSale returns warnings', async () => {
      setupServedItem(true);

      await service.markItemServed({
        orderItemId: 'item-1',
        servedBy: 'staff-1',
      });

      expect(mockGateway.emitLowStockAlert).toHaveBeenCalled();
    });

    it('should NOT throw if deductStockForSale returns warnings — sale always completes', async () => {
      setupServedItem(true);

      await expect(
        service.markItemServed({ orderItemId: 'item-1', servedBy: 'staff-1' }),
      ).resolves.not.toThrow();
    });

    it('should NOT throw if stock is insufficient — warning only', async () => {
      setupServedItem();
      mockMenuService.deductStockForSale.mockResolvedValue({
        success: false,
        deductions: [],
        warnings: [
          {
            ingredientId: 'ing-1',
            ingredientName: 'Bacon',
            newStock: -2,
            stockStatus: 'out',
          },
        ],
      });

      await expect(
        service.markItemServed({ orderItemId: 'item-1', servedBy: 'staff-1' }),
      ).resolves.not.toThrow();
    });
  });

  // ── logAudit ──────────────────────────────────────────────────────────────

  describe('logAudit (via voidOrderItem)', () => {
    it('should insert an audit_log record with old and new data', async () => {
      const item = makeOrderItem();
      itemRepo.findOne.mockResolvedValue(item);
      itemRepo.save.mockImplementation((i: OrderItem) => Promise.resolve(i));
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockResolvedValue({});

      await service.voidOrderItem({
        orderItemId: 'item-1',
        reason: 'Wrong item',
        voidedBy: 'staff-1',
      });

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'order_items',
          action: 'UPDATE',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          oldData: expect.objectContaining({ isVoided: false }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          newData: expect.objectContaining({ isVoided: true }),
        }),
      );
    });

    it('should not throw or break the parent transaction if audit insert fails', async () => {
      const item = makeOrderItem();
      itemRepo.findOne.mockResolvedValue(item);
      itemRepo.save.mockImplementation((i: OrderItem) => Promise.resolve(i));
      auditRepo.create.mockReturnValue({});
      auditRepo.save.mockRejectedValue(new Error('DB constraint'));

      const logSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      // Must not throw — audit failure is swallowed
      await expect(
        service.voidOrderItem({
          orderItemId: 'item-1',
          reason: 'Wrong item',
          voidedBy: 'staff-1',
        }),
      ).resolves.not.toThrow();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audit log insert failed'),
      );
      logSpy.mockRestore();
    });
  });
});
