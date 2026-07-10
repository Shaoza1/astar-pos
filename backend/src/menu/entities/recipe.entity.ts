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

import { MenuItem } from './menu-item.entity';
import { RecipeItem } from './recipe-item.entity';

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => MenuItem, (item) => item.recipe)
  @JoinColumn({ name: 'menu_item_id' })
  menuItem!: MenuItem;

  @Column({ name: 'menu_item_id', type: 'uuid' })
  menuItemId!: string;

  @Column({ type: 'int', default: 1 })
  serves!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => RecipeItem, (item) => item.recipe, {
    eager: true,
    cascade: true,
  })
  items!: RecipeItem[];
}
