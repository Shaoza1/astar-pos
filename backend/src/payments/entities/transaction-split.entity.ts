import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Transaction } from './transaction.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('transaction_splits')
export class TransactionSplit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => Transaction, (t) => t.splits)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction;

  @Column({
    name: 'split_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  splitAmount!: number;

  @Column({ name: 'payment_method', type: 'varchar', length: 20 })
  paymentMethod!: 'cash' | 'card' | 'staff_account';

  @Column({
    name: 'payment_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentReference!: string | null;
}
