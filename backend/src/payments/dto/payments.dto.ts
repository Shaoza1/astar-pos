import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessPaymentDto {
  @IsUUID()
  tableSessionId!: string;

  @IsIn(['cash', 'card', 'staff_account', 'split'])
  paymentMethod!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsUUID()
  processedBy!: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsUUID()
  staffAccountId?: string;
}

class SplitItemDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsIn(['cash', 'card', 'staff_account'])
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsUUID()
  staffAccountId?: string;
}

export class ProcessSplitPaymentDto {
  @IsUUID()
  tableSessionId!: string;

  @IsUUID()
  processedBy!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  splits!: SplitItemDto[];
}

export class ChargeStaffAccountDto {
  @IsUUID()
  staffAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  description!: string;

  @IsUUID()
  createdBy!: string;
}

export class OpenShiftDto {
  @IsIn(['morning', 'evening'])
  shift!: string;

  @IsUUID()
  openedBy!: string;

  @IsNumber()
  @Min(0)
  openingCashFloat!: number;
}

export class CloseShiftDto {
  @IsUUID()
  shiftReportId!: string;

  @IsUUID()
  closedBy!: string;

  @IsNumber()
  @Min(0)
  actualCashInTill!: number;
}
