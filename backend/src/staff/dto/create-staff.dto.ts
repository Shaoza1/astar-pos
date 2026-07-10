import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import type { StaffRole } from '@astar-pos/shared';

export class CreateStaffDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsIn(['owner', 'manager', 'waiter', 'barman', 'kitchen'])
  role!: StaffRole;

  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin!: string;
}
