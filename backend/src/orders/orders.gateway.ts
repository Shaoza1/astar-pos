import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import type {
  LowStockAlertDto,
  OrderDto,
  OrderItemDto,
} from '@astar-pos/shared';

@WebSocketGateway({
  cors: { origin: '*' }, // tightened in production via env var
  namespace: '/kitchen',
})
export class OrdersGateway {
  @WebSocketServer()
  server!: Server;

  emitNewOrder(order: OrderDto): void {
    this.server.emit('order:new', order);
  }

  emitOrderUpdated(order: OrderDto): void {
    this.server.emit('order:updated', order);
  }

  emitItemVoided(item: OrderItemDto): void {
    this.server.emit('order:item_voided', item);
  }

  emitItemServed(item: OrderItemDto): void {
    this.server.emit('order:item_served', item);
  }

  emitLowStockAlert(alert: LowStockAlertDto): void {
    this.server.emit('stock:low_alert', alert);
  }

  @SubscribeMessage('kitchen:ready')
  handleKitchenReady(@ConnectedSocket() client: Socket): void {
    void client.join('kitchen-display');
    client.emit('kitchen:connected', { message: 'Kitchen display connected' });
  }
}
