import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AuditLog } from '../orders/entities/audit-log.entity';
import { TableSession } from '../orders/entities/table-session.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { Staff } from '../staff/entities/staff.entity';
import { ShiftReport } from './entities/shift-report.entity';
import { StaffAccountEntry } from './entities/staff-account-entry.entity';
import { StaffAccount } from './entities/staff-account.entity';
import { TransactionSplit } from './entities/transaction-split.entity';
import { Transaction } from './entities/transaction.entity';
import { PaymentFailedException } from './payment-failed.exception';
import { PaymentsService } from './payments.service';
import { PeachProvider } from './providers/peach.provider';
import { YocoProvider } from './providers/yoco.provider';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

function makeItem(unitPrice = 75, quantity = 1): OrderItem {
  const i = new OrderItem();
  i.id = 'item-1';
  i.unitPrice = unitPrice;
  i.quantity = quantity;
  i.isVoided = false;
  return i;
}

function makeOrder(items: OrderItem[]): Order {
  const o = new Order();
  o.id = 'order-1';
  o.items = items;
  return o;
}

function makeSession(total = 75): TableSession {
  const s = new TableSession();
  s.id = 'session-1';
  s.closedAt = null;
  s.orders = [makeOrder([makeItem(total)])];
  return s;
}

function makeAccount(balance = 0, creditLimit = 200): StaffAccount {
  const a = new StaffAccount();
  a.id = 'account-1';
  a.staffId = 'staff-1';
  a.balance = balance;
  a.creditLimit = creditLimit;
  return a;
}

function makeShift(closed = false): ShiftReport {
  const r = new ShiftReport();
  r.id = 'shift-1';
  r.shift = 'morning';
  r.shiftDate = '2026-07-11';
  r.openedBy = 'staff-1';
  r.closedBy = null;
  r.openedAt = new Date();
  r.closedAt = closed ? new Date() : null;
  r.openingCashFloat = 500;
  r.totalSales = 0;
  r.totalCash = 0;
  r.totalCard = 0;
  r.totalStaffAccount = 0;
  r.totalVoids = 0;
  r.actualCashInTill = null;
  r.notes = null;
  return r;
}

function makeTransaction(): Transaction {
  const t = new Transaction();
  t.id = 'tx-1';
  t.tableSessionId = 'session-1';
  t.processedBy = 'staff-1';
  t.totalAmount = 75;
  t.paymentMethod = 'cash';
  t.paymentReference = null;
  t.paidAt = new Date();
  t.status = 'completed';
  t.splits = [];
  return t;
}

