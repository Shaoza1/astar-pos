import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { MenuItem } from '../../menu/entities/menu-item.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Order } from './order.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (o) => o.items)
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId!: string;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menu_item_id' })
  menuItem!: MenuItem;

  @Column({ type: 'integer', default: 1 })
  quantity!: number;

  // Snapshot of price at time of order — never changes after creation
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice!: number;

  // JSON stored as text — serialized/deserialized manually
  @Column({ type: 'text', nullable: true })
  modifiers!: string | null;

  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided!: boolean;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason!: string | null;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy!: string | null;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'voided_by' })
  voidedByStaff!: Staff | null;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt!: Date | null;

  get lineTotal(): number {
    if (this.isVoided) return 0;
    return this.quantity * this.unitPrice;
  }

  get parsedModifiers(): Record<string, string> | null {
    if (!this.modifiers) return null;
    try {
      return JSON.parse(this.modifiers) as Record<string, string>;
    } catch {
      return null;
    }
  }
}
