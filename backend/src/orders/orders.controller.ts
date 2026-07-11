import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { OrderStatus } from '@astar-pos/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AddItemsToOrderDto,
  CloseTableSessionDto,
  MarkItemServedDto,
  VoidOrderItemDto,
} from './dto/orders-actions.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { OpenTableSessionDto } from './dto/open-table-session.dto';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Tables ───────────────────────────────────────────────────────────────

  @Get('tables')
  findAllTables() {
    return this.ordersService.findAllTables();
  }

  @Roles('owner', 'manager')
  @Post('tables')
  @HttpCode(201)
  createTable(@Body() dto: CreateTableDto) {
    return this.ordersService.createTable(dto);
  }

  @Get('tables/:id')
  findTableById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findTableById(id);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  @Post('sessions/open')
  @HttpCode(201)
  openSession(@Body() dto: OpenTableSessionDto) {
    return this.ordersService.openSession(dto);
  }

  @Roles('owner', 'manager')
  @Post('sessions/close')
  @HttpCode(200)
  closeSession(@Body() dto: CloseTableSessionDto) {
    return this.ordersService.closeSession(dto);
  }

  @Roles('owner', 'manager')
  @Get('sessions/flagged')
  getFlaggedSessions() {
    return this.ordersService.getFlaggedSessions();
  }

  @Get('sessions/:id')
  getSessionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.getSessionById(id);
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Post(':id/items')
  @HttpCode(201)
  addItemsToOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemsToOrderDto,
  ) {
    return this.ordersService.addItemsToOrder({ ...dto, orderId: id });
  }

  @Roles('owner', 'manager', 'barman')
  @Patch('items/:id/void')
  voidOrderItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidOrderItemDto,
  ) {
    return this.ordersService.voidOrderItem({ ...dto, orderItemId: id });
  }

  @Patch('items/:id/served')
  markItemServed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkItemServedDto,
  ) {
    return this.ordersService.markItemServed({ ...dto, orderItemId: id });
  }

  @Roles('owner', 'manager')
  @Patch(':id/status')
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: OrderStatus; updatedBy: string },
  ) {
    return this.ordersService.updateOrderStatus(
      id,
      body.status,
      body.updatedBy,
    );
  }
}
