import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateLocationInput, UpdateLocationInput } from '@everredi/validation';
import { and, eq } from 'drizzle-orm';
import { mapLocation } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import { locations } from '../db/schema';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class LocationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly workspaces: WorkspacesService,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.workspaces.requireMembership(workspaceId, userId);
    const rows = await this.db
      .select()
      .from(locations)
      .where(eq(locations.workspaceId, workspaceId));
    return rows.map(mapLocation);
  }

  async create(workspaceId: string, userId: string, input: CreateLocationInput) {
    await this.workspaces.requireMembership(workspaceId, userId, 'member');
    await this.workspaces.assertLocationLimit(workspaceId, userId);
    const [row] = await this.db
      .insert(locations)
      .values({
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        locationType: input.locationType ?? 'general',
        isPrimary: input.isPrimary ?? false,
      })
      .returning();
    return mapLocation(row!);
  }

  async update(id: string, userId: string, input: UpdateLocationInput) {
    const [existing] = await this.db.select().from(locations).where(eq(locations.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Location not found');
    await this.workspaces.requireMembership(existing.workspaceId, userId, 'member');
    const [row] = await this.db
      .update(locations)
      .set({
        name: input.name ?? existing.name,
        description: input.description === undefined ? existing.description : input.description,
        locationType: input.locationType ?? existing.locationType,
        isPrimary: input.isPrimary ?? existing.isPrimary,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, id))
      .returning();
    return mapLocation(row!);
  }

  async remove(id: string, userId: string) {
    const [existing] = await this.db.select().from(locations).where(eq(locations.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Location not found');
    await this.workspaces.requireMembership(existing.workspaceId, userId, 'admin');
    await this.db.delete(locations).where(eq(locations.id, id));
    return null;
  }
}
