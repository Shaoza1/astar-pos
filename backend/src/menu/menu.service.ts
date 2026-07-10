import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import type { StockDeductionResultDto } from '@astar-pos/shared';

import { Ingredient } from '../inventory/entities/ingredient.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { DeductStockForSaleDto } from './dto/deduct-stock-for-sale.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuGroup } from './entities/menu-group.entity';
import { MenuItem } from './entities/menu-item.entity';
import { PriceHistory } from './entities/price-history.entity';
import { RecipeItem } from './entities/recipe-item.entity';
import { Recipe } from './entities/recipe.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuGroup)
    private readonly groupRepo: Repository<MenuGroup>,
    @InjectRepository(MenuItem)
    private readonly itemRepo: Repository<MenuItem>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(RecipeItem)
    private readonly recipeItemRepo: Repository<RecipeItem>,
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepo: Repository<PriceHistory>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Menu Groups ─────────────────────────────────────────────────────────────

  findAllGroups(): Promise<MenuGroup[]> {
    return this.groupRepo.find({ order: { sortOrder: 'ASC' } });
  }

  // ── Menu Items ──────────────────────────────────────────────────────────────

  findAll(groupId?: string, includeInactive = false): Promise<MenuItem[]> {
    const where: Record<string, unknown> = {};
    if (!includeInactive) where['isActive'] = true;
    if (groupId) where['groupId'] = groupId;
    return this.itemRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<MenuItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`MenuItem ${id} not found`);
    return item;
  }

  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group)
      throw new NotFoundException(`MenuGroup ${dto.groupId} not found`);
    const item = this.itemRepo.create({ ...dto });
    return this.itemRepo.save(item);
  }

  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const item = await this.findOne(id);

    const priceChanged = dto.price !== undefined && dto.price !== item.price;

    if (priceChanged) {
      // Price history insert and price update must be atomic
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const history = qr.manager.create(PriceHistory, {
          menuItemId: item.id,
          oldPrice: item.price,
          newPrice: dto.price as number,
          // changedBy requires auth context — placeholder until auth ticket lands
          changedBy: '00000000-0000-0000-0000-000000000000',
          reason: null,
        });
        await qr.manager.save(PriceHistory, history);
        Object.assign(item, dto);
        await qr.manager.save(MenuItem, item);
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
      return item;
    }

    Object.assign(item, dto);
    return this.itemRepo.save(item);
  }

  // ── Recipes ─────────────────────────────────────────────────────────────────

  async getRecipe(menuItemId: string): Promise<Recipe | null> {
    return this.recipeRepo.findOne({ where: { menuItemId } });
  }

  async createOrUpdateRecipe(dto: CreateRecipeDto): Promise<Recipe> {
    // Validate every ingredient exists and is active before touching the DB
    for (const item of dto.items) {
      const ingredient = await this.ingredientRepo.findOne({
        where: { id: item.ingredientId, isActive: true },
      });
      if (!ingredient) {
        throw new NotFoundException(
          `Ingredient ${item.ingredientId} not found or inactive`,
        );
      }
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      let recipe = await qr.manager.findOne(Recipe, {
        where: { menuItemId: dto.menuItemId },
      });

      if (recipe) {
        // Delete all existing items first — replace entirely, no partial updates
        await qr.manager.delete(RecipeItem, { recipeId: recipe.id });
        recipe.serves = dto.serves ?? recipe.serves;
        recipe.notes = dto.notes ?? recipe.notes;
        await qr.manager.save(Recipe, recipe);
      } else {
        recipe = qr.manager.create(Recipe, {
          menuItemId: dto.menuItemId,
          serves: dto.serves ?? 1,
          notes: dto.notes ?? null,
        });
        recipe = await qr.manager.save(Recipe, recipe);
      }

      const newItems = dto.items.map((i) =>
        qr.manager.create(RecipeItem, {
          recipeId: recipe.id,
          ingredientId: i.ingredientId,
          quantity: i.quantity,
          isOptional: i.isOptional ?? false,
          optionGroup: i.optionGroup ?? null,
        }),
      );
      await qr.manager.save(RecipeItem, newItems);

      await qr.commitTransaction();

      // Reload with fresh items after transaction
      return (await this.recipeRepo.findOne({
        where: { id: recipe.id },
      })) as Recipe;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Stock Deduction ─────────────────────────────────────────────────────────

  async deductStockForSale(
    dto: DeductStockForSaleDto,
  ): Promise<StockDeductionResultDto> {
    const result: StockDeductionResultDto = {
      success: true,
      deductions: [],
      warnings: [],
    };

    const item = await this.itemRepo.findOne({ where: { id: dto.menuItemId } });
    // No recipe means no tracked ingredients — not an error, just nothing to deduct
    if (!item?.recipe?.items?.length) return result;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      for (const recipeItem of item.recipe.items) {
        const totalToDeduct = recipeItem.quantity * dto.quantity;
        const ingredient = recipeItem.ingredient;

        // Insufficient stock is a WARNING, not a blocker — blocking a sale would
        // stop the restaurant. Shortages are reviewed in the variance report.
        if (ingredient.currentStock < totalToDeduct) {
          result.warnings.push({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            newStock: ingredient.currentStock - totalToDeduct,
            stockStatus: 'out',
          });
        }

        const newStock = ingredient.currentStock - totalToDeduct;

        await qr.manager.update(Ingredient, ingredient.id, {
          currentStock: newStock,
        });

        const movement = qr.manager.create(StockMovement, {
          ingredientId: ingredient.id,
          movementType: 'sale',
          quantityChange: -totalToDeduct,
          referenceId: dto.orderItemId,
          referenceType: 'order_item',
          performedBy: dto.performedBy,
          notes: null,
        });
        await qr.manager.save(StockMovement, movement);

        result.deductions.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantityDeducted: totalToDeduct,
          consumptionUnit: ingredient.consumptionUnit,
        });
      }

      await qr.commitTransaction();

      // Post-commit: check each affected ingredient for low-stock warnings
      // (only for ingredients that weren't already flagged as out above)
      for (const deduction of result.deductions) {
        const fresh = await this.ingredientRepo.findOne({
          where: { id: deduction.ingredientId },
        });
        if (!fresh) continue;
        const alreadyWarned = result.warnings.some(
          (w) => w.ingredientId === deduction.ingredientId,
        );
        if (!alreadyWarned && fresh.currentStock <= fresh.lowStockThreshold) {
          result.warnings.push({
            ingredientId: fresh.id,
            ingredientName: fresh.name,
            newStock: fresh.currentStock,
            stockStatus: fresh.currentStock === 0 ? 'out' : 'low',
          });
        }
      }
    } catch {
      await qr.rollbackTransaction();
      // Never throw — deduction failure must not block a sale
      result.success = false;
      result.warnings.push({
        ingredientId: 'unknown',
        ingredientName: 'unknown',
        newStock: 0,
        stockStatus: 'out',
      });
    } finally {
      await qr.release();
    }

    return result;
  }
}
