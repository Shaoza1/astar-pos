import {
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order.dto';

export class AddItemsToOrderDto {
  @IsUUID()
  orderId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsUUID()
  addedBy!: string;
}

export class VoidOrderItemDto {
  @IsUUID()
  orderItemId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsUUID()
  voidedBy!: string;
}

export class MarkItemServedDto {
  @IsUUID()
  orderItemId!: string;

  @IsUUID()
  servedBy!: string;
}

export class CloseTableSessionDto {
  @IsUUID()
  tableSessionId!: string;

  @IsUUID()
  closedBy!: string;
}
