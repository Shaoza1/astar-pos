import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class OpenTableSessionDto {
  @IsUUID()
  tableId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  guestCount?: number;

  @IsUUID()
  openedBy!: string;
}
