// Shared menu types — consumed by both frontend and backend

export interface MenuGroupDto {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RecipeItemDto {
  id: string;
  ingredientId: string;
  ingredientName: string;
  consumptionUnit: string;
  quantity: number;
  isOptional: boolean;
  optionGroup: string | null;
}

export interface RecipeDto {
  id: string;
  menuItemId: string;
  serves: number;
  notes: string | null;
  items: RecipeItemDto[];
}

export interface MenuItemDto {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  isComp: boolean;
  hasRecipe: boolean;
  recipe: RecipeDto | null;
}

export interface CreateMenuItemDto {
  groupId: string;
  name: string;
  description?: string;
  price: number;
  isComp?: boolean;
}

export interface UpdateMenuItemDto extends Partial<CreateMenuItemDto> {
  isActive?: boolean;
}

export interface CreateRecipeItemDto {
  ingredientId: string;
  quantity: number;
  isOptional?: boolean;
  optionGroup?: string;
}

export interface CreateRecipeDto {
  menuItemId: string;
  serves?: number;
  notes?: string;
  items: CreateRecipeItemDto[];
}

export interface DeductStockForSaleDto {
  // Called when an order_item is marked as served
  orderItemId: string;
  menuItemId: string;
  quantity: number; // number of portions sold
  performedBy: string; // staff id
}

export interface StockDeductionResultDto {
  success: boolean;
  deductions: {
    ingredientId: string;
    ingredientName: string;
    quantityDeducted: number;
    consumptionUnit: string;
  }[];
  warnings: {
    // Populated if any ingredient fell to low-stock or out after deduction
    ingredientId: string;
    ingredientName: string;
    newStock: number;
    stockStatus: 'low' | 'out';
  }[];
}
