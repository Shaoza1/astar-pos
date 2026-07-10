import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Ingredient } from '../inventory/entities/ingredient.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { MenuGroup } from './entities/menu-group.entity';
import { MenuItem } from './entities/menu-item.entity';
import { PriceHistory } from './entities/price-history.entity';
import { RecipeItem } from './entities/recipe-item.entity';
import { Recipe } from './entities/recipe.entity';
import { MenuService } from './menu.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  const i = new Ingredient();
  i.id = 'ing-1';
  i.name = 'Bacon';
  i.consumptionUnit = 'rasher';
  i.currentStock = 20;
  i.lowStockThreshold = 5;
  i.isActive = true;
  return Object.assign(i, overrides);
}

function makeRecipeItem(ingredient: Ingredient, quantity: number): RecipeItem {
  const ri = new RecipeItem();
  ri.id = 'ri-1';
  ri.ingredientId = ingredient.id;
  ri.ingredient = ingredient;
  ri.quantity = quantity;
  ri.isOptional = false;
  ri.optionGroup = null;
  return ri;
}

function makeRecipe(items: RecipeItem[]): Recipe {
  const r = new Recipe();
  r.id = 'recipe-1';
  r.menuItemId = 'item-1';
  r.serves = 1;
  r.notes = null;
  r.items = items;
  return r;
}

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  const m = new MenuItem();
  m.id = 'item-1';
  m.name = 'Butlers Breakfast';
  m.groupId = 'group-1';
  m.price = 75;
  m.isActive = true;
  m.isComp = false;
  m.description = null;
  m.recipe = null;
  return Object.assign(m, overrides);
}

// ── Mock factories ────────────────────────────────────────────────────────────

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

