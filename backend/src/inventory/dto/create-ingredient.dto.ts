import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateIngredientDto {
  @IsUUID()
  groupId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  purchaseUnit!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  consumptionUnit!: string;

  // Must be positive — zero units per purchase is nonsensical
  @IsNumber()
  @Min(0.0001)
  unitsPerPurchase!: number;

  @IsNumber()
  @Min(0)
  lowStockThreshold!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerPurchaseUnit?: number;
}
