import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MenuItem } from '../menu/entities/menu-item.entity';
import { MenuModule } from '../menu/menu.module';
import { AuditLog } from './entities/audit-log.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { TableSession } from './entities/table-session.entity';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantTable,
      TableSession,
      Order,
      OrderItem,
      MenuItem,
      AuditLog,
    ]),
    MenuModule, // imports MenuService.deductStockForSale
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService],
})
export class OrdersModule {}
