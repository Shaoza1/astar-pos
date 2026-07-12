import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

class ActualCountItem {
  @IsUUID()
  ingredientId!: string;

  @IsNumber()
  @Min(0)
  actualCount!: number;
}

export class SubmitActualCountsDto {
  @IsUUID()
  shiftReportId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActualCountItem)
  counts!: ActualCountItem[];

  @IsUUID()
  submittedBy!: string;
}
