import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('groups')
  findAllGroups() {
    return this.inventoryService.findAllGroups();
  }

  @Get('ingredients')
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.inventoryService.findAll(includeInactive === 'true');
  }

  @Get('ingredients/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id);
  }

  @Roles('owner', 'manager')
  @Post('ingredients')
  @HttpCode(201)
  create(@Body() dto: CreateIngredientDto) {
    return this.inventoryService.create(dto);
  }

  @Roles('owner', 'manager')
  @Patch('ingredients/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.inventoryService.update(id, dto);
  }

  @Roles('owner', 'manager')
  @Delete('ingredients/:id')
  @HttpCode(204)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.deactivate(id);
  }

  @Roles('owner', 'manager')
  @Post('stock/adjust')
  @HttpCode(201)
  adjustStock(@Body() dto: StockAdjustmentDto) {
    return this.inventoryService.adjustStock(dto);
  }

  @Get('stock/alerts')
  getLowStockAlerts() {
    return this.inventoryService.getLowStockAlerts();
  }

  @Get('stock/movements/:id')
  getStockMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getStockMovements(
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
