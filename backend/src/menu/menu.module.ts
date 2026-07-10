import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Ingredient } from '../inventory/entities/ingredient.entity';
import { MenuGroup } from './entities/menu-group.entity';
import { MenuItem } from './entities/menu-item.entity';
import { PriceHistory } from './entities/price-history.entity';
import { RecipeItem } from './entities/recipe-item.entity';
import { Recipe } from './entities/recipe.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenuGroup,
      MenuItem,
      Recipe,
      RecipeItem,
      PriceHistory,
      Ingredient,
    ]),
  ],
  controllers: [MenuController],
  providers: [MenuService],
  // Exported so the orders module can call deductStockForSale directly
  exports: [MenuService],
})
export class MenuModule {}
