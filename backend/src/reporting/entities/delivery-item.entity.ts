import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Ingredient } from '../../inventory/entities/ingredient.entity';
import { Delivery } from './delivery.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

const nullableDecimalTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

@Entity('delivery_items')
export class DeliveryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId!: string;

  @ManyToOne(() => Delivery, (d) => d.items)
  @JoinColumn({ name: 'delivery_id' })
  delivery!: Delivery;

  @Column({ name: 'ingredient_id', type: 'uuid' })
  ingredientId!: string;

  @ManyToOne(() => Ingredient, { eager: true })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient!: Ingredient;

  @Column({
    name: 'quantity_ordered',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  quantityOrdered!: number | null;

  @Column({
    name: 'quantity_received',
    type: 'decimal',
    precision: 10,
    scale: 4,
    transformer: decimalTransformer,
  })
  quantityReceived!: number;

  // PostgreSQL GENERATED column — never written by application
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    insert: false,
    update: false,
    transformer: decimalTransformer,
  })
  discrepancy!: number;

  @Column({
    name: 'cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: nullableDecimalTransformer,
  })
  costPerUnit!: number | null;
}
