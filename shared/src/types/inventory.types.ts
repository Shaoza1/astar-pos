// Shared inventory types — consumed by both frontend and backend

export type MovementType = 'sale' | 'delivery' | 'adjustment' | 'waste' | 'void_reversal';

export interface IngredientGroupDto {
  id: string;
  name: string;
  sortOrder: number;
}

export interface IngredientDto {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  purchaseUnit: string;
  consumptionUnit: string;
  unitsPerPurchase: number;
  lowStockThreshold: number;
  currentStock: number; // always in consumption units
  costPerPurchaseUnit: number | null;
  isActive: boolean;
  stockStatus: 'ok' | 'low' | 'out'; // derived, not stored
}

export interface CreateIngredientDto {
  groupId: string;
  name: string;
  purchaseUnit: string;
  consumptionUnit: string;
  unitsPerPurchase: number;
  lowStockThreshold: number;
  costPerPurchaseUnit?: number;
}

export interface UpdateIngredientDto extends Partial<CreateIngredientDto> {
  isActive?: boolean;
}

export interface StockAdjustmentDto {
  ingredientId: string;
  quantityChange: number; // in consumption units — negative = remove, positive = add
  reason: string; // mandatory for all manual adjustments
  performedBy: string; // staff id
}

export interface StockMovementDto {
  id: string;
  ingredientId: string;
  ingredientName: string;
  movementType: MovementType;
  quantityChange: number;
  referenceId: string | null;
  referenceType: string | null;
  performedBy: string;
  performedAt: string;
  notes: string | null;
}

export interface LowStockAlertDto {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  lowStockThreshold: number;
  consumptionUnit: string;
  stockStatus: 'low' | 'out';
}

export interface VarianceReportRowDto {
  ingredientId: string;
  ingredientName: string;
  ingredientGroup: string;
  consumptionUnit: string;
  openingStock: number;
  stockReceived: number;
  expectedConsumption: number;
  actualCount: number;
  variance: number;
  varianceType: 'shortage' | 'over' | 'exact';
  stockStatus: 'ok' | 'low' | 'out';
}

export interface VarianceReportDto {
  id: string;
  shiftReportId: string;
  shiftDate: string;
  shift: string;
  rows: VarianceReportRowDto[];
  totalShortages: number;
  totalOvers: number;
  significantShortages: number;
  generatedAt: string;
}

export interface VarianceFilterDto {
  filter: 'all' | 'shortages' | 'overs';
  shiftReportId: string;
}

export interface SubmitActualCountsDto {
  shiftReportId: string;
  counts: {
    ingredientId: string;
    actualCount: number;
  }[];
  submittedBy: string;
}

export interface SalesSummaryDto {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  totalVoids: number;
  voidValue: number;
  averageTableSpend: number;
  byGroup: {
    groupName: string;
    revenue: number;
    itemsSold: number;
    percentage: number;
  }[];
  topItems: {
    menuItemId: string;
    menuItemName: string;
    quantitySold: number;
    revenue: number;
  }[];
  byStaff: {
    staffId: string;
    staffName: string;
    totalSales: number;
    tablesClosed: number;
  }[];
  byHour: {
    hour: number;
    revenue: number;
    orderCount: number;
  }[];
}

export interface DeliveryDto {
  id: string;
  supplierName: string;
  deliveryDate: string;
  recordedBy: string;
  invoiceReference: string | null;
  status: 'pending' | 'verified' | 'disputed';
  items: DeliveryItemDto[];
  totalDiscrepancyItems: number;
}

export interface DeliveryItemDto {
  id: string;
  ingredientId: string;
  ingredientName: string;
  purchaseUnit: string;
  quantityOrdered: number | null;
  quantityReceived: number;
  discrepancy: number;
  costPerUnit: number | null;
}

export interface CreateDeliveryDto {
  supplierName: string;
  deliveryDate: string;
  invoiceReference?: string;
  recordedBy: string;
  items: {
    ingredientId: string;
    quantityOrdered?: number;
    quantityReceived: number;
    costPerUnit?: number;
  }[];
}

export interface ChartDataDto {
  topVariances: {
    ingredientName: string;
    variance: number;
    varianceType: 'shortage' | 'over';
  }[];
  topSellingItems: {
    menuItemName: string;
    quantitySold: number;
    revenue: number;
  }[];
  revenueByShift: {
    date: string;
    morning: number;
    evening: number;
  }[];
  stockLevelSummary: {
    ok: number;
    low: number;
    out: number;
  };
}
