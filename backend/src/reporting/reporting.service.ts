import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import type {
  ChartDataDto,
  DeliveryDto,
  DeliveryItemDto,
  SalesSummaryDto,
  VarianceReportDto,
  VarianceReportRowDto,
} from '@astar-pos/shared';

import { Ingredient } from '../inventory/entities/ingredient.entity';
import { InventoryService } from '../inventory/inventory.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ShiftReport } from '../payments/entities/shift-report.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { Staff } from '../staff/entities/staff.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { SubmitActualCountsDto } from './dto/submit-actual-counts.dto';
import { DeliveryItem } from './entities/delivery-item.entity';
import { Delivery } from './entities/delivery.entity';

// Raw query row shapes — typed to avoid `any`
interface VarianceRow {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  group_name: string;
  consumption_unit: string;
  opening_stock: string;
  stock_received: string;
  expected_consumption: string;
  actual_count: string;
  variance: string;
  variance_type: 'shortage' | 'over' | 'exact';
  current_stock: string;
  low_stock_threshold: string;
}

interface SalesRow {
  group_name: string;
  revenue: string;
  items_sold: string;
}

interface TopItemRow {
  menu_item_id: string;
  menu_item_name: string;
  quantity_sold: string;
  revenue: string;
}

interface StaffSalesRow {
  staff_id: string;
  staff_name: string;
  total_sales: string;
  tables_closed: string;
}

interface HourRow {
  hour: string;
  revenue: string;
  order_count: string;
}

interface ShiftRevenueRow {
  shift_date: string;
  shift: string;
  revenue: string;
}

