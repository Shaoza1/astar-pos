import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRecipeItemDto {
  @IsUUID()
  ingredientId!: string;

  // Quantity in consumption units — must be positive
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  optionGroup?: string;
}

export class CreateRecipeDto {
  @IsUUID()
  menuItemId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  serves?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeItemDto)
  items!: CreateRecipeItemDto[];
}
