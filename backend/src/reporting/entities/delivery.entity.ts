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
import { DeliveryItem } from './delivery-item.entity';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'supplier_name', type: 'varchar', length: 100 })
  supplierName!: string;

  @Column({ name: 'delivery_date', type: 'date' })
  deliveryDate!: string;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'recorded_by' })
  recordedByStaff!: Staff;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({
    name: 'invoice_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  invoiceReference!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'verified' | 'disputed';

  @OneToMany(() => DeliveryItem, (item) => item.delivery, { cascade: true })
  items!: DeliveryItem[];
}
