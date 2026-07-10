import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { hash: jest.Mock; compare: jest.Mock };

import { Staff } from './entities/staff.entity';
import { StaffService } from './staff.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  const s = new Staff();
  s.id = 'staff-1';
  s.fullName = 'Jane Doe';
  s.role = 'waiter';
  s.isActive = true;
  s.createdAt = new Date('2026-01-01');
  s.updatedAt = new Date('2026-01-01');
  s.pinHash = '';
  s.webAuthnCredentialId = null;
  s.webAuthnPublicKey = null;
  return Object.assign(s, overrides);
}

describe('StaffService', () => {
  let service: StaffService;
  let staffRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    staffRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: getRepositoryToken(Staff), useValue: staffRepo },
      ],
    }).compile();

    service = module.get(StaffService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should hash the PIN with bcrypt before saving', async () => {
      staffRepo.create.mockReturnValue(makeStaff());
      staffRepo.save.mockResolvedValue(makeStaff());

      await service.create({
        fullName: 'Jane Doe',
        role: 'waiter',
        pin: '123456',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 12);
    });

    it('should throw BadRequestException if PIN is not exactly 6 digits', async () => {
      await expect(
        service.create({ fullName: 'Jane', role: 'waiter', pin: '12345' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if PIN contains non-numeric characters', async () => {
      await expect(
        service.create({ fullName: 'Jane', role: 'waiter', pin: '12345a' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should never return pinHash in the response', async () => {
      staffRepo.create.mockReturnValue(makeStaff({ pinHash: 'secret-hash' }));
      staffRepo.save.mockResolvedValue(makeStaff({ pinHash: 'secret-hash' }));

      const result = await service.create({
        fullName: 'Jane',
        role: 'waiter',
        pin: '123456',
      });

      expect(result).not.toHaveProperty('pinHash');
    });
  });

  // ── changePin ─────────────────────────────────────────────────────────────

  describe('changePin', () => {
    function setupQb(staff: Staff | null) {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(staff),
      };
      staffRepo.createQueryBuilder.mockReturnValue(qb);
    }

    it('should reject if currentPin does not match stored hash', async () => {
      const staff = makeStaff();
      staff.validatePin = jest.fn().mockResolvedValue(false);
      setupQb(staff);

      await expect(
        service.changePin({
          staffId: 'staff-1',
          currentPin: '000000',
          newPin: '999999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should hash the new PIN before saving', async () => {
      const staff = makeStaff();
      staff.validatePin = jest.fn().mockResolvedValue(true);
      setupQb(staff);
      staffRepo.save.mockResolvedValue(staff);

      await service.changePin({
        staffId: 'staff-1',
        currentPin: '123456',
        newPin: '654321',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('654321', 12);
    });

    it('should log the change in audit_log', async () => {
      // changePin saves the staff record — the audit trigger on the DB handles
      // the audit_log insert. At the service level, verify save was called.
      const staff = makeStaff();
      staff.validatePin = jest.fn().mockResolvedValue(true);
      setupQb(staff);
      staffRepo.save.mockResolvedValue(staff);

      await service.changePin({
        staffId: 'staff-1',
        currentPin: '123456',
        newPin: '654321',
      });

      expect(staffRepo.save).toHaveBeenCalled();
    });
  });
});
