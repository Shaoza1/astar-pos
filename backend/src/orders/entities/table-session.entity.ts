import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Staff } from '../../staff/entities/staff.entity';
import { Order } from './order.entity';
import { RestaurantTable } from './restaurant-table.entity';

@Entity('table_sessions')
export class TableSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_id', type: 'uuid' })
  tableId!: string;

  @ManyToOne(() => RestaurantTable, (t) => t.sessions)
  @JoinColumn({ name: 'table_id' })
  table!: RestaurantTable;

  @Column({ name: 'opened_by', type: 'uuid' })
  openedBy!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'opened_by' })
  openedByStaff!: Staff;

  @CreateDateColumn({ name: 'opened_at', type: 'timestamptz' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'guest_count', type: 'integer', nullable: true })
  guestCount!: number | null;

  @Column({ name: 'is_flagged', type: 'boolean', default: false })
  isFlagged!: boolean;

  @Column({ name: 'flag_reason', type: 'text', nullable: true })
  flagReason!: string | null;

  @OneToMany(() => Order, (o) => o.session)
  orders!: Order[];

  get isOpen(): boolean {
    return this.closedAt === null;
  }

  get totalAmount(): number {
    if (!this.orders) return 0;
    return this.orders.reduce((sum, o) => {
      if (!o.items) return sum;
      return (
        sum +
        o.items
          .filter((i) => !i.isVoided)
          .reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      );
    }, 0);
  }
}
