import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Staff } from './staff.entity';

@Entity('staff_sessions')
export class StaffSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'staff_id', type: 'uuid' })
  staffId!: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id' })
  staff!: Staff;

  @CreateDateColumn({ name: 'clocked_in_at', type: 'timestamptz' })
  clockedInAt!: Date;

  @Column({ name: 'clocked_out_at', type: 'timestamptz', nullable: true })
  clockedOutAt!: Date | null;

  @Column({
    name: 'device_identifier',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  deviceIdentifier!: string | null;

  @Column({
    name: 'clock_in_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  clockInMethod!: 'pin' | 'biometric' | null;

  @Column({ name: 'flagged', type: 'boolean', default: false })
  flagged!: boolean;

  @Column({ name: 'flag_reason', type: 'text', nullable: true })
  flagReason!: string | null;
}
