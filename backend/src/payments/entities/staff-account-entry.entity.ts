import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Staff } from '../../staff/entities/staff.entity';
import { StaffAccount } from './staff-account.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('staff_account_entries')
export class StaffAccountEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId!: string;

  @ManyToOne(() => StaffAccount, (a) => a.entries)
  @JoinColumn({ name: 'account_id' })
  account!: StaffAccount;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount!: number; // negative = charge, positive = payment

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'created_by' })
  createdByStaff!: Staff;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
