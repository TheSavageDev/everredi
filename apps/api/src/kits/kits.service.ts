import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateFromTemplateInput,
  CreateKitInput,
  UpdateKitInput,
} from '@everredi/validation';
import { and, eq, isNull } from 'drizzle-orm';
import { mapKit, mapTemplate } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import {
  inventoryItems,
  kitTemplateItems,
  kitTemplates,
  kits,
} from '../db/schema';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class KitsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly workspaces: WorkspacesService,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.workspaces.requireMembership(workspaceId, userId);
    const rows = await this.db
      .select()
      .from(kits)
      .where(and(eq(kits.workspaceId, workspaceId), isNull(kits.deletedAt)));
    return rows.map(mapKit);
  }

  async get(id: string, userId: string) {
    const { kit } = await this.workspaces.canAccessKit(userId, id, 'view');
    return mapKit(kit);
  }

  async create(workspaceId: string, userId: string, input: CreateKitInput) {
    await this.workspaces.requireMembership(workspaceId, userId, 'member');
    await this.workspaces.assertKitLimit(workspaceId, userId);
    const [row] = await this.db
      .insert(kits)
      .values({
        workspaceId,
        name: input.name,
        locationId: input.locationId ?? null,
        notes: input.notes ?? null,
        status: input.status ?? 'active',
        templateId: input.templateId ?? null,
      })
      .returning();
    return mapKit(row!);
  }

  async update(id: string, userId: string, input: UpdateKitInput) {
    await this.workspaces.canAccessKit(userId, id, 'edit');
    const [row] = await this.db
      .update(kits)
      .set({
        name: input.name,
        locationId: input.locationId,
        notes: input.notes,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(kits.id, id))
      .returning();
    if (!row) throw new NotFoundException('Kit not found');
    return mapKit(row);
  }

  async remove(id: string, userId: string) {
    await this.workspaces.canAccessKit(userId, id, 'edit');
    await this.db
      .update(kits)
      .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
      .where(eq(kits.id, id));
    return null;
  }

  async templates() {
    const templates = await this.db
      .select()
      .from(kitTemplates)
      .where(eq(kitTemplates.isPublic, true));
    const result = [];
    for (const t of templates) {
      const items = await this.db
        .select()
        .from(kitTemplateItems)
        .where(eq(kitTemplateItems.templateId, t.id));
      result.push(
        mapTemplate(
          t,
          items.map((i) => ({
            id: i.id,
            supplyId: i.supplyId,
            freeformName: i.freeformName,
            supplyName: i.supplyName,
            requiredQuantity: i.requiredQuantity,
          })),
        ),
      );
    }
    return result;
  }

  async createFromTemplate(
    workspaceId: string,
    userId: string,
    input: CreateFromTemplateInput,
  ) {
    await this.workspaces.requireMembership(workspaceId, userId, 'member');
    await this.workspaces.assertKitLimit(workspaceId, userId);

    const [template] = await this.db
      .select()
      .from(kitTemplates)
      .where(eq(kitTemplates.id, input.templateId))
      .limit(1);
    if (!template) throw new NotFoundException('Template not found');

    const items = await this.db
      .select()
      .from(kitTemplateItems)
      .where(eq(kitTemplateItems.templateId, template.id));

    const [kit] = await this.db
      .insert(kits)
      .values({
        workspaceId,
        name: input.name ?? template.name,
        locationId: input.locationId ?? null,
        templateId: template.id,
        status: 'incomplete',
      })
      .returning();

    for (const item of items) {
      await this.workspaces.assertInventoryLimit(workspaceId, userId);
      await this.db.insert(inventoryItems).values({
        workspaceId,
        kitId: kit!.id,
        supplyId: item.supplyId,
        freeformName: item.freeformName,
        supplyName: item.supplyName,
        requiredQuantity: item.requiredQuantity,
        actualQuantity: 0,
        status: 'missing',
      });
    }

    return mapKit(kit!);
  }
}
