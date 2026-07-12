import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Staff } from '../../staff/entities/staff.entity';
import { StaffAccountEntry } from './staff-account-entry.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('staff_accounts')
export class StaffAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'staff_id', type: 'uuid', unique: true })
  staffId!: string;

  @OneToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff!: Staff;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  balance!: number;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 200,
    transformer: decimalTransformer,
  })
  creditLimit!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => StaffAccountEntry, (e) => e.account)
  entries!: StaffAccountEntry[];
}
