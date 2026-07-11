import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { TableSession } from './table-session.entity';

@Entity('tables')
export class RestaurantTable {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_number', type: 'varchar', length: 10, unique: true })
  tableNumber!: string;

  @Column({ type: 'integer', default: 2 })
  capacity!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  location!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => TableSession, (s) => s.table)
  sessions!: TableSession[];

  // Virtual — populated by service when loading tables with sessions
  currentSession?: TableSession | null;
}
