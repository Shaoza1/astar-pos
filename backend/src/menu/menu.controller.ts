import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { DeductStockForSaleDto } from './dto/deduct-stock-for-sale.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuService } from './menu.service';

@UseGuards(JwtAuthGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('groups')
  findAllGroups() {
    return this.menuService.findAllGroups();
  }

  @Get('items')
  findAll(
    @Query('groupId') groupId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.menuService.findAll(groupId, includeInactive === 'true');
  }

  @Get('items/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.findOne(id);
  }

  @Post('items')
  @HttpCode(201)
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuService.create(dto);
  }

  @Patch('items/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.update(id, dto);
  }

  @Post('recipes')
  @HttpCode(201)
  createOrUpdateRecipe(@Body() dto: CreateRecipeDto) {
    return this.menuService.createOrUpdateRecipe(dto);
  }

  @Get('recipes/:menuItemId')
  getRecipe(@Param('menuItemId', ParseUUIDPipe) menuItemId: string) {
    return this.menuService.getRecipe(menuItemId);
  }

  @Post('stock/deduct')
  @HttpCode(201)
  deductStockForSale(@Body() dto: DeductStockForSaleDto) {
    return this.menuService.deductStockForSale(dto);
  }
}
