import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { EmailService } from '../email/email.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import {
  AdvancedNotificationsService,
  type LowStockAlert,
} from './advanced-notifications.service';
import { TenantsService } from '../tenants/tenants.service';

const logger = new Logger('LowStockNotificationsService');
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class LowStockNotificationsService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly pushNotificationService: PushNotificationService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly advancedNotificationsService: AdvancedNotificationsService,
    private readonly emailService: EmailService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Run daily (e.g. after expiration job) to check low-stock alerts and send notifications.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleLowStockNotifications() {
    logger.log('Starting daily low-stock notification check...');
    const startTime = Date.now();

    try {
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id')
        .eq('is_active', true);

      if (usersError) {
        logger.error(`Error getting users: ${usersError.message}`);
        return;
      }

      let totalSent = 0;

      for (const user of users || []) {
        const userId = user.id;
        const preferences =
          await this.advancedNotificationsService.getNotificationPreferences(
            userId,
          );
        if (!preferences?.lowStockAlertsEnabled) continue;

        const alerts =
          await this.advancedNotificationsService.getLowStockAlerts(userId);
        if (alerts.length === 0) continue;

        for (const alert of alerts) {
          if (!alert.supplyId) continue;

          const totalQty = await this.getTotalQuantityForSupply(
            userId,
            alert.supplyId,
          );
          if (totalQty >= alert.minimumQuantity) continue;

          if (!this.shouldSendForAlert(alert)) continue;

          try {
            await this.sendLowStockNotification(userId, alert, totalQty);
            await this.markAlertTriggered(alert.id, userId);
            totalSent++;
            logger.log(
              `Low-stock notification sent for user ${userId}, supply ${alert.supplyName}`,
            );
          } catch (err) {
            logger.error(
              `Error sending low-stock notification for alert ${alert.id}:`,
              err,
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.log(
        `Completed low-stock check. Sent ${totalSent} notifications in ${duration}ms`,
      );
    } catch (error) {
      logger.error('Error in low-stock notification check:', error);
    }
  }

  private async getTotalQuantityForSupply(
    userId: string,
    supplyId: string,
  ): Promise<number> {
    // Try old schema where inventory_items has a user_id column
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('actual_quantity')
      .eq('user_id', userId)
      .eq('supply_id', supplyId);

    if (!error) {
      const total = (data || []).reduce(
        (sum, row) => sum + (Number(row.actual_quantity) || 0),
        0,
      );
      return total;
    }

    // If error is not about the user_id column missing, log and bail
    if (
      error.code !== '42703' && // undefined_column
      !error.message?.includes('column') &&
      !error.message?.includes('user_id')
    ) {
      logger.warn(
        `Failed to sum quantity for user ${userId} supply ${supplyId}: ${error.message}`,
      );
      return 0;
    }

    // New consolidated schema: use tenant_id instead
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    const { data: tenantRows, error: tenantError } = await this.supabase
      .from('inventory_items')
      .select('actual_quantity')
      .eq('tenant_id', tenant.id)
      .eq('supply_id', supplyId);

    if (tenantError) {
      logger.warn(
        `Failed to sum quantity for tenant ${tenant.id} supply ${supplyId}: ${tenantError.message}`,
      );
      return 0;
    }

    const total = (tenantRows || []).reduce(
      (sum, row) => sum + (Number(row.actual_quantity) || 0),
      0,
    );
    return total;
  }

  private shouldSendForAlert(alert: LowStockAlert): boolean {
    const lastTriggered = alert.lastTriggeredAt ?? null;
    if (!lastTriggered) return true;
    return Date.now() - lastTriggered.getTime() >= COOLDOWN_MS;
  }

  private async sendLowStockNotification(
    userId: string,
    alert: LowStockAlert,
    currentQuantity: number,
  ): Promise<void> {
    const pushEnabled =
      await this.advancedNotificationsService.isPushEnabled(userId);
    if (pushEnabled) {
      await this.pushNotificationService.sendLowStockNotification(
        userId,
        alert.supplyName,
        currentQuantity,
        alert.minimumQuantity,
        alert.id,
      );
    }

    await this.notificationsService.createNotification(userId, {
      type: 'low_stock',
      title: 'Low stock alert',
      message: `${alert.supplyName} is below your minimum (${currentQuantity} / ${alert.minimumQuantity})`,
      data: {
        alertId: alert.id,
        supplyId: alert.supplyId,
        supplyName: alert.supplyName,
        currentQuantity,
        minimumQuantity: alert.minimumQuantity,
      },
      isRead: false,
      sentAt: new Date(),
    });

    if (this.emailService.isConfigured()) {
      const prefs =
        await this.advancedNotificationsService.getNotificationPreferences(
          userId,
        );
      if (prefs?.emailEnabled) {
        const user = await this.usersService.getUserById(userId);
        if (user?.email) {
          this.emailService
            .sendLowStockNotificationEmail(
              user.email,
              alert.supplyName,
              currentQuantity,
              alert.minimumQuantity,
            )
            .catch(() => {});
        }
      }
    }
  }

  private async markAlertTriggered(
    alertId: string,
    userId: string,
  ): Promise<void> {
    await this.supabase
      .from('low_stock_alerts')
      .update({
        last_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId);
  }

  async checkLowStockNow(): Promise<void> {
    await this.handleLowStockNotifications();
  }
}
