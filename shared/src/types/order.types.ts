export type TableStatus = 'available' | 'occupied' | 'reserved';
export type OrderStatus = 'pending' | 'sent_to_kitchen' | 'ready' | 'served' | 'cancelled';
export type OrderItemStatus = 'pending' | 'sent' | 'ready' | 'served' | 'voided';

export interface TableDto {
  id: string;
  tableNumber: string;
  capacity: number;
  location: string | null;
  isActive: boolean;
  currentSession: TableSessionDto | null;
}

export interface TableSessionDto {
  id: string;
  tableId: string;
  tableNumber: string;
  openedBy: string;
  openedByName: string;
  openedAt: string;
  closedAt: string | null;
  guestCount: number | null;
  isFlagged: boolean;
  flagReason: string | null;
  orders: OrderDto[];
  totalAmount: number;
  isOpen: boolean;
}

export interface OrderDto {
  id: string;
  tableSessionId: string;
  takenBy: string;
  takenByName: string;
  createdAt: string;
  status: OrderStatus;
  notes: string | null;
  items: OrderItemDto[];
  subtotal: number;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: Record<string, string> | null;
  status: OrderItemStatus;
  isVoided: boolean;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: string | null;
}

export interface CreateTableDto {
  tableNumber: string;
  capacity: number;
  location?: string;
}

export interface OpenTableSessionDto {
  tableId: string;
  guestCount?: number;
  openedBy: string;
}

export interface CreateOrderDto {
  tableSessionId: string;
  takenBy: string;
  notes?: string;
  items: CreateOrderItemDto[];
}

export interface CreateOrderItemDto {
  menuItemId: string;
  quantity: number;
  modifiers?: Record<string, string>;
}

export interface AddItemsToOrderDto {
  orderId: string;
  items: CreateOrderItemDto[];
  addedBy: string;
}

export interface VoidOrderItemDto {
  orderItemId: string;
  reason: string;
  voidedBy: string;
}

export interface MarkItemServedDto {
  orderItemId: string;
  servedBy: string;
}

export interface CloseTableSessionDto {
  tableSessionId: string;
  closedBy: string;
}

export interface SplitBillDto {
  tableSessionId: string;
  splits: {
    orderItemIds: string[];
    paymentMethod: 'cash' | 'card' | 'staff_account';
    paymentReference?: string;
  }[];
  processedBy: string;
}
