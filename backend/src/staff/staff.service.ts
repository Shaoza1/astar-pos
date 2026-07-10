import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import type { StaffDto } from '@astar-pos/shared';
import { Staff } from './entities/staff.entity';
import { ChangePinDto } from './dto/update-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

const BCRYPT_ROUNDS = 12;
const PIN_REGEX = /^\d{6}$/;

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {}

  async findAll(includeInactive = false): Promise<StaffDto[]> {
    const staff = await this.staffRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { fullName: 'ASC' },
    });
    return staff.map((s) => this.toDto(s));
  }

  async findOne(id: string): Promise<StaffDto> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException(`Staff ${id} not found`);
    return this.toDto(staff);
  }

  async create(dto: CreateStaffDto): Promise<StaffDto> {
    if (!PIN_REGEX.test(dto.pin)) {
      throw new BadRequestException('PIN must be exactly 6 digits');
    }
    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    const staff = this.staffRepo.create({
      fullName: dto.fullName,
      role: dto.role,
      pinHash,
    });
    const saved = await this.staffRepo.save(staff);
    return this.toDto(saved);
  }

  async update(id: string, dto: UpdateStaffDto): Promise<StaffDto> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException(`Staff ${id} not found`);
    Object.assign(staff, dto);
    const saved = await this.staffRepo.save(staff);
    return this.toDto(saved);
  }

  async deactivate(id: string): Promise<void> {
    const staff = await this.staffRepo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException(`Staff ${id} not found`);
    staff.isActive = false;
    await this.staffRepo.save(staff);
  }

  async changePin(dto: ChangePinDto): Promise<void> {
    if (!PIN_REGEX.test(dto.newPin)) {
      throw new BadRequestException('New PIN must be exactly 6 digits');
    }

    // Explicitly select pin_hash — it has select: false by default
    const staff = await this.staffRepo
      .createQueryBuilder('s')
      .addSelect('s.pin_hash')
      .where('s.id = :id', { id: dto.staffId })
      .getOne();

    if (!staff) throw new NotFoundException(`Staff ${dto.staffId} not found`);

    const valid = await staff.validatePin(dto.currentPin);
    if (!valid) throw new UnauthorizedException('Current PIN is incorrect');

    staff.pinHash = await bcrypt.hash(dto.newPin, BCRYPT_ROUNDS);
    await this.staffRepo.save(staff);
  }

  // pinHash is never included — toDto only maps safe fields
  private toDto(staff: Staff): StaffDto {
    return {
      id: staff.id,
      fullName: staff.fullName,
      role: staff.role,
      isActive: staff.isActive,
      createdAt: staff.createdAt.toISOString(),
    };
  }
}
