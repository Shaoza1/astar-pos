import { IsNumber, IsUUID, Min } from 'class-validator';

export class DeductStockForSaleDto {
  @IsUUID()
  orderItemId!: string;

  @IsUUID()
  menuItemId!: string;

  // Number of portions sold — multiplied against each recipe item quantity
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsUUID()
  performedBy!: string;
}
