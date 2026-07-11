import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { OrderStatus } from '@astar-pos/shared';
import { Staff } from '../../staff/entities/staff.entity';
import { OrderItem } from './order-item.entity';
import { TableSession } from './table-session.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_session_id', type: 'uuid' })
  tableSessionId!: string;

  @ManyToOne(() => TableSession, (s) => s.orders)
  @JoinColumn({ name: 'table_session_id' })
  session!: TableSession;

  @Column({ name: 'taken_by', type: 'uuid' })
  takenBy!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'taken_by' })
  takenByStaff!: Staff;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: OrderStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => OrderItem, (i) => i.order)
  items!: OrderItem[];

  get subtotal(): number {
    if (!this.items) return 0;
    return this.items
      .filter((i) => !i.isVoided)
      .reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  }
}
