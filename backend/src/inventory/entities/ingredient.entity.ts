import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { IngredientGroup } from './ingredient-group.entity';

// Reusable transformer: TypeORM returns DECIMAL columns as strings from pg — parse silently
const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => IngredientGroup, (group) => group.ingredients, {
    eager: true,
  })
  @JoinColumn({ name: 'group_id' })
  group!: IngredientGroup;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'purchase_unit', type: 'varchar', length: 50 })
  purchaseUnit!: string;

  @Column({ name: 'consumption_unit', type: 'varchar', length: 50 })
  consumptionUnit!: string;

  @Column({
    name: 'units_per_purchase',
    type: 'decimal',
    precision: 10,
    scale: 4,
    transformer: decimalTransformer,
  })
  unitsPerPurchase!: number;

  @Column({
    name: 'low_stock_threshold',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: decimalTransformer,
  })
  lowStockThreshold!: number;

  @Column({
    name: 'current_stock',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
    transformer: decimalTransformer,
  })
  currentStock!: number;

  @Column({
    name: 'cost_per_purchase_unit',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  costPerPurchaseUnit!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Derived field — computed after each load, never persisted to the database
  stockStatus!: 'ok' | 'low' | 'out';

  @AfterLoad()
  computeStockStatus() {
    if (this.currentStock === 0) {
      this.stockStatus = 'out';
    } else if (this.currentStock <= this.lowStockThreshold) {
      this.stockStatus = 'low';
    } else {
      this.stockStatus = 'ok';
    }
  }
}
