import * as bcrypt from 'bcrypt';
import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { StaffRole } from '@astar-pos/shared';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: StaffRole;

  // select: false — never returned in queries unless explicitly selected
  @Column({ name: 'pin_hash', type: 'varchar', length: 255, select: false })
  pinHash!: string;

  @Column({
    name: 'webauthn_credential_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  webAuthnCredentialId!: string | null;

  @Column({
    name: 'webauthn_public_key',
    type: 'text',
    nullable: true,
    select: false,
  })
  webAuthnPublicKey!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Populated only when pinHash was explicitly selected in the query
  async validatePin(plainPin: string): Promise<boolean> {
    if (!this.pinHash) return false;
    return bcrypt.compare(plainPin, this.pinHash);
  }

  // Virtual field — not stored, derived after load
  stockStatus?: string;

  @AfterLoad()
  computeDefaults() {
    this.webAuthnCredentialId ??= null;
    this.webAuthnPublicKey ??= null;
  }
}