function makeQueryRunner(managerOverrides: Record<string, jest.Mock> = {}) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest
        .fn()

        .mockImplementation((_cls: unknown, data: unknown) => ({
          ...(data as object),
        })),
      save: jest
        .fn()

        .mockImplementation((_cls: unknown, data: unknown) =>
          Promise.resolve(data),
        ),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      ...managerOverrides,
    },
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MenuService', () => {
  let service: MenuService;
  let itemRepo: ReturnType<typeof mockRepo>;
  let recipeRepo: ReturnType<typeof mockRepo>;
  let recipeItemRepo: ReturnType<typeof mockRepo>;
  let priceHistoryRepo: ReturnType<typeof mockRepo>;
  let ingredientRepo: ReturnType<typeof mockRepo>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    itemRepo = mockRepo();
    recipeRepo = mockRepo();
    recipeItemRepo = mockRepo();
    priceHistoryRepo = mockRepo();
    ingredientRepo = mockRepo();
    dataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: getRepositoryToken(MenuGroup), useValue: mockRepo() },
        { provide: getRepositoryToken(MenuItem), useValue: itemRepo },
        { provide: getRepositoryToken(Recipe), useValue: recipeRepo },
        { provide: getRepositoryToken(RecipeItem), useValue: recipeItemRepo },
        {
          provide: getRepositoryToken(PriceHistory),
          useValue: priceHistoryRepo,
        },
        { provide: getRepositoryToken(Ingredient), useValue: ingredientRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(MenuService);
  });

  // ── update (price change) ─────────────────────────────────────────────────

  describe('update (price change)', () => {
    it('should insert a price_history record when price changes', async () => {
      const item = makeMenuItem({ price: 75 });
      itemRepo.findOne.mockResolvedValue(item);
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.update(item.id, { price: 90 });

      expect(qr.manager.save).toHaveBeenCalledWith(
        PriceHistory,
        expect.objectContaining({ oldPrice: 75, newPrice: 90 }),
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should NOT insert price_history when price is unchanged', async () => {
      const item = makeMenuItem({ price: 75 });
      itemRepo.findOne.mockResolvedValue(item);
      itemRepo.save.mockResolvedValue(item);

      await service.update(item.id, { price: 75 });

      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(priceHistoryRepo.save).not.toHaveBeenCalled();
    });

    it('should rollback both price_history insert and price update if transaction fails', async () => {
      const item = makeMenuItem({ price: 75 });
      itemRepo.findOne.mockResolvedValue(item);
      const qr = makeQueryRunner({
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(service.update(item.id, { price: 90 })).rejects.toThrow(
        'DB error',
      );

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });
  });

  // ── createOrUpdateRecipe ──────────────────────────────────────────────────

  describe('createOrUpdateRecipe', () => {
    const dto = {
      menuItemId: 'item-1',
      serves: 1,
      items: [{ ingredientId: 'ing-1', quantity: 2 }],
    };

    it('should create a new recipe if none exists for the menu item', async () => {
      ingredientRepo.findOne.mockResolvedValue(makeIngredient());
      const qr = makeQueryRunner({
        findOne: jest.fn().mockResolvedValue(null), // no existing recipe
      });
      qr.manager.save = jest
        .fn()
        .mockResolvedValueOnce({ id: 'recipe-1', menuItemId: 'item-1' }) // recipe save
        .mockResolvedValueOnce([{}]); // items save
      dataSource.createQueryRunner.mockReturnValue(qr);
      recipeRepo.findOne.mockResolvedValue(makeRecipe([]));

      await service.createOrUpdateRecipe(dto);

      expect(qr.manager.create).toHaveBeenCalledWith(
        Recipe,
        expect.objectContaining({ menuItemId: 'item-1' }),
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should replace all recipe items when updating an existing recipe', async () => {
      ingredientRepo.findOne.mockResolvedValue(makeIngredient());
      const existingRecipe = makeRecipe([]);
      const qr = makeQueryRunner({
        findOne: jest.fn().mockResolvedValue(existingRecipe),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);
      recipeRepo.findOne.mockResolvedValue(existingRecipe);

      await service.createOrUpdateRecipe(dto);

      // Old items must be deleted before new ones are inserted
      expect(qr.manager.delete).toHaveBeenCalledWith(RecipeItem, {
        recipeId: existingRecipe.id,
      });
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should validate that all ingredient IDs exist and are active', async () => {
      ingredientRepo.findOne.mockResolvedValue(
        makeIngredient({ isActive: true }),
      );
      const qr = makeQueryRunner({
        findOne: jest.fn().mockResolvedValue(null),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);
      recipeRepo.findOne.mockResolvedValue(makeRecipe([]));

      // Should not throw when ingredient is active
      await expect(service.createOrUpdateRecipe(dto)).resolves.not.toThrow();
    });

    it('should throw NotFoundException if any ingredientId does not exist', async () => {
      ingredientRepo.findOne.mockResolvedValue(null); // ingredient not found

      await expect(service.createOrUpdateRecipe(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── deductStockForSale ────────────────────────────────────────────────────

  describe('deductStockForSale', () => {
    const baseDto = {
      orderItemId: 'order-item-1',
      menuItemId: 'item-1',
      quantity: 1,
      performedBy: 'staff-1',
    };

    function setupItemWithRecipe(stock: number, threshold = 5) {
      const ingredient = makeIngredient({
        currentStock: stock,
        lowStockThreshold: threshold,
      });
      const recipeItem = makeRecipeItem(ingredient, 2);
      const recipe = makeRecipe([recipeItem]);
      const item = makeMenuItem({ recipe });
      itemRepo.findOne.mockResolvedValue(item);
      return { ingredient, item };
    }

    it('should deduct correct quantities for all recipe ingredients', async () => {
      const { ingredient } = setupItemWithRecipe(20);
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      ingredientRepo.findOne.mockResolvedValue(ingredient);

      const result = await service.deductStockForSale(baseDto);

      expect(qr.manager.update).toHaveBeenCalledWith(
        Ingredient,
        ingredient.id,
        { currentStock: 18 }, // 20 - (2 × 1)
      );
      expect(result.deductions[0].quantityDeducted).toBe(2);
    });

    it('should multiply quantities by the sale quantity (2 portions = 2x deduction)', async () => {
      const { ingredient } = setupItemWithRecipe(20);
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      ingredientRepo.findOne.mockResolvedValue(ingredient);

      await service.deductStockForSale({ ...baseDto, quantity: 2 });

      expect(qr.manager.update).toHaveBeenCalledWith(
        Ingredient,
        ingredient.id,
        { currentStock: 16 }, // 20 - (2 × 2)
      );
    });

    it('should create one stock_movement record per ingredient in the recipe', async () => {
      const { ingredient } = setupItemWithRecipe(20);
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      ingredientRepo.findOne.mockResolvedValue(ingredient);

      await service.deductStockForSale(baseDto);

      expect(qr.manager.save).toHaveBeenCalledWith(
        StockMovement,
        expect.objectContaining({ movementType: 'sale', quantityChange: -2 }),
      );
    });

    it('should return success even when stock is insufficient — never throw', async () => {
      setupItemWithRecipe(1); // only 1 rasher, recipe needs 2
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      ingredientRepo.findOne.mockResolvedValue(
        makeIngredient({ currentStock: -1 }),
      );

      const result = await service.deductStockForSale(baseDto);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should include a warning when stock falls to or below threshold after deduction', async () => {
      const { ingredient } = setupItemWithRecipe(6, 5); // stock=6, threshold=5, deduct 2 → new=4
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);
      // Post-commit fresh read returns stock at 4 (below threshold)
      ingredientRepo.findOne.mockResolvedValue(
        makeIngredient({
          ...ingredient,
          currentStock: 4,
          lowStockThreshold: 5,
        }),
      );

      const result = await service.deductStockForSale(baseDto);

      expect(result.warnings.some((w) => w.stockStatus === 'low')).toBe(true);
    });

    it('should return empty deductions array when menu item has no recipe', async () => {
      itemRepo.findOne.mockResolvedValue(makeMenuItem({ recipe: null }));

      const result = await service.deductStockForSale(baseDto);

      expect(result.deductions).toHaveLength(0);
      expect(result.success).toBe(true);
    });

    it('should rollback ALL deductions if any single deduction in the transaction fails', async () => {
      setupItemWithRecipe(20);
      const qr = makeQueryRunner({
        save: jest.fn().mockRejectedValue(new Error('constraint violation')),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      const result = await service.deductStockForSale(baseDto);

      // Must not throw — returns success: false instead
      expect(result.success).toBe(false);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });
  });
});