function makeQueryRunner(overrides: Record<string, jest.Mock> = {}) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn().mockImplementation((_cls: unknown, data: unknown) => ({
        ...(data as object),
      })),
      save: jest
        .fn()
        .mockImplementation((_cls: unknown, data: unknown) =>
          Promise.resolve(data),
        ),
      findOne: jest.fn(),
      ...overrides,
    },
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let txRepo: ReturnType<typeof mockRepo>;
  let splitRepo: ReturnType<typeof mockRepo>;
  let accountRepo: ReturnType<typeof mockRepo>;
  let entryRepo: ReturnType<typeof mockRepo>;
  let shiftRepo: ReturnType<typeof mockRepo>;
  let sessionRepo: ReturnType<typeof mockRepo>;
  let dataSource: { createQueryRunner: jest.Mock };
  let ordersService: { closeSession: jest.Mock };
  let yoco: { chargeCard: jest.Mock };
  let peach: { chargeCard: jest.Mock };

  beforeEach(async () => {
    txRepo = mockRepo();
    splitRepo = mockRepo();
    accountRepo = mockRepo();
    entryRepo = mockRepo();
    shiftRepo = mockRepo();
    sessionRepo = mockRepo();
    dataSource = { createQueryRunner: jest.fn() };
    ordersService = { closeSession: jest.fn().mockResolvedValue({}) };
    yoco = {
      chargeCard: jest.fn().mockResolvedValue({
        success: true,
        reference: 'ref-1',
        provider: 'yoco',
        rawResponse: {},
      }),
    };
    peach = { chargeCard: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(TransactionSplit), useValue: splitRepo },
        { provide: getRepositoryToken(StaffAccount), useValue: accountRepo },
        { provide: getRepositoryToken(StaffAccountEntry), useValue: entryRepo },
        { provide: getRepositoryToken(ShiftReport), useValue: shiftRepo },
        { provide: getRepositoryToken(TableSession), useValue: sessionRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo() },
        { provide: getRepositoryToken(Staff), useValue: mockRepo() },
        { provide: OrdersService, useValue: ordersService },
        { provide: YocoProvider, useValue: yoco },
        { provide: PeachProvider, useValue: peach },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('yoco') },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  // ── processPayment ────────────────────────────────────────────────────────

  describe('processPayment', () => {
    function setupQr() {
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      return qr;
    }

    it('should create a transaction and close the table session on success', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(75));
      const qr = setupQr();

      await service.processPayment({
        tableSessionId: 'session-1',
        paymentMethod: 'cash',
        amount: 75,
        processedBy: 'staff-1',
      });

      expect(qr.manager.save).toHaveBeenCalled();
      expect(ordersService.closeSession).toHaveBeenCalledWith(
        expect.objectContaining({ tableSessionId: 'session-1' }),
      );
    });

    it('should throw BadRequestException when amount does not match session total', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(75));

      await expect(
        service.processPayment({
          tableSessionId: 'session-1',
          paymentMethod: 'cash',
          amount: 50, // wrong amount
          processedBy: 'staff-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw PaymentFailedException when card charge fails', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(75));
      yoco.chargeCard.mockResolvedValue({
        success: false,
        reference: '',
        provider: 'yoco',
        rawResponse: {},
      });

      await expect(
        service.processPayment({
          tableSessionId: 'session-1',
          paymentMethod: 'card',
          amount: 75,
          processedBy: 'staff-1',
          paymentReference: 'tok_test',
        }),
      ).rejects.toThrow(PaymentFailedException);
    });

    it('should rollback DB writes if closeSession fails after payment', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(75));
      ordersService.closeSession.mockRejectedValue(new Error('session error'));
      const qr = setupQr();

      await expect(
        service.processPayment({
          tableSessionId: 'session-1',
          paymentMethod: 'cash',
          amount: 75,
          processedBy: 'staff-1',
        }),
      ).rejects.toThrow();

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });

    it('should update shift report totals after successful payment', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(75));
      const qr = setupQr();
      const shift = makeShift();
      qr.manager.findOne.mockResolvedValue(shift);

      await service.processPayment({
        tableSessionId: 'session-1',
        paymentMethod: 'cash',
        amount: 75,
        processedBy: 'staff-1',
      });

      expect(qr.manager.save).toHaveBeenCalledWith(
        ShiftReport,
        expect.objectContaining({ totalSales: 75 }),
      );
    });

    it('should throw BadRequestException when staff account credit limit would be exceeded', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(75));
      // balance=0, creditLimit=50 — charging 75 would exceed limit
      accountRepo.findOne.mockResolvedValue(makeAccount(0, 50));

      await expect(
        service.processPayment({
          tableSessionId: 'session-1',
          paymentMethod: 'staff_account',
          amount: 75,
          processedBy: 'staff-1',
          staffAccountId: 'account-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── processSplitPayment ───────────────────────────────────────────────────

  describe('processSplitPayment', () => {
    it('should create one transaction_split per split', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(100));
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.processSplitPayment({
        tableSessionId: 'session-1',
        processedBy: 'staff-1',
        splits: [
          { amount: 60, paymentMethod: 'cash' },
          { amount: 40, paymentMethod: 'cash' },
        ],
      });

      // save called for tx + 2 splits + shift update
      const splitSaves = qr.manager.save.mock.calls.filter(
        (c: unknown[]) => c[0] === TransactionSplit,
      );
      expect(splitSaves).toHaveLength(2);
    });

    it('should throw BadRequestException when split amounts do not sum to session total', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(100));

      await expect(
        service.processSplitPayment({
          tableSessionId: 'session-1',
          processedBy: 'staff-1',
          splits: [{ amount: 60, paymentMethod: 'cash' }], // only 60, total is 100
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not write to DB if any card split fails', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(100));
      yoco.chargeCard.mockResolvedValue({
        success: false,
        reference: '',
        provider: 'yoco',
        rawResponse: {},
      });

      await expect(
        service.processSplitPayment({
          tableSessionId: 'session-1',
          processedBy: 'staff-1',
          splits: [
            { amount: 60, paymentMethod: 'cash' },
            { amount: 40, paymentMethod: 'card', paymentReference: 'tok_test' },
          ],
        }),
      ).rejects.toThrow(PaymentFailedException);

      // No QueryRunner created — DB writes never started
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should close the table session after all splits succeed', async () => {
      sessionRepo.findOne.mockResolvedValue(makeSession(100));
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.processSplitPayment({
        tableSessionId: 'session-1',
        processedBy: 'staff-1',
        splits: [
          { amount: 60, paymentMethod: 'cash' },
          { amount: 40, paymentMethod: 'cash' },
        ],
      });

      expect(ordersService.closeSession).toHaveBeenCalled();
    });
  });

  // ── chargeStaffAccount ────────────────────────────────────────────────────

  describe('chargeStaffAccount', () => {
    it('should reduce staff account balance by the charged amount', async () => {
      const account = makeAccount(0, 200);
      accountRepo.findOne.mockResolvedValue(account);
      accountRepo.save.mockImplementation((a: StaffAccount) =>
        Promise.resolve(a),
      );
      entryRepo.create.mockReturnValue({});
      entryRepo.save.mockResolvedValue({});

      await service.chargeStaffAccount({
        staffAccountId: 'account-1',
        amount: 50,
        description: 'Lunch',
        createdBy: 'staff-1',
      });

      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: -50 }),
      );
    });

    it('should create a staff_account_entry record', async () => {
      accountRepo.findOne.mockResolvedValue(makeAccount(0, 200));
      accountRepo.save.mockImplementation((a: StaffAccount) =>
        Promise.resolve(a),
      );
      entryRepo.create.mockReturnValue({ amount: -50 });
      entryRepo.save.mockResolvedValue({ id: 'entry-1', amount: -50 });

      const result = await service.chargeStaffAccount({
        staffAccountId: 'account-1',
        amount: 50,
        description: 'Lunch',
        createdBy: 'staff-1',
      });

      expect(entryRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when credit limit would be exceeded', async () => {
      accountRepo.findOne.mockResolvedValue(makeAccount(0, 50));

      await expect(
        service.chargeStaffAccount({
          staffAccountId: 'account-1',
          amount: 100,
          description: 'Dinner',
          createdBy: 'staff-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── openShift ─────────────────────────────────────────────────────────────

  describe('openShift', () => {
    it('should create a shift report with totalSales of 0', async () => {
      shiftRepo.findOne.mockResolvedValue(null); // no open shift
      const shift = makeShift();
      shiftRepo.create.mockReturnValue(shift);
      shiftRepo.save.mockResolvedValue(shift);

      const result = await service.openShift({
        shift: 'morning',
        openedBy: 'staff-1',
        openingCashFloat: 500,
      });

      expect(result.totalSales).toBe(0);
    });

    it('should throw ConflictException when a shift is already open', async () => {
      shiftRepo.findOne.mockResolvedValue(makeShift()); // existing open shift

      await expect(
        service.openShift({
          shift: 'morning',
          openedBy: 'staff-1',
          openingCashFloat: 500,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── closeShift ────────────────────────────────────────────────────────────

  describe('closeShift', () => {
    it('should set closedAt and actualCashInTill', async () => {
      const shift = makeShift();
      shiftRepo.findOne.mockResolvedValue(shift);
      shiftRepo.save.mockImplementation((s: ShiftReport) => Promise.resolve(s));

      const result = await service.closeShift({
        shiftReportId: 'shift-1',
        closedBy: 'staff-1',
        actualCashInTill: 600,
      });

      expect(result.closedAt).not.toBeNull();
      expect(result.actualCashInTill).toBe(600);
    });

    it('should calculate cash variance correctly — positive when more cash than expected', async () => {
      const shift = makeShift();
      shift.openingCashFloat = 500;
      shift.totalCash = 200; // expected = 700
      shiftRepo.findOne.mockResolvedValue(shift);
      shiftRepo.save.mockImplementation((s: ShiftReport) => Promise.resolve(s));

      const result = await service.closeShift({
        shiftReportId: 'shift-1',
        closedBy: 'staff-1',
        actualCashInTill: 750, // 50 more than expected
      });

      expect(result.cashVariance).toBe(50); // 750 - 700
    });

    it('should calculate cash variance correctly — negative when less cash than expected', async () => {
      const shift = makeShift();
      shift.openingCashFloat = 500;
      shift.totalCash = 200; // expected = 700
      shiftRepo.findOne.mockResolvedValue(shift);
      shiftRepo.save.mockImplementation((s: ShiftReport) => Promise.resolve(s));

      const result = await service.closeShift({
        shiftReportId: 'shift-1',
        closedBy: 'staff-1',
        actualCashInTill: 650, // 50 short
      });

      expect(result.cashVariance).toBe(-50); // 650 - 700
    });
  });

  // ── refundTransaction ─────────────────────────────────────────────────────

  describe('refundTransaction', () => {
    function setupRefundQr() {
      const qr = makeQueryRunner({
        findOne: jest.fn().mockResolvedValue(null), // no open shift
      });
      dataSource.createQueryRunner.mockReturnValue(qr);
      return qr;
    }

    it('should set transaction status to refunded', async () => {
      const tx = makeTransaction();
      txRepo.findOne.mockResolvedValue(tx);
      const qr = setupRefundQr();

      await service.refundTransaction('tx-1', 'Customer complaint', 'staff-1');

      expect(qr.manager.save).toHaveBeenCalledWith(
        Transaction,
        expect.objectContaining({ status: 'refunded' }),
      );
    });

    it('should create an audit_log entry with full before/after data', async () => {
      const tx = makeTransaction();
      txRepo.findOne.mockResolvedValue(tx);
      const qr = setupRefundQr();

      await service.refundTransaction('tx-1', 'Customer complaint', 'staff-1');

      expect(qr.manager.create).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({
          tableName: 'transactions',
          action: 'UPDATE',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          oldData: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('should reverse the shift report totals', async () => {
      const tx = makeTransaction();
      txRepo.findOne.mockResolvedValue(tx);
      const shift = makeShift();
      shift.totalSales = 75;
      shift.totalCash = 75;
      const qr = makeQueryRunner({
        findOne: jest.fn().mockResolvedValue(shift),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.refundTransaction('tx-1', 'Customer complaint', 'staff-1');

      expect(qr.manager.save).toHaveBeenCalledWith(
        ShiftReport,
        expect.objectContaining({ totalSales: 0 }), // 75 - 75 = 0
      );
    });
  });
});
