import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateDeliveryItemDto {
  @IsUUID()
  ingredientId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityOrdered?: number;

  @IsNumber()
  @Min(0)
  quantityReceived!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;
}

export class CreateDeliveryDto {
  @IsString()
  supplierName!: string;

  @IsDateString()
  deliveryDate!: string;

  @IsOptional()
  @IsString()
  invoiceReference?: string;

  @IsUUID()
  recordedBy!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryItemDto)
  items!: CreateDeliveryItemDto[];
}
