import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import type {
  ShiftReportDto,
  StaffAccountDto,
  TransactionDto,
} from '@astar-pos/shared';
import { AuditLog } from '../orders/entities/audit-log.entity';
import { TableSession } from '../orders/entities/table-session.entity';
import { OrdersService } from '../orders/orders.service';
import { Staff } from '../staff/entities/staff.entity';
import {
  ChargeStaffAccountDto,
  CloseShiftDto,
  OpenShiftDto,
  ProcessPaymentDto,
  ProcessSplitPaymentDto,
} from './dto/payments.dto';
import { ShiftReport } from './entities/shift-report.entity';
import { StaffAccountEntry } from './entities/staff-account-entry.entity';
import { StaffAccount } from './entities/staff-account.entity';
import { TransactionSplit } from './entities/transaction-split.entity';
import { Transaction } from './entities/transaction.entity';
import { PaymentFailedException } from './payment-failed.exception';
import { PeachProvider } from './providers/peach.provider';
import { YocoProvider } from './providers/yoco.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(TransactionSplit)
    private readonly splitRepo: Repository<TransactionSplit>,
    @InjectRepository(StaffAccount)
    private readonly accountRepo: Repository<StaffAccount>,
    @InjectRepository(StaffAccountEntry)
    private readonly entryRepo: Repository<StaffAccountEntry>,
    @InjectRepository(ShiftReport)
    private readonly shiftRepo: Repository<ShiftReport>,
    @InjectRepository(TableSession)
    private readonly sessionRepo: Repository<TableSession>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly ordersService: OrdersService,
    private readonly yoco: YocoProvider,
    private readonly peach: PeachProvider,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Core Payment ─────────────────────────────────────────────────────────

  async processPayment(dto: ProcessPaymentDto): Promise<TransactionDto> {
    const session = await this.loadSessionWithTotal(dto.tableSessionId);
    const sessionTotal = this.calcSessionTotal(session);

    if (Math.abs(dto.amount - sessionTotal) > 0.01) {
      throw new BadRequestException(
        `Amount ${dto.amount} does not match session total ${sessionTotal}`,
      );
    }

    // Card charge happens BEFORE DB writes — fail fast
    let paymentRef = dto.paymentReference ?? null;
    if (dto.paymentMethod === 'card') {
      const result = await this.chargeCard(
        dto.amount,
        dto.paymentReference ?? '',
      );
      if (!result.success) {
        throw new PaymentFailedException(result.provider, result.rawResponse);
      }
      paymentRef = result.reference;
    }

    // Staff account credit check before DB writes
    if (dto.paymentMethod === 'staff_account') {
      if (!dto.staffAccountId) {
        throw new BadRequestException(
          'staffAccountId required for staff_account payment',
        );
      }
      const account = await this.accountRepo.findOne({
        where: { id: dto.staffAccountId },
      });
      if (!account) throw new NotFoundException('Staff account not found');
      if (account.balance - dto.amount < -account.creditLimit) {
        throw new BadRequestException('Credit limit exceeded');
      }
    }

    // All DB writes in one transaction
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const tx = qr.manager.create(Transaction, {
        tableSessionId: dto.tableSessionId,
        processedBy: dto.processedBy,
        totalAmount: dto.amount,
        paymentMethod: dto.paymentMethod as Transaction['paymentMethod'],
        paymentReference: paymentRef,
        notes: null,
      });
      const savedTx = await qr.manager.save(Transaction, tx);

      // Staff account deduction inside transaction
      if (dto.paymentMethod === 'staff_account' && dto.staffAccountId) {
        const account = await qr.manager.findOne(StaffAccount, {
          where: { id: dto.staffAccountId },
        });
        if (account) {
          account.balance -= dto.amount;
          await qr.manager.save(StaffAccount, account);
          const entry = qr.manager.create(StaffAccountEntry, {
            accountId: account.id,
            amount: -dto.amount,
            description: `Payment for session ${dto.tableSessionId}`,
            createdBy: dto.processedBy,
          });
          await qr.manager.save(StaffAccountEntry, entry);
        }
      }

      // Close the table session atomically with the transaction
      await this.ordersService.closeSession({
        tableSessionId: dto.tableSessionId,
        closedBy: dto.processedBy,
      });

      // Update current shift report totals
      await this.updateShiftTotals(qr.manager, dto.amount, dto.paymentMethod);

      await qr.commitTransaction();

      return this.txToDto(savedTx, []);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async processSplitPayment(
    dto: ProcessSplitPaymentDto,
  ): Promise<TransactionDto> {
    const session = await this.loadSessionWithTotal(dto.tableSessionId);
    const sessionTotal = this.calcSessionTotal(session);
    const splitSum = dto.splits.reduce((s, sp) => s + sp.amount, 0);

    if (Math.abs(splitSum - sessionTotal) > 0.01) {
      throw new BadRequestException(
        `Split total ${splitSum} does not match session total ${sessionTotal}`,
      );
    }

    // Process all card splits FIRST — fail fast before any DB writes
    const cardResults: { idx: number; reference: string }[] = [];
    for (let i = 0; i < dto.splits.length; i++) {
      const sp = dto.splits[i];
      if (sp.paymentMethod === 'card') {
        const result = await this.chargeCard(
          sp.amount,
          sp.paymentReference ?? '',
        );
        if (!result.success) {
          throw new PaymentFailedException(result.provider, result.rawResponse);
        }
        cardResults.push({ idx: i, reference: result.reference });
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const tx = qr.manager.create(Transaction, {
        tableSessionId: dto.tableSessionId,
        processedBy: dto.processedBy,
        totalAmount: sessionTotal,
        paymentMethod: 'split' as Transaction['paymentMethod'],
        paymentReference: null,
        notes: null,
      });
      const savedTx = await qr.manager.save(Transaction, tx);

      const savedSplits: TransactionSplit[] = [];
      for (let i = 0; i < dto.splits.length; i++) {
        const sp = dto.splits[i];
        const cardRef = cardResults.find((r) => r.idx === i);
        const split = qr.manager.create(TransactionSplit, {
          transactionId: savedTx.id,
          splitAmount: sp.amount,
          paymentMethod: sp.paymentMethod as TransactionSplit['paymentMethod'],
          paymentReference: cardRef?.reference ?? sp.paymentReference ?? null,
        });
        savedSplits.push(await qr.manager.save(TransactionSplit, split));
      }

      await this.ordersService.closeSession({
        tableSessionId: dto.tableSessionId,
        closedBy: dto.processedBy,
      });

      await this.updateShiftTotals(qr.manager, sessionTotal, 'split');

      await qr.commitTransaction();
      return this.txToDto(savedTx, savedSplits);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Staff Accounts ───────────────────────────────────────────────────────

  async getOrCreateStaffAccount(staffId: string): Promise<StaffAccount> {
    let account = await this.accountRepo.findOne({ where: { staffId } });
    if (!account) {
      account = await this.accountRepo.save(
        this.accountRepo.create({ staffId, balance: 0, creditLimit: 200 }),
      );
    }
    return account;
  }

  async chargeStaffAccount(
    dto: ChargeStaffAccountDto,
  ): Promise<StaffAccountEntry> {
    const account = await this.accountRepo.findOne({
      where: { id: dto.staffAccountId },
      relations: { staff: true },
    });
    if (!account) throw new NotFoundException('Staff account not found');

    if (account.balance - dto.amount < -account.creditLimit) {
      throw new BadRequestException('Credit limit exceeded');
    }

    account.balance -= dto.amount;
    await this.accountRepo.save(account);

    const entry = this.entryRepo.create({
      accountId: account.id,
      amount: -dto.amount, // negative = charge
      description: dto.description,
      createdBy: dto.createdBy,
    });
    return this.entryRepo.save(entry);
  }

  async getStaffAccountBalance(staffId: string): Promise<StaffAccountDto> {
    const account = await this.accountRepo.findOne({
      where: { staffId },
      relations: { staff: true },
    });
    if (!account) throw new NotFoundException('Staff account not found');
    return this.accountToDto(account);
  }

  async getAllStaffAccounts(): Promise<StaffAccountDto[]> {
    const accounts = await this.accountRepo.find({
      relations: { staff: true },
    });
    return accounts.map((a) => this.accountToDto(a));
  }

  // ── Shift Management ─────────────────────────────────────────────────────

  async openShift(dto: OpenShiftDto): Promise<ShiftReportDto> {
    const existing = await this.shiftRepo.findOne({
      where: { closedAt: IsNull() },
    });
    if (existing) throw new ConflictException('A shift is already open');

    const today = new Date().toISOString().split('T')[0];
    const report = await this.shiftRepo.save(
      this.shiftRepo.create({
        shiftDate: today,
        shift: dto.shift as ShiftReport['shift'],
        openedBy: dto.openedBy,
        closedBy: null,
        openedAt: new Date(),
        closedAt: null,
        openingCashFloat: dto.openingCashFloat,
        totalSales: 0,
        totalCash: 0,
        totalCard: 0,
        totalStaffAccount: 0,
        totalVoids: 0,
        actualCashInTill: null,
        notes: null,
      }),
    );
    return this.shiftToDto(report);
  }

  async closeShift(dto: CloseShiftDto): Promise<ShiftReportDto> {
    const report = await this.shiftRepo.findOne({
      where: { id: dto.shiftReportId },
    });
    if (!report) throw new NotFoundException('Shift report not found');

    report.closedAt = new Date();
    report.closedBy = dto.closedBy;
    report.actualCashInTill = dto.actualCashInTill;

    const saved = await this.shiftRepo.save(report);
    return this.shiftToDto(saved);
  }

  async getCurrentShift(): Promise<ShiftReportDto | null> {
    const report = await this.shiftRepo.findOne({
      where: { closedAt: IsNull() },
    });
    return report ? this.shiftToDto(report) : null;
  }

  async getShiftHistory(limit = 20): Promise<ShiftReportDto[]> {
    const reports = await this.shiftRepo.find({
      order: { openedAt: 'DESC' },
      take: limit,
    });
    return reports.map((r) => this.shiftToDto(r));
  }

  // ── Refunds ──────────────────────────────────────────────────────────────

  async refundTransaction(
    transactionId: string,
    reason: string,
    refundedBy: string,
  ): Promise<Transaction> {
    const tx = await this.txRepo.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');

    const oldData = { status: tx.status, totalAmount: tx.totalAmount };

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      tx.status = 'refunded';
      const saved = await qr.manager.save(Transaction, tx);

      // Reverse shift report totals
      await this.updateShiftTotals(
        qr.manager,
        -tx.totalAmount,
        tx.paymentMethod,
      );

      // Audit log
      const entry = qr.manager.create(AuditLog, {
        tableName: 'transactions',
        recordId: tx.id,
        action: 'UPDATE' as const,
        oldData,
        newData: { status: 'refunded', reason },
        performedBy: refundedBy,
        ipAddress: null,
      });
      await qr.manager.save(AuditLog, entry);

      await qr.commitTransaction();
      return saved;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async chargeCard(amount: number, reference: string) {
    const provider = this.config.get<string>('PAYMENT_PROVIDER') ?? 'yoco';
    const dto = {
      amount,
      currency: 'ZAR',
      reference,
      provider: provider as 'yoco' | 'peach',
    };
    return provider === 'peach'
      ? this.peach.chargeCard(dto)
      : this.yoco.chargeCard(dto);
  }

  private async loadSessionWithTotal(sessionId: string): Promise<TableSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, closedAt: IsNull() },
      relations: { orders: { items: true } },
    });
    if (!session)
      throw new NotFoundException('Session not found or already closed');
    return session;
  }

  private calcSessionTotal(session: TableSession): number {
    return session.orders.reduce((sum, o) => {
      return (
        sum +
        o.items
          .filter((i) => !i.isVoided)
          .reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      );
    }, 0);
  }

  private async updateShiftTotals(
    manager: EntityManager,
    amount: number,
    method: string,
  ): Promise<void> {
    const shift = await manager.findOne(ShiftReport, {
      where: { closedAt: IsNull() },
    });
    if (!shift) return;

    shift.totalSales = (shift.totalSales ?? 0) + amount;
    if (method === 'cash') shift.totalCash = (shift.totalCash ?? 0) + amount;
    else if (method === 'card')
      shift.totalCard = (shift.totalCard ?? 0) + amount;
    else if (method === 'staff_account')
      shift.totalStaffAccount = (shift.totalStaffAccount ?? 0) + amount;

    await manager.save(ShiftReport, shift);
  }

  // ── Mappers ──────────────────────────────────────────────────────────────

  private txToDto(tx: Transaction, splits: TransactionSplit[]): TransactionDto {
    return {
      id: tx.id,
      tableSessionId: tx.tableSessionId,
      processedBy: tx.processedBy,
      totalAmount: tx.totalAmount,
      paymentMethod: tx.paymentMethod,
      paymentReference: tx.paymentReference,
      paidAt: tx.paidAt ? tx.paidAt.toISOString() : new Date().toISOString(),
      splits: splits.map((s) => ({
        id: s.id,
        transactionId: s.transactionId,
        splitAmount: s.splitAmount,
        paymentMethod: s.paymentMethod,
        paymentReference: s.paymentReference,
      })),
    };
  }

  private accountToDto(account: StaffAccount): StaffAccountDto {
    return {
      id: account.id,
      staffId: account.staffId,
      staffName: account.staff?.fullName ?? '',
      balance: account.balance,
      creditLimit: account.creditLimit,
    };
  }

  private shiftToDto(report: ShiftReport): ShiftReportDto {
    return {
      id: report.id,
      shiftDate: report.shiftDate,
      shift: report.shift,
      openedBy: report.openedBy,
      closedBy: report.closedBy,
      openedAt: report.openedAt.toISOString(),
      closedAt: report.closedAt?.toISOString() ?? null,
      openingCashFloat: report.openingCashFloat,
      totalSales: report.totalSales,
      totalCash: report.totalCash,
      totalCard: report.totalCard,
      totalStaffAccount: report.totalStaffAccount,
      totalVoids: report.totalVoids,
      actualCashInTill: report.actualCashInTill,
      expectedCashInTill: report.expectedCashInTill,
      cashVariance: report.cashVariance,
      isOpen: report.isOpen,
    };
  }
}