const SIGNIFICANT_VARIANCE_THRESHOLD = 5;

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(DeliveryItem)
    private readonly deliveryItemRepo: Repository<DeliveryItem>,
    @InjectRepository(ShiftReport)
    private readonly shiftRepo: Repository<ShiftReport>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  // ── VARIANCE REPORTS ─────────────────────────────────────────────────────

  async calculateExpectedConsumption(
    shiftReportId: string,
  ): Promise<Map<string, number>> {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftReportId },
    });
    if (!shift) return new Map();

    // Join order_items → recipes → recipe_items for the shift's date range
    // Exclude voided items
    const rows = await this.dataSource.query<
      { ingredient_id: string; total_consumed: string }[]
    >(
      `
      SELECT
        ri.ingredient_id,
        SUM(oi.quantity * ri.quantity) AS total_consumed
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN transactions tx ON tx.table_session_id = ts.id
      JOIN recipes r ON r.menu_item_id = oi.menu_item_id
      JOIN recipe_items ri ON ri.recipe_id = r.id
      WHERE oi.is_voided = false
        AND tx.paid_at::date = $1
        AND tx.status = 'completed'
      GROUP BY ri.ingredient_id
      `,
      [shift.shiftDate],
    );

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.ingredient_id, parseFloat(row.total_consumed));
    }
    return map;
  }

  async submitActualCounts(
    dto: SubmitActualCountsDto,
  ): Promise<VarianceReportDto> {
    const shift = await this.shiftRepo.findOne({
      where: { id: dto.shiftReportId },
    });
    if (!shift) throw new NotFoundException('Shift report not found');

    const expectedMap = await this.calculateExpectedConsumption(
      dto.shiftReportId,
    );

    // Stock received during this shift date (deliveries)
    const deliveryRows = await this.dataSource.query<
      { ingredient_id: string; total_received: string }[]
    >(
      `
      SELECT di.ingredient_id, SUM(di.quantity_received) AS total_received
      FROM delivery_items di
      JOIN deliveries d ON d.id = di.delivery_id
      WHERE d.delivery_date = $1
      GROUP BY di.ingredient_id
      `,
      [shift.shiftDate],
    );
    const receivedMap = new Map<string, number>();
    for (const row of deliveryRows) {
      receivedMap.set(row.ingredient_id, parseFloat(row.total_received));
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      for (const count of dto.counts) {
        const ingredient = await this.ingredientRepo.findOne({
          where: { id: count.ingredientId },
        });
        if (!ingredient) continue;

        const openingStock = ingredient.currentStock;
        const stockReceived = receivedMap.get(count.ingredientId) ?? 0;
        const expectedConsumption = expectedMap.get(count.ingredientId) ?? 0;

        await qr.manager.query(
          `
          INSERT INTO variance_reports
            (shift_report_id, ingredient_id, opening_stock, stock_received,
             expected_consumption, actual_count, counted_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            dto.shiftReportId,
            count.ingredientId,
            openingStock,
            stockReceived,
            expectedConsumption,
            count.actualCount,
            dto.submittedBy,
          ],
        );
      }

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    return this.getVarianceReport(dto.shiftReportId, 'all');
  }

  async getVarianceReport(
    shiftReportId: string,
    filter: 'all' | 'shortages' | 'overs',
  ): Promise<VarianceReportDto> {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftReportId },
    });
    if (!shift) throw new NotFoundException('Shift report not found');

    const filterClause =
      filter === 'shortages'
        ? "AND vr.variance_type = 'shortage'"
        : filter === 'overs'
          ? "AND vr.variance_type = 'over'"
          : '';

    const rows = await this.dataSource.query<VarianceRow[]>(
      `
      SELECT
        vr.id,
        vr.ingredient_id,
        i.name AS ingredient_name,
        ig.name AS group_name,
        i.consumption_unit,
        vr.opening_stock,
        vr.stock_received,
        vr.expected_consumption,
        vr.actual_count,
        vr.variance,
        vr.variance_type,
        i.current_stock,
        i.low_stock_threshold
      FROM variance_reports vr
      JOIN ingredients i ON i.id = vr.ingredient_id
      JOIN ingredient_groups ig ON ig.id = i.group_id
      WHERE vr.shift_report_id = $1
      ${filterClause}
      ORDER BY ABS(vr.variance) DESC
      `,
      [shiftReportId],
    );

    return this.buildVarianceReportDto(shift, rows);
  }

  async getPrintableVarianceReport(
    shiftReportId: string,
    filter: 'all' | 'shortages' | 'overs',
  ): Promise<VarianceReportDto> {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftReportId },
    });
    if (!shift) throw new NotFoundException('Shift report not found');

    const filterClause =
      filter === 'shortages'
        ? "AND vr.variance_type = 'shortage'"
        : filter === 'overs'
          ? "AND vr.variance_type = 'over'"
          : '';

    const rows = await this.dataSource.query<VarianceRow[]>(
      `
      SELECT
        vr.id,
        vr.ingredient_id,
        i.name AS ingredient_name,
        ig.name AS group_name,
        i.consumption_unit,
        vr.opening_stock,
        vr.stock_received,
        vr.expected_consumption,
        vr.actual_count,
        vr.variance,
        vr.variance_type,
        i.current_stock,
        i.low_stock_threshold
      FROM variance_reports vr
      JOIN ingredients i ON i.id = vr.ingredient_id
      JOIN ingredient_groups ig ON ig.id = i.group_id
      WHERE vr.shift_report_id = $1
      ${filterClause}
      ORDER BY ig.name ASC, i.name ASC
      `,
      [shiftReportId],
    );

    return this.buildVarianceReportDto(shift, rows);
  }

  // ── SALES SUMMARY ────────────────────────────────────────────────────────

  async getSalesSummary(
    startDate: string,
    endDate: string,
  ): Promise<SalesSummaryDto> {
    const period =
      startDate === endDate ? startDate : `${startDate} to ${endDate}`;

    const [totalRow] = await this.dataSource.query<
      { total_revenue: string; total_transactions: string }[]
    >(
      `
      SELECT
        COALESCE(SUM(t.total_amount), 0) AS total_revenue,
        COUNT(t.id) AS total_transactions
      FROM transactions t
      WHERE t.paid_at::date BETWEEN $1 AND $2
        AND t.status = 'completed'
      `,
      [startDate, endDate],
    );

    const [voidRow] = await this.dataSource.query<
      { total_voids: string; void_value: string }[]
    >(
      `
      SELECT
        COUNT(oi.id) AS total_voids,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS void_value
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN transactions tx ON tx.table_session_id = ts.id
      WHERE oi.is_voided = true
        AND tx.paid_at::date BETWEEN $1 AND $2
      `,
      [startDate, endDate],
    );

    const [sessionRow] = await this.dataSource.query<
      { unique_sessions: string }[]
    >(
      `
      SELECT COUNT(DISTINCT ts.id) AS unique_sessions
      FROM table_sessions ts
      JOIN transactions t ON t.table_session_id = ts.id
      WHERE t.paid_at::date BETWEEN $1 AND $2
        AND t.status = 'completed'
      `,
      [startDate, endDate],
    );

    const totalRevenue = parseFloat(totalRow.total_revenue);
    const totalTransactions = parseInt(totalRow.total_transactions, 10);
    const totalVoids = parseInt(voidRow.total_voids, 10);
    const voidValue = parseFloat(voidRow.void_value);
    const uniqueSessions = parseInt(sessionRow.unique_sessions, 10);
    const averageTableSpend =
      uniqueSessions > 0 ? totalRevenue / uniqueSessions : 0;

    const groupRows = await this.dataSource.query<SalesRow[]>(
      `
      SELECT
        mg.name AS group_name,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
        COALESCE(SUM(oi.quantity), 0) AS items_sold
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN menu_groups mg ON mg.id = mi.group_id
      JOIN orders o ON o.id = oi.order_id
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN transactions tx ON tx.table_session_id = ts.id
      WHERE oi.is_voided = false
        AND tx.paid_at::date BETWEEN $1 AND $2
        AND tx.status = 'completed'
      GROUP BY mg.name
      ORDER BY revenue DESC
      `,
      [startDate, endDate],
    );

    const topItemRows = await this.dataSource.query<TopItemRow[]>(
      `
      SELECT
        mi.id AS menu_item_id,
        mi.name AS menu_item_name,
        SUM(oi.quantity) AS quantity_sold,
        SUM(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN transactions tx ON tx.table_session_id = ts.id
      WHERE oi.is_voided = false
        AND tx.paid_at::date BETWEEN $1 AND $2
        AND tx.status = 'completed'
      GROUP BY mi.id, mi.name
      ORDER BY quantity_sold DESC
      LIMIT 10
      `,
      [startDate, endDate],
    );

    const staffRows = await this.dataSource.query<StaffSalesRow[]>(
      `
      SELECT
        s.id AS staff_id,
        s.full_name AS staff_name,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_sales,
        COUNT(DISTINCT ts.id) AS tables_closed
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN staff s ON s.id = o.taken_by
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN transactions tx ON tx.table_session_id = ts.id
      WHERE oi.is_voided = false
        AND tx.paid_at::date BETWEEN $1 AND $2
        AND tx.status = 'completed'
      GROUP BY s.id, s.full_name
      ORDER BY total_sales DESC
      `,
      [startDate, endDate],
    );

    const hourRows = await this.dataSource.query<HourRow[]>(
      `
      SELECT
        EXTRACT(HOUR FROM tx.paid_at)::int AS hour,
        COALESCE(SUM(tx.total_amount), 0) AS revenue,
        COUNT(tx.id) AS order_count
      FROM transactions tx
      WHERE tx.paid_at::date BETWEEN $1 AND $2
        AND tx.status = 'completed'
      GROUP BY hour
      ORDER BY hour ASC
      `,
      [startDate, endDate],
    );

    const byGroup = groupRows.map((r) => ({
      groupName: r.group_name,
      revenue: parseFloat(r.revenue),
      itemsSold: parseInt(r.items_sold, 10),
      percentage:
        totalRevenue > 0 ? (parseFloat(r.revenue) / totalRevenue) * 100 : 0,
    }));

    return {
      period,
      totalRevenue,
      totalTransactions,
      totalVoids,
      voidValue,
      averageTableSpend,
      byGroup,
      topItems: topItemRows.map((r) => ({
        menuItemId: r.menu_item_id,
        menuItemName: r.menu_item_name,
        quantitySold: parseInt(r.quantity_sold, 10),
        revenue: parseFloat(r.revenue),
      })),
      byStaff: staffRows.map((r) => ({
        staffId: r.staff_id,
        staffName: r.staff_name,
        totalSales: parseFloat(r.total_sales),
        tablesClosed: parseInt(r.tables_closed, 10),
      })),
      byHour: hourRows.map((r) => ({
        hour: parseInt(r.hour, 10),
        revenue: parseFloat(r.revenue),
        orderCount: parseInt(r.order_count, 10),
      })),
    };
  }

  getDailySummary(date: string): Promise<SalesSummaryDto> {
    return this.getSalesSummary(date, date);
  }

  // ── CHART DATA ───────────────────────────────────────────────────────────

  async getChartData(days = 7): Promise<ChartDataDto> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const topVarianceRows = await this.dataSource.query<
      { ingredient_name: string; variance: string; variance_type: string }[]
    >(
      `
      SELECT
        i.name AS ingredient_name,
        vr.variance,
        vr.variance_type
      FROM variance_reports vr
      JOIN ingredients i ON i.id = vr.ingredient_id
      JOIN shift_reports sr ON sr.id = vr.shift_report_id
      WHERE sr.shift_date BETWEEN $1 AND $2
        AND vr.variance_type != 'exact'
      ORDER BY ABS(vr.variance) DESC
      LIMIT 10
      `,
      [sinceDate, today],
    );

    const topSellingRows = await this.dataSource.query<TopItemRow[]>(
      `
      SELECT
        mi.id AS menu_item_id,
        mi.name AS menu_item_name,
        SUM(oi.quantity) AS quantity_sold,
        SUM(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      JOIN table_sessions ts ON ts.id = o.table_session_id
      JOIN transactions tx ON tx.table_session_id = ts.id
      WHERE oi.is_voided = false
        AND tx.paid_at::date BETWEEN $1 AND $2
        AND tx.status = 'completed'
      GROUP BY mi.id, mi.name
      ORDER BY quantity_sold DESC
      LIMIT 10
      `,
      [sinceDate, today],
    );

    const shiftRevenueRows = await this.dataSource.query<ShiftRevenueRow[]>(
      `
      SELECT
        sr.shift_date,
        sr.shift,
        COALESCE(SUM(t.total_amount), 0) AS revenue
      FROM shift_reports sr
      LEFT JOIN transactions t
        ON t.paid_at::date = sr.shift_date
        AND t.status = 'completed'
      WHERE sr.shift_date BETWEEN $1 AND $2
      GROUP BY sr.shift_date, sr.shift
      ORDER BY sr.shift_date ASC
      `,
      [sinceDate, today],
    );

    // Pivot morning/evening per date
    const revenueMap = new Map<string, { morning: number; evening: number }>();
    for (const row of shiftRevenueRows) {
      const entry = revenueMap.get(row.shift_date) ?? {
        morning: 0,
        evening: 0,
      };
      if (row.shift === 'morning') entry.morning = parseFloat(row.revenue);
      else entry.evening = parseFloat(row.revenue);
      revenueMap.set(row.shift_date, entry);
    }

    const ingredients = await this.ingredientRepo.find({
      where: { isActive: true },
    });
    const stockLevelSummary = { ok: 0, low: 0, out: 0 };
    for (const ing of ingredients) {
      stockLevelSummary[ing.stockStatus]++;
    }

    return {
      topVariances: topVarianceRows.map((r) => ({
        ingredientName: r.ingredient_name,
        variance: parseFloat(r.variance),
        varianceType: r.variance_type as 'shortage' | 'over',
      })),
      topSellingItems: topSellingRows.map((r) => ({
        menuItemName: r.menu_item_name,
        quantitySold: parseInt(r.quantity_sold, 10),
        revenue: parseFloat(r.revenue),
      })),
      revenueByShift: Array.from(revenueMap.entries()).map(([date, v]) => ({
        date,
        morning: v.morning,
        evening: v.evening,
      })),
      stockLevelSummary,
    };
  }

  // ── DELIVERIES ───────────────────────────────────────────────────────────

  async recordDelivery(dto: CreateDeliveryDto): Promise<DeliveryDto> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const delivery = qr.manager.create(Delivery, {
        supplierName: dto.supplierName,
        deliveryDate: dto.deliveryDate,
        recordedBy: dto.recordedBy,
        invoiceReference: dto.invoiceReference ?? null,
        notes: null,
        status: 'pending',
      });
      const savedDelivery = await qr.manager.save(Delivery, delivery);

      for (const item of dto.items) {
        const ingredient = await this.ingredientRepo.findOne({
          where: { id: item.ingredientId },
        });
        if (!ingredient) continue;

        const deliveryItem = qr.manager.create(DeliveryItem, {
          deliveryId: savedDelivery.id,
          ingredientId: item.ingredientId,
          quantityOrdered: item.quantityOrdered ?? null,
          quantityReceived: item.quantityReceived,
          costPerUnit: item.costPerUnit ?? null,
        });
        await qr.manager.save(DeliveryItem, deliveryItem);

        // Convert purchase units → consumption units before adjusting stock
        const consumptionQty =
          item.quantityReceived * ingredient.unitsPerPurchase;
        await this.inventoryService.adjustStock({
          ingredientId: item.ingredientId,
          quantityChange: consumptionQty,
          reason: `Delivery from ${dto.supplierName} (ref: ${dto.invoiceReference ?? 'none'})`,
          performedBy: dto.recordedBy,
        });
      }

      await qr.commitTransaction();

      return this.getDeliveryById(savedDelivery.id);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async getDeliveries(
    startDate?: string,
    endDate?: string,
  ): Promise<DeliveryDto[]> {
    let query = this.deliveryRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.items', 'items')
      .leftJoinAndSelect('items.ingredient', 'ingredient')
      .orderBy('d.delivery_date', 'DESC');

    if (startDate)
      query = query.andWhere('d.delivery_date >= :startDate', { startDate });
    if (endDate)
      query = query.andWhere('d.delivery_date <= :endDate', { endDate });

    const deliveries = await query.getMany();
    return deliveries.map((d) => this.deliveryToDto(d));
  }

  async getDeliveryById(id: string): Promise<DeliveryDto> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id },
      relations: { items: { ingredient: true } },
    });
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);
    return this.deliveryToDto(delivery);
  }

  async verifyDelivery(id: string, verifiedBy: string): Promise<DeliveryDto> {
    const delivery = await this.deliveryRepo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);

    delivery.status = 'verified';
    await this.deliveryRepo.save(delivery);

    this.logAudit(
      'deliveries',
      id,
      'UPDATE',
      { status: 'pending' },
      { status: 'verified', verifiedBy },
    );

    return this.getDeliveryById(id);
  }

  async disputeDelivery(
    id: string,
    reason: string,
    disputedBy: string,
  ): Promise<DeliveryDto> {
    const delivery = await this.deliveryRepo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException(`Delivery ${id} not found`);

    delivery.status = 'disputed';
    await this.deliveryRepo.save(delivery);

    this.logAudit(
      'deliveries',
      id,
      'UPDATE',
      { status: delivery.status },
      { status: 'disputed', reason, disputedBy },
    );

    return this.getDeliveryById(id);
  }

  async getDeliveryDiscrepancies(
    startDate?: string,
    endDate?: string,
  ): Promise<DeliveryItemDto[]> {
    let query = this.deliveryItemRepo
      .createQueryBuilder('di')
      .leftJoinAndSelect('di.ingredient', 'ingredient')
      .where('di.discrepancy != 0')
      .orderBy('ABS(di.discrepancy)', 'DESC');

    if (startDate || endDate) {
      query = query.leftJoin('di.delivery', 'delivery');
      if (startDate)
        query = query.andWhere('delivery.delivery_date >= :startDate', {
          startDate,
        });
      if (endDate)
        query = query.andWhere('delivery.delivery_date <= :endDate', {
          endDate,
        });
    }

    const items = await query.getMany();
    return items.map((i) => this.deliveryItemToDto(i));
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildVarianceReportDto(
    shift: ShiftReport,
    rows: VarianceRow[],
  ): VarianceReportDto {
    const mappedRows: VarianceReportRowDto[] = rows.map((r) => {
      const currentStock = parseFloat(r.current_stock);
      const lowStockThreshold = parseFloat(r.low_stock_threshold);
      const stockStatus: 'ok' | 'low' | 'out' =
        currentStock === 0
          ? 'out'
          : currentStock <= lowStockThreshold
            ? 'low'
            : 'ok';

      return {
        ingredientId: r.ingredient_id,
        ingredientName: r.ingredient_name,
        ingredientGroup: r.group_name,
        consumptionUnit: r.consumption_unit,
        openingStock: parseFloat(r.opening_stock),
        stockReceived: parseFloat(r.stock_received),
        expectedConsumption: parseFloat(r.expected_consumption),
        actualCount: parseFloat(r.actual_count),
        variance: parseFloat(r.variance),
        varianceType: r.variance_type,
        stockStatus,
      };
    });

    const totalShortages = mappedRows.filter(
      (r) => r.varianceType === 'shortage',
    ).length;
    const totalOvers = mappedRows.filter(
      (r) => r.varianceType === 'over',
    ).length;
    const significantShortages = mappedRows.filter(
      (r) =>
        r.varianceType === 'shortage' &&
        Math.abs(r.variance) > SIGNIFICANT_VARIANCE_THRESHOLD,
    ).length;

    return {
      id: `${shift.id}-report`,
      shiftReportId: shift.id,
      shiftDate: shift.shiftDate,
      shift: shift.shift,
      rows: mappedRows,
      totalShortages,
      totalOvers,
      significantShortages,
      generatedAt: new Date().toISOString(),
    };
  }

  private deliveryToDto(d: Delivery): DeliveryDto {
    const items = (d.items ?? []).map((i) => this.deliveryItemToDto(i));
    return {
      id: d.id,
      supplierName: d.supplierName,
      deliveryDate: d.deliveryDate,
      recordedBy: d.recordedBy,
      invoiceReference: d.invoiceReference,
      status: d.status,
      items,
      totalDiscrepancyItems: items.filter((i) => i.discrepancy !== 0).length,
    };
  }

  private deliveryItemToDto(i: DeliveryItem): DeliveryItemDto {
    return {
      id: i.id,
      ingredientId: i.ingredientId,
      ingredientName: i.ingredient?.name ?? '',
      purchaseUnit: i.ingredient?.purchaseUnit ?? '',
      quantityOrdered: i.quantityOrdered,
      quantityReceived: i.quantityReceived,
      discrepancy: i.discrepancy,
      costPerUnit: i.costPerUnit,
    };
  }

  private logAudit(
    tableName: string,
    recordId: string,
    action: string,
    oldData: object,
    newData: object,
  ): void {
    this.dataSource
      .query(
        `INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tableName,
          recordId,
          action,
          JSON.stringify(oldData),
          JSON.stringify(newData),
        ],
      )
      .catch((err: unknown) => {
        this.logger.error('Audit log failed', err);
      });
  }
}
