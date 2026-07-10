import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type { ActiveSessionsDto, AuthResponseDto } from '@astar-pos/shared';
import { Staff } from '../staff/entities/staff.entity';
import { StaffSession } from '../staff/entities/staff-session.entity';
import { ClockOutDto } from './dto/clock-out.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { WebAuthnLoginDto } from './dto/webauthn-login.dto';
import { WebAuthnRegistrationDto } from './dto/webauthn-registration.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

// Sessions open longer than this are auto-flagged in getActiveSessions
const MAX_SESSION_HOURS = 4;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(StaffSession)
    private readonly sessionRepo: Repository<StaffSession>,
    private readonly jwtService: JwtService,
  ) {}

  // ── PIN Authentication ───────────────────────────────────────────────────

  async loginWithPin(dto: PinLoginDto): Promise<AuthResponseDto> {
    // Load all active staff WITH pin_hash explicitly selected
    const allActive = await this.staffRepo
      .createQueryBuilder('s')
      .addSelect('s.pin_hash')
      .where('s.is_active = true')
      .getMany();

    let matched: Staff | null = null;
    for (const staff of allActive) {
      if (await staff.validatePin(dto.pin)) {
        matched = staff;
        break;
      }
    }

    if (!matched) throw new UnauthorizedException('Invalid PIN');

    return this.createSessionAndToken(matched, 'pin', dto.deviceId);
  }

  // ── WebAuthn Registration ────────────────────────────────────────────────

  async registerWebAuthn(dto: WebAuthnRegistrationDto): Promise<void> {
    // TODO: full FIDO2 challenge flow in v2
    await this.staffRepo.update(dto.staffId, {
      webAuthnCredentialId: dto.credentialId,
      webAuthnPublicKey: dto.publicKey,
    });
  }

  // ── WebAuthn Authentication ──────────────────────────────────────────────

  async loginWithWebAuthn(dto: WebAuthnLoginDto): Promise<AuthResponseDto> {
    // TODO: full assertion verification in v2
    const staff = await this.staffRepo
      .createQueryBuilder('s')
      .addSelect('s.webauthn_credential_id')
      .addSelect('s.webauthn_public_key')
      .where('s.webauthn_credential_id = :id', { id: dto.credentialId })
      .andWhere('s.is_active = true')
      .getOne();

    if (!staff) throw new UnauthorizedException('Credential not recognised');

    // Simplified v1 signature check — verifies credential exists and is active
    // Full FIDO2 assertion verification (challenge, counter, flags) in v2
    return this.createSessionAndToken(staff, 'biometric', dto.deviceId);
  }

  // ── Clock Out ────────────────────────────────────────────────────────────

  async clockOut(dto: ClockOutDto): Promise<StaffSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: dto.sessionId, clockedOutAt: IsNull() },
    });
    if (!session)
      throw new UnauthorizedException('Session not found or already closed');

    session.clockedOutAt = new Date();

    if (dto.deviceId !== session.deviceIdentifier) {
      session.flagged = true;
      session.flagReason = 'Clock-out device differs from clock-in device';
    }

    return this.sessionRepo.save(session);
  }

  // ── Active Sessions ──────────────────────────────────────────────────────

  async getActiveSessions(): Promise<ActiveSessionsDto> {
    const sessions = await this.sessionRepo.find({
      where: { clockedOutAt: IsNull() },
      relations: { staff: true },
    });

    const now = Date.now();
    const maxMs = MAX_SESSION_HOURS * 60 * 60 * 1000;

    const mapped = sessions.map((s) => {
      const openTooLong = now - s.clockedInAt.getTime() > maxMs;
      if (openTooLong && !s.flagged) {
        s.flagged = true;
        s.flagReason = `Session open longer than ${MAX_SESSION_HOURS} hours`;
      }
      return {
        id: s.id,
        staffId: s.staffId,
        staffName: s.staff?.fullName ?? 'Unknown',
        clockedInAt: s.clockedInAt.toISOString(),
        clockedOutAt: null,
        deviceIdentifier: s.deviceIdentifier ?? '',
        clockInMethod: s.clockInMethod ?? 'pin',
        flagged: s.flagged,
        flagReason: s.flagReason,
      };
    });

    return {
      sessions: mapped,
      flaggedCount: mapped.filter((s) => s.flagged).length,
    };
  }

  // ── JWT Payload Validation (called by JwtStrategy) ───────────────────────

  async validateJwtPayload(payload: JwtPayload): Promise<boolean> {
    const staff = await this.staffRepo.findOne({
      where: { id: payload.sub, isActive: true },
    });
    if (!staff) return false;

    const session = await this.sessionRepo.findOne({
      where: { id: payload.sessionId, clockedOutAt: IsNull() },
    });
    return !!session;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async createSessionAndToken(
    staff: Staff,
    method: 'pin' | 'biometric',
    deviceId: string,
  ): Promise<AuthResponseDto> {
    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        staffId: staff.id,
        clockInMethod: method,
        deviceIdentifier: deviceId,
        clockedOutAt: null,
        flagged: false,
        flagReason: null,
      }),
    );

    const payload: JwtPayload = {
      sub: staff.id,
      role: staff.role,
      sessionId: session.id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        role: staff.role,
        isActive: staff.isActive,
        createdAt: staff.createdAt.toISOString(),
      },
      sessionId: session.id,
    };
  }
}
