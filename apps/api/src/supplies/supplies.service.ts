import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ilike } from 'drizzle-orm';
import { mapSupply, mapSupplyCategory } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import { supplies, supplyCategories } from '../db/schema';

@Injectable()
export class SuppliesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async categories() {
    const rows = await this.db
      .select()
      .from(supplyCategories)
      .where(eq(supplyCategories.isActive, true));
    return rows.map(mapSupplyCategory);
  }

  async list(q?: string) {
    const rows = q
      ? await this.db
          .select()
          .from(supplies)
          .where(and(eq(supplies.isActive, true), ilike(supplies.name, `%${q}%`)))
      : await this.db.select().from(supplies).where(eq(supplies.isActive, true));
    return rows.map(mapSupply);
  }
}
