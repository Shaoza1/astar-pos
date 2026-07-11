import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTableDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  tableNumber!: string;

  @IsNumber()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  location?: string;
}
