import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { LowStockAlertDto } from '@astar-pos/shared';

import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientGroup } from './entities/ingredient-group.entity';
import { Ingredient } from './entities/ingredient.entity';
import { StockMovement } from './entities/stock-movement.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(IngredientGroup)
    private readonly groupRepo: Repository<IngredientGroup>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  findAllGroups(): Promise<IngredientGroup[]> {
    return this.groupRepo.find({ order: { sortOrder: 'ASC' } });
  }

  findAll(includeInactive = false): Promise<Ingredient[]> {
    return this.ingredientRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientRepo.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);
    return ingredient;
  }

  async create(dto: CreateIngredientDto): Promise<Ingredient> {
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group)
      throw new NotFoundException(`IngredientGroup ${dto.groupId} not found`);

    const ingredient = this.ingredientRepo.create({
      ...dto,
      groupId: dto.groupId,
    });
    return this.ingredientRepo.save(ingredient);
  }

  async update(id: string, dto: UpdateIngredientDto): Promise<Ingredient> {
    const ingredient = await this.findOne(id);

    if (dto.groupId) {
      const group = await this.groupRepo.findOne({
        where: { id: dto.groupId },
      });
      if (!group)
        throw new NotFoundException(`IngredientGroup ${dto.groupId} not found`);
    }

    Object.assign(ingredient, dto);
    return this.ingredientRepo.save(ingredient);
  }

  async deactivate(id: string): Promise<void> {
    const ingredient = await this.findOne(id);
    // Soft delete only — ingredient history and recipe references must remain intact
    ingredient.isActive = false;
    await this.ingredientRepo.save(ingredient);
  }

  async adjustStock(dto: StockAdjustmentDto): Promise<StockMovement> {
    const ingredient = await this.findOne(dto.ingredientId);

    if (ingredient.currentStock + dto.quantityChange < 0) {
      throw new BadRequestException(
        'Insufficient stock: cannot reduce below zero',
      );
    }

    // Stock update and movement insert must succeed or fail together
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Ingredient, ingredient.id, {
        currentStock: ingredient.currentStock + dto.quantityChange,
      });

      const movement = queryRunner.manager.create(StockMovement, {
        ingredientId: dto.ingredientId,
        movementType: 'adjustment',
        quantityChange: dto.quantityChange,
        referenceType: 'manual_adjustment',
        referenceId: null,
        performedBy: dto.performedBy,
        notes: dto.reason,
      });
      const saved = await queryRunner.manager.save(StockMovement, movement);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getLowStockAlerts(): Promise<LowStockAlertDto[]> {
    // Raw query so we can ORDER BY the ratio without a computed column
    const rows = await this.ingredientRepo
      .createQueryBuilder('i')
      .where('i.is_active = true')
      .andWhere('i.current_stock <= i.low_stock_threshold')
      .orderBy('i.current_stock / NULLIF(i.low_stock_threshold, 0)', 'ASC')
      .getMany();

    return rows.map((i) => ({
      ingredientId: i.id,
      ingredientName: i.name,
      currentStock: i.currentStock,
      lowStockThreshold: i.lowStockThreshold,
      consumptionUnit: i.consumptionUnit,
      stockStatus: i.currentStock === 0 ? 'out' : 'low',
    }));
  }

  getStockMovements(
    ingredientId: string,
    limit = 50,
  ): Promise<StockMovement[]> {
    return this.movementRepo.find({
      where: { ingredientId },
      order: { performedAt: 'DESC' },
      take: limit,
    });
  }
}
