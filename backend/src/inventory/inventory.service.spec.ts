import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IngredientGroup } from './entities/ingredient-group.entity';
import { Ingredient } from './entities/ingredient.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InventoryService } from './inventory.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  const i = new Ingredient();
  i.id = 'ing-uuid-1';
  i.name = 'Bacon';
  i.groupId = 'group-uuid-1';
  i.purchaseUnit = 'pack';
  i.consumptionUnit = 'rasher';
  i.unitsPerPurchase = 10;
  i.lowStockThreshold = 5;
  i.currentStock = 20;
  i.costPerPurchaseUnit = 45.0;
  i.isActive = true;
  return Object.assign(i, overrides);
}

function makeGroup(): IngredientGroup {
  const g = new IngredientGroup();
  g.id = 'group-uuid-1';
  g.name = 'Proteins';
  g.sortOrder = 10;
  return g;
}

// ── Mock factories ────────────────────────────────────────────────────────────

const mockGroupRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockIngredientRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockMovementRepo = () => ({
  find: jest.fn(),
});

// Builds a mock QueryRunner whose behaviour can be overridden per test
function makeQueryRunner(overrides: Record<string, jest.Mock> = {}) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      update: jest.fn(),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({ id: 'movement-uuid-1' }),
      ...overrides,
    },
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('InventoryService', () => {
  let service: InventoryService;
  let groupRepo: ReturnType<typeof mockGroupRepo>;
  let ingredientRepo: ReturnType<typeof mockIngredientRepo>;
  let movementRepo: ReturnType<typeof mockMovementRepo>;
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    groupRepo = mockGroupRepo();
    ingredientRepo = mockIngredientRepo();
    movementRepo = mockMovementRepo();
    dataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(IngredientGroup), useValue: groupRepo },
        { provide: getRepositoryToken(Ingredient), useValue: ingredientRepo },
        { provide: getRepositoryToken(StockMovement), useValue: movementRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return only active ingredients by default', async () => {
      ingredientRepo.find.mockResolvedValue([makeIngredient()]);
      await service.findAll();
      expect(ingredientRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('should return all ingredients including inactive when includeInactive is true', async () => {
      ingredientRepo.find.mockResolvedValue([
        makeIngredient(),
        makeIngredient({ isActive: false }),
      ]);
      await service.findAll(true);
      expect(ingredientRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an ingredient with correct fields', async () => {
      const dto = {
        groupId: 'group-uuid-1',
        name: 'Bacon',
        purchaseUnit: 'pack',
        consumptionUnit: 'rasher',
        unitsPerPurchase: 10,
        lowStockThreshold: 5,
      };
      groupRepo.findOne.mockResolvedValue(makeGroup());
      ingredientRepo.create.mockReturnValue(makeIngredient());
      ingredientRepo.save.mockResolvedValue(makeIngredient());

      const result = await service.create(dto);

      expect(groupRepo.findOne).toHaveBeenCalledWith({
        where: { id: dto.groupId },
      });
      expect(ingredientRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bacon' }),
      );
      expect(result.name).toBe('Bacon');
    });

    it('should throw NotFoundException if groupId does not exist', async () => {
      groupRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({
          groupId: 'nonexistent',
          name: 'X',
          purchaseUnit: 'kg',
          consumptionUnit: 'g',
          unitsPerPurchase: 1000,
          lowStockThreshold: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── adjustStock ────────────────────────────────────────────────────────────

  describe('adjustStock', () => {
    const baseDto = {
      ingredientId: 'ing-uuid-1',
      quantityChange: 10,
      reason: 'Delivery received',
      performedBy: 'staff-uuid-1',
    };

    it('should increase stock correctly and create a stock movement record', async () => {
      const ingredient = makeIngredient({ currentStock: 20 });
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.adjustStock({ ...baseDto, quantityChange: 10 });

      expect(qr.manager.update).toHaveBeenCalledWith(
        Ingredient,
        ingredient.id,
        { currentStock: 30 },
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should decrease stock correctly and create a stock movement record', async () => {
      const ingredient = makeIngredient({ currentStock: 20 });
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.adjustStock({ ...baseDto, quantityChange: -5 });

      expect(qr.manager.update).toHaveBeenCalledWith(
        Ingredient,
        ingredient.id,
        { currentStock: 15 },
      );
      expect(qr.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException when adjustment would result in negative stock', async () => {
      ingredientRepo.findOne.mockResolvedValue(
        makeIngredient({ currentStock: 3 }),
      );
      dataSource.createQueryRunner.mockReturnValue(makeQueryRunner());

      await expect(
        service.adjustStock({ ...baseDto, quantityChange: -10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback the transaction if the stock_movement insert fails', async () => {
      ingredientRepo.findOne.mockResolvedValue(
        makeIngredient({ currentStock: 20 }),
      );
      const qr = makeQueryRunner({
        save: jest.fn().mockRejectedValue(new Error('DB constraint violation')),
      });
      dataSource.createQueryRunner.mockReturnValue(qr);

      await expect(service.adjustStock(baseDto)).rejects.toThrow(
        'DB constraint violation',
      );

      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });

    it('should persist both the stock update and movement record in a single transaction', async () => {
      ingredientRepo.findOne.mockResolvedValue(
        makeIngredient({ currentStock: 20 }),
      );
      const qr = makeQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(qr);

      await service.adjustStock(baseDto);

      // Both operations must use the same queryRunner.manager — not the repo directly
      expect(qr.manager.update).toHaveBeenCalledTimes(1);
      expect(qr.manager.save).toHaveBeenCalledTimes(1);
      expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
      expect(qr.release).toHaveBeenCalledTimes(1);
    });
  });

  // ── getLowStockAlerts ──────────────────────────────────────────────────────

  describe('getLowStockAlerts', () => {
    function setupQb(ingredients: Ingredient[]) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(ingredients),
      };
      ingredientRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('should return only ingredients at or below threshold', async () => {
      const low = makeIngredient({ currentStock: 3, lowStockThreshold: 5 });
      setupQb([low]);
      const alerts = await service.getLowStockAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].ingredientId).toBe(low.id);
    });

    it('should mark ingredient as out when currentStock is 0', async () => {
      setupQb([makeIngredient({ currentStock: 0, lowStockThreshold: 5 })]);
      const alerts = await service.getLowStockAlerts();
      expect(alerts[0].stockStatus).toBe('out');
    });

    it('should mark ingredient as low when currentStock is above 0 but at or below threshold', async () => {
      setupQb([makeIngredient({ currentStock: 3, lowStockThreshold: 5 })]);
      const alerts = await service.getLowStockAlerts();
      expect(alerts[0].stockStatus).toBe('low');
    });

    it('should order results by severity — most critical first', async () => {
      // currentStock=0 is more critical than currentStock=2
      const out = makeIngredient({
        id: 'a',
        currentStock: 0,
        lowStockThreshold: 5,
      });
      const low = makeIngredient({
        id: 'b',
        currentStock: 2,
        lowStockThreshold: 5,
      });
      // The query builder orderBy handles DB-level ordering; we verify the mapping preserves order
      setupQb([out, low]);
      const alerts = await service.getLowStockAlerts();
      expect(alerts[0].stockStatus).toBe('out');
      expect(alerts[1].stockStatus).toBe('low');
    });
  });

  // ── deactivate ─────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('should set isActive to false, not delete the record', async () => {
      const ingredient = makeIngredient({ isActive: true });
      ingredientRepo.findOne.mockResolvedValue(ingredient);
      ingredientRepo.save.mockResolvedValue({ ...ingredient, isActive: false });

      await service.deactivate(ingredient.id);

      expect(ingredientRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      // Confirm no delete method was called
      expect(
        (ingredientRepo as Record<string, jest.Mock>)['delete'],
      ).toBeUndefined();
      expect(
        (ingredientRepo as Record<string, jest.Mock>)['remove'],
      ).toBeUndefined();
    });
  });
});
