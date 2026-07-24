import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNotNull, lte, or, sql } from 'drizzle-orm';
import { addDays, startOfUtcDay } from '../common/date';
import { DB, type Db } from '../db/db.module';
import { inventoryItems, workspaceMembers, workspaces } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

export type WorkspaceAlertResult = {
  workspaceId: string;
  expiring: number;
  lowStock: number;
  notifiedUsers: number;
};

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notifications: NotificationsService,
  ) {}

  async listWorkspaceIds(): Promise<string[]> {
    const rows = await this.db.select({ id: workspaces.id }).from(workspaces);
    return rows.map((r) => r.id);
  }

  async runForWorkspace(
    workspaceId: string,
    withinDays = 30,
  ): Promise<WorkspaceAlertResult> {
    const until = addDays(startOfUtcDay(), withinDays);

    const expiringRows = await this.db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.workspaceId, workspaceId),
          isNotNull(inventoryItems.expirationDate),
          lte(inventoryItems.expirationDate, until),
        ),
      );

    const lowStockRows = await this.db
      .select({ id: inventoryItems.id })
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

    const members = await this.db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    let notifiedUsers = 0;
    for (const member of members) {
      let wrote = false;
      if (expiringRows.length > 0) {
        await this.notifications.notifyExpiring(
          member.userId,
          workspaceId,
          expiringRows.length,
        );
        wrote = true;
      }
      if (lowStockRows.length > 0) {
        await this.notifications.notifyLowStock(
          member.userId,
          workspaceId,
          lowStockRows.length,
        );
        wrote = true;
      }
      if (wrote) notifiedUsers += 1;
    }

    return {
      workspaceId,
      expiring: expiringRows.length,
      lowStock: lowStockRows.length,
      notifiedUsers,
    };
  }

  async runForAllWorkspaces(withinDays = 30) {
    const ids = await this.listWorkspaceIds();
    const results: WorkspaceAlertResult[] = [];
    for (const workspaceId of ids) {
      results.push(await this.runForWorkspace(workspaceId, withinDays));
    }
    return {
      workspaces: results.length,
      notifiedUsers: results.reduce((sum, r) => sum + r.notifiedUsers, 0),
      results,
    };
  }
}
