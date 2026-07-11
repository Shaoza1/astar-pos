import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'table_name', type: 'varchar', length: 50 })
  tableName!: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId!: string;

  @Column({ type: 'varchar', length: 10 })
  action!: 'INSERT' | 'UPDATE' | 'DELETE';

  @Column({ name: 'old_data', type: 'jsonb', nullable: true })
  oldData!: object | null;

  @Column({ name: 'new_data', type: 'jsonb', nullable: true })
  newData!: object | null;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy!: string | null;

  @Column({
    name: 'performed_at',
    type: 'timestamptz',
    default: () => 'NOW()',
  })
  performedAt!: Date;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;
}
