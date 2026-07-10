import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { MenuItem } from './menu-item.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('price_history')
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menu_item_id' })
  menuItem!: MenuItem;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId!: string;

  @Column({
    name: 'old_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  oldPrice!: number;

  @Column({
    name: 'new_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  newPrice!: number;

  // Stored as UUID only — avoids circular module dependency with the staff module
  @Column({ name: 'changed_by', type: 'uuid' })
  changedBy!: string;

  @Column({ name: 'changed_at', type: 'timestamptz', default: () => 'NOW()' })
  changedAt!: Date;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;
}
