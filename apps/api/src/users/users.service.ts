import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UpsertUserInput } from '@everredi/validation';
import { eq } from 'drizzle-orm';
import { mapUser } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import { users } from '../db/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async upsertFromAuth(id: string, email: string, input: UpsertUserInput = {}) {
    const [existing] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (existing) {
      const [updated] = await this.db
        .update(users)
        .set({
          email,
          displayName: input.displayName ?? existing.displayName,
          avatarUrl: input.avatarUrl === undefined ? existing.avatarUrl : input.avatarUrl,
          onboardingCompleted:
            input.onboardingCompleted ?? existing.onboardingCompleted,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      return mapUser(updated!);
    }
    const [created] = await this.db
      .insert(users)
      .values({
        id,
        email,
        displayName: input.displayName ?? email.split('@')[0] ?? null,
        avatarUrl: input.avatarUrl ?? null,
        onboardingCompleted: input.onboardingCompleted ?? false,
        lastLoginAt: new Date(),
      })
      .returning();
    return mapUser(created!);
  }

  async getById(id: string) {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw new NotFoundException('User not found');
    return mapUser(row);
  }

  async updateMe(id: string, input: UpsertUserInput) {
    const [updated] = await this.db
      .update(users)
      .set({
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        onboardingCompleted: input.onboardingCompleted,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    if (!updated) throw new NotFoundException('User not found');
    return mapUser(updated);
  }

  async setEntitlement(
    userId: string,
    premium: boolean,
    expiresAt: Date | null,
    status: 'active' | 'cancelled' | 'expired' = 'active',
  ) {
    const [updated] = await this.db
      .update(users)
      .set({
        subscriptionTier: premium ? 'premium' : 'free',
        subscriptionStatus: status,
        subscriptionExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated ? mapUser(updated) : null;
  }
}
