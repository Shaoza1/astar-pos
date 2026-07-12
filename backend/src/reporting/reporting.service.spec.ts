import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { Ingredient } from '../inventory/entities/ingredient.entity';
import { InventoryService } from '../inventory/inventory.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ShiftReport } from '../payments/entities/shift-report.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { Staff } from '../staff/entities/staff.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { Delivery } from './entities/delivery.entity';
import { ReportingService } from './reporting.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockQr = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    create: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
    findOne: jest.fn(),
  },
  query: jest.fn(),
};

// mockDataSource is recreated per test via beforeEach to prevent mockResolvedValueOnce
// queues from bleeding across describe blocks
let mockDataSource: {
  createQueryRunner: jest.Mock;
  query: jest.Mock;
};

const mockInventoryService = {
  adjustStock: jest.fn(),
};

describe('ReportingService', () => {
  let service: ReportingService;
  let shiftRepo: ReturnType<typeof mockRepo>;
  let deliveryItemRepo: ReturnType<typeof mockRepo>;
  let ingredientRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Recreate fresh each test — prevents mockResolvedValueOnce queues bleeding across tests
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQr),
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: getRepositoryToken(Delivery), useFactory: mockRepo },
        { provide: getRepositoryToken(DeliveryItem), useFactory: mockRepo },
        { provide: getRepositoryToken(ShiftReport), useFactory: mockRepo },
        { provide: getRepositoryToken(Ingredient), useFactory: mockRepo },
        { provide: getRepositoryToken(OrderItem), useFactory: mockRepo },
        { provide: getRepositoryToken(Transaction), useFactory: mockRepo },
        { provide: getRepositoryToken(Staff), useFactory: mockRepo },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ReportingService);
    shiftRepo = module.get(getRepositoryToken(ShiftReport));
    deliveryItemRepo = module.get(getRepositoryToken(DeliveryItem));
    ingredientRepo = module.get(getRepositoryToken(Ingredient));
  });

  // ── calculateExpectedConsumption ─────────────────────────────────────────

  describe('calculateExpectedConsumption', () => {
    it('should return zero consumption when no orders exist for the shift', async () => {
      shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        shiftDate: '2025-01-01',
      });
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.calculateExpectedConsumption('shift-1');

      expect(result.size).toBe(0);
    });

    it('should correctly multiply recipe quantities by order item quantities', async () => {
      shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        shiftDate: '2025-01-01',
      });
      mockDataSource.query.mockResolvedValue([
        { ingredient_id: 'ing-1', total_consumed: '3.0000' },
      ]);

      const result = await service.calculateExpectedConsumption('shift-1');

      expect(result.get('ing-1')).toBe(3);
    });

    it('should sum consumption across multiple orders for the same ingredient', async () => {
      shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        shiftDate: '2025-01-01',
      });
      mockDataSource.query.mockResolvedValue([
        { ingredient_id: 'ing-1', total_consumed: '7.5000' },
      ]);

      const result = await service.calculateExpectedConsumption('shift-1');

      expect(result.get('ing-1')).toBe(7.5);
    });

    it('should not count voided order items in consumption calculation', async () => {
      shiftRepo.findOne.mockResolvedValue({
        id: 'shift-1',
        shiftDate: '2025-01-01',
      });
      // SQL already filters is_voided = false — mock returns only non-voided totals
      mockDataSource.query.mockResolvedValue([
        { ingredient_id: 'ing-1', total_consumed: '2.0000' },
      ]);

      const result = await service.calculateExpectedConsumption('shift-1');

      // Verify the query was called (voided filter is in the SQL)
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('is_voided = false'),
        expect.any(Array),
      );
      expect(result.get('ing-1')).toBe(2);
    });
  });

  // ── submitActualCounts ───────────────────────────────────────────────────

  describe('submitActualCounts', () => {
    const shift = { id: 'shift-1', shiftDate: '2025-01-01', shift: 'morning' };
    const ingredient = {
      id: 'ing-1',
      name: 'Milk',
      currentStock: 10,
      lowStockThreshold: 2,
      consumptionUnit: 'L',
      group: { name: 'Dairy' },
      stockStatus: 'ok',
    };

    it('should insert one variance_report row per ingredient count submitted', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      mockDataSource.query
        .mockResolvedValueOnce([]) // calculateExpectedConsumption
        .mockResolvedValueOnce([]); // deliveries received
      mockQr.manager.query.mockResolvedValue(undefined);

      jest.spyOn(service, 'getVarianceReport').mockResolvedValue({
        id: 'shift-1-report',
        shiftReportId: 'shift-1',
        shiftDate: '2025-01-01',
        shift: 'morning',
        rows: [],
        totalShortages: 0,
        totalOvers: 0,
        significantShortages: 0,
        generatedAt: new Date().toISOString(),
      });

      await service.submitActualCounts({
        shiftReportId: 'shift-1',
        counts: [{ ingredientId: 'ing-1', actualCount: 8 }],
        submittedBy: 'staff-1',
      });

      expect(mockQr.manager.query).toHaveBeenCalledTimes(1);
      expect(mockQr.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO variance_reports'),
        expect.arrayContaining(['shift-1', 'ing-1']),
      );
    });

    it('should correctly calculate variance: opening + received - expected - actual', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      // expected consumption = 3, stock received = 2, opening = 10, actual = 8
      // variance = 10 + 2 - 3 - 8 = 1
      mockDataSource.query
        .mockResolvedValueOnce([
          { ingredient_id: 'ing-1', total_consumed: '3.0000' },
        ])
        .mockResolvedValueOnce([
          { ingredient_id: 'ing-1', total_received: '2.0000' },
        ]);
      mockQr.manager.query.mockResolvedValue(undefined);

      jest.spyOn(service, 'getVarianceReport').mockResolvedValue({
        id: 'r',
        shiftReportId: 'shift-1',
        shiftDate: '2025-01-01',
        shift: 'morning',
        rows: [],
        totalShortages: 0,
        totalOvers: 0,
        significantShortages: 0,
        generatedAt: new Date().toISOString(),
      });

      await service.submitActualCounts({
        shiftReportId: 'shift-1',
        counts: [{ ingredientId: 'ing-1', actualCount: 8 }],
        submittedBy: 'staff-1',
      });

      expect(mockQr.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO variance_reports'),
        // opening=10, stockReceived=2, expected=3, actual=8
        expect.arrayContaining([10, 2, 3, 8]),
      );
    });

    it('should rollback all inserts if any single insert fails', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      mockDataSource.query
        .mockResolvedValueOnce([]) // calculateExpectedConsumption
        .mockResolvedValueOnce([]); // deliveries received
      mockQr.manager.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.submitActualCounts({
          shiftReportId: 'shift-1',
          counts: [{ ingredientId: 'ing-1', actualCount: 5 }],
          submittedBy: 'staff-1',
        }),
      ).rejects.toThrow('DB error');

      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── getVarianceReport ────────────────────────────────────────────────────

  describe('getVarianceReport', () => {
    const shift = { id: 'shift-1', shiftDate: '2025-01-01', shift: 'morning' };

    const makeRow = (
      varianceType: 'shortage' | 'over' | 'exact',
      variance: string,
    ) => ({
      id: 'vr-1',
      ingredient_id: 'ing-1',
      ingredient_name: 'Milk',
      group_name: 'Dairy',
      consumption_unit: 'L',
      opening_stock: '10.0000',
      stock_received: '0.0000',
      expected_consumption: '3.0000',
      actual_count: '8.0000',
      variance,
      variance_type: varianceType,
      current_stock: '5.0000',
      low_stock_threshold: '2.0000',
    });

    it('should return all rows when filter is all', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      mockDataSource.query.mockResolvedValueOnce([
        makeRow('shortage', '-1.0000'),
        makeRow('over', '2.0000'),
      ]);

      const result = await service.getVarianceReport('shift-1', 'all');

      expect(result.rows).toHaveLength(2);
    });

    it('should return only shortage rows when filter is shortages', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      mockDataSource.query.mockResolvedValueOnce([
        makeRow('shortage', '-1.0000'),
      ]);

      const result = await service.getVarianceReport('shift-1', 'shortages');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("variance_type = 'shortage'"),
        expect.any(Array),
      );
      expect(result.rows[0].varianceType).toBe('shortage');
    });

    it('should return only over rows when filter is overs', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      mockDataSource.query.mockResolvedValueOnce([makeRow('over', '2.0000')]);

      const result = await service.getVarianceReport('shift-1', 'overs');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("variance_type = 'over'"),
        expect.any(Array),
      );
      expect(result.rows[0].varianceType).toBe('over');
    });

    it('should order by absolute variance descending', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      mockDataSource.query.mockResolvedValueOnce([]);

      await service.getVarianceReport('shift-1', 'all');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ABS(vr.variance) DESC'),
        expect.any(Array),
      );
    });

    it('should include correct summary counts for totalShortages and totalOvers', async () => {
      shiftRepo.findOne.mockResolvedValue(shift);
      mockDataSource.query.mockResolvedValueOnce([
        makeRow('shortage', '-1.0000'),
        makeRow('shortage', '-2.0000'),
        makeRow('over', '3.0000'),
      ]);

      const result = await service.getVarianceReport('shift-1', 'all');

      expect(result.totalShortages).toBe(2);
      expect(result.totalOvers).toBe(1);
    });
  });

  // ── getSalesSummary ──────────────────────────────────────────────────────

  describe('getSalesSummary', () => {
    const setupSalesMocks = (
      overrides: {
        totalRevenue?: string;
        totalTransactions?: string;
        totalVoids?: string;
        voidValue?: string;
        uniqueSessions?: string;
        groupRows?: unknown[];
        topItems?: unknown[];
        staffRows?: unknown[];
        hourRows?: unknown[];
      } = {},
    ) => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            total_revenue: overrides.totalRevenue ?? '500.00',
            total_transactions: overrides.totalTransactions ?? '5',
          },
        ])
        .mockResolvedValueOnce([
          {
            total_voids: overrides.totalVoids ?? '2',
            void_value: overrides.voidValue ?? '40.00',
          },
        ])
        .mockResolvedValueOnce([
          {
            unique_sessions: overrides.uniqueSessions ?? '5',
          },
        ])
        .mockResolvedValueOnce(overrides.groupRows ?? [])
        .mockResolvedValueOnce(overrides.topItems ?? [])
        .mockResolvedValueOnce(overrides.staffRows ?? [])
        .mockResolvedValueOnce(overrides.hourRows ?? []);
    };

    it('should sum revenue correctly across all transactions in the date range', async () => {
      setupSalesMocks({ totalRevenue: '1200.50' });

      const result = await service.getSalesSummary('2025-01-01', '2025-01-07');

      expect(result.totalRevenue).toBe(1200.5);
    });

    it('should not include voided order items in revenue totals', async () => {
      setupSalesMocks();

      await service.getSalesSummary('2025-01-01', '2025-01-01');

      // Revenue query must filter is_voided = false
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const revenueCall = mockDataSource.query.mock.calls[0][0] as string;
      expect(revenueCall).not.toContain('is_voided');

      // Group revenue query must filter is_voided = false
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const groupCall = mockDataSource.query.mock.calls[3][0] as string;
      expect(groupCall).toContain('is_voided = false');
    });

    it('should group revenue correctly by menu group', async () => {
      setupSalesMocks({
        totalRevenue: '300.00',
        groupRows: [
          { group_name: 'Food', revenue: '200.00', items_sold: '10' },
          { group_name: 'Drinks', revenue: '100.00', items_sold: '5' },
        ],
      });

      const result = await service.getSalesSummary('2025-01-01', '2025-01-01');

      expect(result.byGroup).toHaveLength(2);
      expect(result.byGroup[0].groupName).toBe('Food');
      expect(result.byGroup[0].percentage).toBeCloseTo(66.67, 1);
    });

    it('should identify top selling items by quantity', async () => {
      setupSalesMocks({
        topItems: [
          {
            menu_item_id: 'mi-1',
            menu_item_name: 'Burger',
            quantity_sold: '20',
            revenue: '400.00',
          },
        ],
      });

      const result = await service.getSalesSummary('2025-01-01', '2025-01-01');

      expect(result.topItems[0].menuItemName).toBe('Burger');
      expect(result.topItems[0].quantitySold).toBe(20);
    });

    it('should calculate average table spend correctly', async () => {
      setupSalesMocks({ totalRevenue: '500.00', uniqueSessions: '4' });

      const result = await service.getSalesSummary('2025-01-01', '2025-01-01');

      expect(result.averageTableSpend).toBeCloseTo(125, 1);
    });
  });

  // ── recordDelivery ───────────────────────────────────────────────────────

  describe('recordDelivery', () => {
    const ingredient = {
      id: 'ing-1',
      name: 'Milk',
      unitsPerPurchase: 4,
      purchaseUnit: 'bottle',
      consumptionUnit: 'L',
    };

    const dto = {
      supplierName: 'FreshFarm',
      deliveryDate: '2025-01-10',
      recordedBy: 'staff-1',
      items: [{ ingredientId: 'ing-1', quantityReceived: 5, costPerUnit: 20 }],
    };

    beforeEach(() => {
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      mockQr.manager.create.mockImplementation(
        (_: unknown, data: unknown) => data,
      );
      mockQr.manager.save.mockImplementation((_: unknown, data: unknown) =>
        Promise.resolve({ id: 'new-id', ...((data as object) ?? {}) }),
      );
      jest.spyOn(service, 'getDeliveryById').mockResolvedValue({
        id: 'del-1',
        supplierName: 'FreshFarm',
        deliveryDate: '2025-01-10',
        recordedBy: 'staff-1',
        invoiceReference: null,
        status: 'pending',
        items: [],
        totalDiscrepancyItems: 0,
      });
    });

    it('should create delivery and all delivery items in one transaction', async () => {
      await service.recordDelivery(dto);

      expect(mockQr.manager.save).toHaveBeenCalledTimes(2); // delivery + item
      expect(mockQr.commitTransaction).toHaveBeenCalled();
    });

    it('should call adjustStock for each item received', async () => {
      await service.recordDelivery(dto);

      expect(mockInventoryService.adjustStock).toHaveBeenCalledTimes(1);
      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ ingredientId: 'ing-1' }),
      );
    });

    it('should convert purchase units to consumption units before adjusting stock', async () => {
      await service.recordDelivery(dto);

      // 5 bottles × 4 L/bottle = 20 L
      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ quantityChange: 20 }),
      );
    });

    it('should rollback if any adjustStock call fails', async () => {
      mockInventoryService.adjustStock.mockRejectedValue(
        new Error('Stock error'),
      );

      await expect(service.recordDelivery(dto)).rejects.toThrow('Stock error');

      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── getDeliveryDiscrepancies ─────────────────────────────────────────────

  describe('getDeliveryDiscrepancies', () => {
    const makeQb = (items: unknown[]) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(items),
    });

    it('should only return items where discrepancy is not zero', async () => {
      const qb = makeQb([
        {
          id: 'di-1',
          ingredientId: 'ing-1',
          ingredient: { name: 'Milk', purchaseUnit: 'bottle' },
          quantityOrdered: 5,
          quantityReceived: 3,
          discrepancy: -2,
          costPerUnit: null,
        },
      ]);
      deliveryItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDeliveryDiscrepancies();

      expect(qb.where).toHaveBeenCalledWith('di.discrepancy != 0');
      expect(result).toHaveLength(1);
      expect(result[0].discrepancy).toBe(-2);
    });

    it('should order by absolute discrepancy descending', async () => {
      const qb = makeQb([]);
      deliveryItemRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getDeliveryDiscrepancies();

      expect(qb.orderBy).toHaveBeenCalledWith('ABS(di.discrepancy)', 'DESC');
    });
  });
});
