import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { mapNotification } from '../common/mappers';
import { DB, type Db } from '../db/db.module';
import { notifications } from '../db/schema';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string) {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    return rows.map(mapNotification);
  }

  async markRead(userId: string, id: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    if (!row) throw new NotFoundException('Notification not found');
    return mapNotification(row);
  }

  async create(input: {
    userId: string;
    workspaceId?: string | null;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    const [row] = await this.db
      .insert(notifications)
      .values({
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? null,
      })
      .returning();
    return mapNotification(row!);
  }

  async notifyExpiring(userId: string, workspaceId: string, count: number) {
    if (count <= 0) return null;
    return this.create({
      userId,
      workspaceId,
      type: 'expiration',
      title: 'Items expiring soon',
      message: `${count} item${count === 1 ? '' : 's'} expire within 30 days`,
      data: { count },
    });
  }

  async notifyLowStock(userId: string, workspaceId: string, count: number) {
    if (count <= 0) return null;
    return this.create({
      userId,
      workspaceId,
      type: 'low_stock',
      title: 'Low stock',
      message: `${count} item${count === 1 ? '' : 's'} are below required quantity`,
      data: { count },
    });
  }
}
