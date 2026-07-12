import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { ShiftName } from '@astar-pos/shared';
import { Staff } from '../../staff/entities/staff.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

const nullableDecimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

@Entity('shift_reports')
export class ShiftReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'shift_date', type: 'date' })
  shiftDate!: string;

  @Column({ type: 'varchar', length: 10 })
  shift!: ShiftName;

  @Column({ name: 'opened_by', type: 'uuid' })
  openedBy!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'opened_by' })
  openedByStaff!: Staff;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy!: string | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedByStaff!: Staff | null;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({
    name: 'opening_cash_float',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  openingCashFloat!: number;

  @Column({
    name: 'total_sales',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalSales!: number;

  @Column({
    name: 'total_cash',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalCash!: number;

  @Column({
    name: 'total_card',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalCard!: number;

  @Column({
    name: 'total_staff_account',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalStaffAccount!: number;

  @Column({
    name: 'total_voids',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  totalVoids!: number;

  @Column({
    name: 'actual_cash_in_till',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  actualCashInTill!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  get isOpen(): boolean {
    return this.closedAt === null;
  }

  get expectedCashInTill(): number {
    return this.openingCashFloat + this.totalCash;
  }

  get cashVariance(): number | null {
    if (this.actualCashInTill === null) return null;
    return this.actualCashInTill - this.expectedCashInTill;
  }
}
