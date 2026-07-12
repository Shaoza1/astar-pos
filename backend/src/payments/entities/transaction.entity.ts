import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { PaymentMethod } from '@astar-pos/shared';
import { Staff } from '../../staff/entities/staff.entity';
import { TableSession } from '../../orders/entities/table-session.entity';
import { TransactionSplit } from './transaction-split.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_session_id', type: 'uuid' })
  tableSessionId!: string;

  @ManyToOne(() => TableSession)
  @JoinColumn({ name: 'table_session_id' })
  tableSession!: TableSession;

  @Column({ name: 'processed_by', type: 'uuid' })
  processedBy!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'processed_by' })
  processedByStaff!: Staff;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 20 })
  paymentMethod!: PaymentMethod;

  @Column({
    name: 'payment_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentReference!: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', default: () => 'NOW()' })
  paidAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // status not in migration — tracked via paymentReference presence and refund logic
  status!: 'completed' | 'refunded';

  @OneToMany(() => TransactionSplit, (s) => s.transaction)
  splits!: TransactionSplit[];
}
