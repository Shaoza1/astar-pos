import { IsIn, IsUUID } from 'class-validator';

export class VarianceFilterDto {
  @IsUUID()
  shiftReportId!: string;

  @IsIn(['all', 'shortages', 'overs'])
  filter!: 'all' | 'shortages' | 'overs';
}
