import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IngredientGroup } from './entities/ingredient-group.entity';
import { Ingredient } from './entities/ingredient.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IngredientGroup, Ingredient, StockMovement]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  // Exported so other modules (recipes, orders) can inject InventoryService directly
  exports: [InventoryService],
})
export class InventoryModule {}
