import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from '@everredi/validation';
import { and, eq, isNotNull, lte, or, sql } from 'drizzle-orm';
import { addDays, startOfUtcDay } from '../common/date';
import { mapInventory } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import { inventoryItems, supplies } from '../db/schema';
import { WorkspacesService } from '../workspaces/workspaces.service';

function deriveStatus(
  required: number | null | undefined,
  actual: number | null | undefined,
  expirationDate: Date | null | undefined,
): 'complete' | 'partial' | 'missing' | 'expired' {
  if (expirationDate && expirationDate.getTime() < Date.now()) return 'expired';
  const req = required ?? 0;
  const act = actual ?? 0;
  if (req <= 0) return act > 0 ? 'complete' : 'missing';
  if (act <= 0) return 'missing';
  if (act >= req) return 'complete';
  return 'partial';
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly workspaces: WorkspacesService,
  ) {}

  async list(workspaceId: string, userId: string, kitId?: string) {
    await this.workspaces.requireMembership(workspaceId, userId);
    const rows = kitId
      ? await this.db
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.workspaceId, workspaceId),
              eq(inventoryItems.kitId, kitId),
            ),
          )
      : await this.db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.workspaceId, workspaceId));
    return rows.map(mapInventory);
  }

  async create(workspaceId: string, userId: string, input: CreateInventoryItemInput) {
    await this.workspaces.requireMembership(workspaceId, userId, 'member');
    await this.workspaces.assertInventoryLimit(workspaceId, userId);

    let supplyName = input.supplyName ?? input.freeformName ?? 'Item';
    let supplyCategoryId = input.supplyCategoryId ?? null;
    if (input.supplyId) {
      const [supply] = await this.db
        .select()
        .from(supplies)
        .where(eq(supplies.id, input.supplyId))
        .limit(1);
      if (supply) {
        supplyName = supply.name;
        supplyCategoryId = supply.categoryId;
      }
    }

    const expirationDate = input.expirationDate
      ? new Date(input.expirationDate)
      : null;
    const status =
      input.status ??
      deriveStatus(input.requiredQuantity, input.actualQuantity, expirationDate);

    const [row] = await this.db
      .insert(inventoryItems)
      .values({
        workspaceId,
        kitId: input.kitId ?? null,
        supplyId: input.supplyId ?? null,
        freeformName: input.supplyId ? null : input.freeformName ?? supplyName,
        supplyName,
        supplyCategoryId,
        locationId: input.locationId ?? null,
        requiredQuantity: input.requiredQuantity ?? null,
        actualQuantity: input.actualQuantity ?? null,
        status,
        expirationDate,
        notes: input.notes ?? null,
      })
      .returning();
    return mapInventory(row!);
  }

  async update(id: string, userId: string, input: UpdateInventoryItemInput) {
    const [existing] = await this.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Item not found');
    await this.workspaces.requireMembership(existing.workspaceId, userId, 'member');

    const requiredQuantity =
      input.requiredQuantity === undefined
        ? existing.requiredQuantity
        : input.requiredQuantity;
    const actualQuantity =
      input.actualQuantity === undefined
        ? existing.actualQuantity
        : input.actualQuantity;
    const expirationDate =
      input.expirationDate === undefined
        ? existing.expirationDate
        : input.expirationDate
          ? new Date(input.expirationDate)
          : null;
    const status =
      input.status ??
      deriveStatus(requiredQuantity, actualQuantity, expirationDate);

    const [row] = await this.db
      .update(inventoryItems)
      .set({
        kitId: input.kitId === undefined ? existing.kitId : input.kitId,
        supplyName: input.supplyName ?? existing.supplyName,
        freeformName:
          input.freeformName === undefined
            ? existing.freeformName
            : input.freeformName,
        locationId:
          input.locationId === undefined ? existing.locationId : input.locationId,
        requiredQuantity,
        actualQuantity,
        status,
        expirationDate,
        notes: input.notes === undefined ? existing.notes : input.notes,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();
    return mapInventory(row!);
  }

  async remove(id: string, userId: string) {
    const [existing] = await this.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Item not found');
    await this.workspaces.requireMembership(existing.workspaceId, userId, 'member');
    await this.db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return null;
  }

  async expiring(workspaceId: string, userId: string, withinDays = 30) {
    await this.workspaces.requireMembership(workspaceId, userId);
    const until = addDays(startOfUtcDay(), withinDays);
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.workspaceId, workspaceId),
          isNotNull(inventoryItems.expirationDate),
          lte(inventoryItems.expirationDate, until),
        ),
      );
    return rows.map(mapInventory);
  }

  async lowStock(workspaceId: string, userId: string) {
    await this.workspaces.requireMembership(workspaceId, userId);
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.workspaceId, workspaceId),
          or(
            eq(inventoryItems.status, 'missing'),
            eq(inventoryItems.status, 'partial'),
            sql`${inventoryItems.requiredQuantity} is not null and coalesce(${inventoryItems.actualQuantity}, 0) < ${inventoryItems.requiredQuantity}`,
          ),
        ),
      );
    return rows.map(mapInventory);
  }
}
