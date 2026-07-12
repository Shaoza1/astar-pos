import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Ingredient } from '../inventory/entities/ingredient.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ShiftReport } from '../payments/entities/shift-report.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { Staff } from '../staff/entities/staff.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { Delivery } from './entities/delivery.entity';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Delivery,
      DeliveryItem,
      ShiftReport,
      Ingredient,
      OrderItem,
      Transaction,
      Staff,
    ]),
    InventoryModule,
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
