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
