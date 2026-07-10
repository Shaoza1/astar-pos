import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { StaffRole } from '@astar-pos/shared';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsIn(['owner', 'manager', 'waiter', 'barman', 'kitchen'])
  role?: StaffRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ChangePinDto {
  @IsUUID()
  staffId!: string;

  @Matches(/^\d{6}$/, { message: 'Current PIN must be exactly 6 digits' })
  currentPin!: string;

  @Matches(/^\d{6}$/, { message: 'New PIN must be exactly 6 digits' })
  newPin!: string;
}
