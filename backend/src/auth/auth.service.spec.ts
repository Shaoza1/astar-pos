import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Staff } from '../staff/entities/staff.entity';
import { StaffSession } from '../staff/entities/staff-session.entity';
import { AuthService } from './auth.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  const s = new Staff();
  s.id = 'staff-1';
  s.fullName = 'Test User';
  s.role = 'waiter';
  s.isActive = true;
  s.createdAt = new Date('2026-01-01');
  s.updatedAt = new Date('2026-01-01');
  s.pinHash = '$2b$12$hashedpin';
  s.webAuthnCredentialId = null;
  s.webAuthnPublicKey = null;
  return Object.assign(s, overrides);
}

function makeSession(overrides: Partial<StaffSession> = {}): StaffSession {
  const s = new StaffSession();
  s.id = 'session-1';
  s.staffId = 'staff-1';
  s.clockedInAt = new Date();
  s.clockedOutAt = null;
  s.deviceIdentifier = 'terminal-1';
  s.clockInMethod = 'pin';
  s.flagged = false;
  s.flagReason = null;
  return Object.assign(s, overrides);
}

describe('AuthService', () => {
  let service: AuthService;
  let staffRepo: ReturnType<typeof mockRepo>;
  let sessionRepo: ReturnType<typeof mockRepo>;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    staffRepo = mockRepo();
    sessionRepo = mockRepo();
    jwtService = { sign: jest.fn().mockReturnValue('mock.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Staff), useValue: staffRepo },
        { provide: getRepositoryToken(StaffSession), useValue: sessionRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ── loginWithPin ──────────────────────────────────────────────────────────

  describe('loginWithPin', () => {
    function setupQb(staff: Staff | null) {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(staff ? [staff] : []),
      };
      staffRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('should return AuthResponseDto with JWT when PIN matches', async () => {
      const staff = makeStaff();
      staff.validatePin = jest.fn().mockResolvedValue(true);
      setupQb(staff);
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());

      const result = await service.loginWithPin({
        pin: '123456',
        deviceId: 'terminal-1',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.staff.id).toBe('staff-1');
      expect(result.sessionId).toBe('session-1');
    });

    it('should throw UnauthorizedException when PIN does not match any staff', async () => {
      const staff = makeStaff();
      staff.validatePin = jest.fn().mockResolvedValue(false);
      setupQb(staff);

      await expect(
        service.loginWithPin({ pin: '000000', deviceId: 'terminal-1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should create a staff_session record on successful login', async () => {
      const staff = makeStaff();
      staff.validatePin = jest.fn().mockResolvedValue(true);
      setupQb(staff);
      sessionRepo.create.mockReturnValue(makeSession());
      sessionRepo.save.mockResolvedValue(makeSession());

      await service.loginWithPin({ pin: '123456', deviceId: 'terminal-1' });

      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when staff is inactive', async () => {
      // Inactive staff are filtered out by the query (is_active = true)
      setupQb(null);

      await expect(
        service.loginWithPin({ pin: '123456', deviceId: 'terminal-1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── clockOut ──────────────────────────────────────────────────────────────

  describe('clockOut', () => {
    it('should set clockedOutAt on the session', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((s: StaffSession) =>
        Promise.resolve(s),
      );

      const result = await service.clockOut({
        sessionId: 'session-1',
        deviceId: 'terminal-1',
      });

      expect(result.clockedOutAt).toBeInstanceOf(Date);
    });

    it('should flag the session when clock-out device differs from clock-in device', async () => {
      const session = makeSession({ deviceIdentifier: 'terminal-1' });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((s: StaffSession) =>
        Promise.resolve(s),
      );

      const result = await service.clockOut({
        sessionId: 'session-1',
        deviceId: 'terminal-2', // different device
      });

      expect(result.flagged).toBe(true);
    });

    it('should set flagReason when flagged', async () => {
      const session = makeSession({ deviceIdentifier: 'terminal-1' });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((s: StaffSession) =>
        Promise.resolve(s),
      );

      const result = await service.clockOut({
        sessionId: 'session-1',
        deviceId: 'terminal-2',
      });

      expect(result.flagReason).toMatch(/device/i);
    });

    it('should NOT flag when same device is used for clock-in and clock-out', async () => {
      const session = makeSession({ deviceIdentifier: 'terminal-1' });
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockImplementation((s: StaffSession) =>
        Promise.resolve(s),
      );

      const result = await service.clockOut({
        sessionId: 'session-1',
        deviceId: 'terminal-1', // same device
      });

      expect(result.flagged).toBe(false);
    });
  });

  // ── getActiveSessions ─────────────────────────────────────────────────────

  describe('getActiveSessions', () => {
    it('should return only sessions where clockedOutAt is null', async () => {
      const session = makeSession();
      (session as StaffSession & { staff: Staff }).staff = makeStaff();
      sessionRepo.find.mockResolvedValue([session]);

      const result = await service.getActiveSessions();

      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].clockedOutAt).toBeNull();
    });

    it('should include flaggedCount in the response', async () => {
      const s1 = makeSession({ flagged: true });
      (s1 as StaffSession & { staff: Staff }).staff = makeStaff();
      const s2 = makeSession({ id: 'session-2', flagged: false });
      (s2 as StaffSession & { staff: Staff }).staff = makeStaff();
      sessionRepo.find.mockResolvedValue([s1, s2]);

      const result = await service.getActiveSessions();

      expect(result.flaggedCount).toBe(1);
    });
  });
});
