import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from '../orders/entities/audit-log.entity';
import { TableSession } from '../orders/entities/table-session.entity';
import { OrdersModule } from '../orders/orders.module';
import { Staff } from '../staff/entities/staff.entity';
import { ShiftReport } from './entities/shift-report.entity';
import { StaffAccountEntry } from './entities/staff-account-entry.entity';
import { StaffAccount } from './entities/staff-account.entity';
import { TransactionSplit } from './entities/transaction-split.entity';
import { Transaction } from './entities/transaction.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PeachProvider } from './providers/peach.provider';
import { YocoProvider } from './providers/yoco.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionSplit,
      StaffAccount,
      StaffAccountEntry,
      ShiftReport,
      TableSession,
      AuditLog,
      Staff,
    ]),
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, YocoProvider, PeachProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
