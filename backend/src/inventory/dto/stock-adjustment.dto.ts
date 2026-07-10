import {
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class StockAdjustmentDto {
  @IsUUID()
  ingredientId!: string;

  // Negative = remove stock, positive = add stock
  @IsNumber()
  quantityChange!: number;

  // Reason is mandatory — every manual adjustment must be explainable
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsUUID()
  performedBy!: string;
}
