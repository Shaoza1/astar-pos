import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { MenuGroup } from './menu-group.entity';
import { Recipe } from './recipe.entity';

const decimalTransformer = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MenuGroup, (group) => group.items, { eager: true })
  @JoinColumn({ name: 'group_id' })
  group!: MenuGroup;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_comp', type: 'boolean', default: false })
  isComp!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Nullable — not every menu item has a recipe (e.g. bottled drinks sold as-is)
  @OneToOne(() => Recipe, (recipe) => recipe.menuItem, {
    nullable: true,
    eager: true,
  })
  recipe!: Recipe | null;

  // Virtual — derived from relation, never stored
  get hasRecipe(): boolean {
    return this.recipe != null;
  }
}
