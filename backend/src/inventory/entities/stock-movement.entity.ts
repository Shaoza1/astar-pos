import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import type { MovementType } from '@astar-pos/shared';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ingredient_id', type: 'uuid' })
  ingredientId!: string;

  @Column({ name: 'movement_type', type: 'varchar', length: 20 })
  movementType!: MovementType;

  @Column({
    name: 'quantity_change',
    type: 'decimal',
    precision: 10,
    scale: 4,
    transformer: decimalTransformer,
  })
  quantityChange!: number;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId!: string | null;

  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  referenceType!: string | null;

  @Column({ name: 'performed_by', type: 'uuid' })
  performedBy!: string;

  @Column({ name: 'performed_at', type: 'timestamptz', default: () => 'NOW()' })
  performedAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
