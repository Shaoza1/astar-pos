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

export type PaymentMethod = 'cash' | 'card' | 'staff_account' | 'split';
export type TransactionStatus = 'pending' | 'completed' | 'refunded' | 'failed';
export type ShiftName = 'morning' | 'evening';

export interface ProcessPaymentDto {
  tableSessionId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  processedBy: string;
  paymentReference?: string;
  staffAccountId?: string;
}

export interface ProcessSplitPaymentDto {
  tableSessionId: string;
  processedBy: string;
  splits: {
    amount: number;
    paymentMethod: 'cash' | 'card' | 'staff_account';
    paymentReference?: string;
    staffAccountId?: string;
  }[];
}

export interface TransactionDto {
  id: string;
  tableSessionId: string;
  processedBy: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  paidAt: string;
  splits: TransactionSplitDto[];
}

export interface TransactionSplitDto {
  id: string;
  transactionId: string;
  splitAmount: number;
  paymentMethod: 'cash' | 'card' | 'staff_account';
  paymentReference: string | null;
}

export interface InitiateCardPaymentDto {
  amount: number;
  currency: string;
  reference: string;
  provider: 'yoco' | 'peach';
}

export interface CardPaymentResultDto {
  success: boolean;
  reference: string;
  provider: string;
  rawResponse: Record<string, unknown>;
}

export interface StaffAccountDto {
  id: string;
  staffId: string;
  staffName: string;
  balance: number;
  creditLimit: number;
}

export interface ChargeStaffAccountDto {
  staffAccountId: string;
  amount: number;
  description: string;
  createdBy: string;
}

export interface OpenShiftDto {
  shift: ShiftName;
  openedBy: string;
  openingCashFloat: number;
}

export interface CloseShiftDto {
  shiftReportId: string;
  closedBy: string;
  actualCashInTill: number;
}

export interface ShiftReportDto {
  id: string;
  shiftDate: string;
  shift: ShiftName;
  openedBy: string;
  closedBy: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCashFloat: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalStaffAccount: number;
  totalVoids: number;
  actualCashInTill: number | null;
  expectedCashInTill: number | null;
  cashVariance: number | null;
  isOpen: boolean;
}
