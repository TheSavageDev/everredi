import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE } from '../config/supabase.provider';
import { EmailService } from '../email/email.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import { AdvancedNotificationsService } from './advanced-notifications.service';
import { TenantsService } from '../tenants/tenants.service';

const logger = new Logger('ExpirationNotificationsService');

interface InventoryItem {
  id: string;
  supply_name: string;
  expiration_date?: string;
  status: 'complete' | 'partial' | 'missing' | 'used' | 'disposed' | 'expired';
}

const DEFAULT_ALERT_DAYS = [60, 30, 10, 1];

@Injectable()
export class ExpirationNotificationsService {
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
   * Run daily at 9 AM to check for expiring items and send notifications
   * Also automatically sets items to 'expired' status when expiration date has passed
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleExpirationNotifications() {
    logger.log('Starting daily expiration notification check...');
    const startTime = Date.now();

    try {
      const now = new Date();
      let totalNotificationsSent = 0;
      let totalExpiredUpdated = 0;

      // Get all active users
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id')
        .eq('is_active', true);

      if (usersError) {
        logger.error(`Error getting users: ${usersError.message}`);
        return;
      }

      for (const user of users || []) {
        const userId = user.id;

        const preferences =
          await this.advancedNotificationsService.getNotificationPreferences(
            userId,
          );
        const expirationAlertsEnabled =
          preferences?.expirationAlertsEnabled ?? true;

        const userThresholds =
          await this.advancedNotificationsService.getAlertThresholds(userId);
        const alertDays =
          userThresholds.length > 0
            ? [...userThresholds]
                .map((t) => t.daysBeforeExpiration)
                .filter((d, i, arr) => arr.indexOf(d) === i)
                .sort((a, b) => b - a)
            : DEFAULT_ALERT_DAYS;

        const isPremium = await this.usersService.isPremiumUser(userId);

        // Get active inventory items with expiration dates.
        // Supports both old (user_id column) and new (tenant_id column) schemas.
        let items: InventoryItem[] = [];
        try {
          items = await this.getUserInventoryItems(userId);
        } catch (itemsError: any) {
          logger.error(
            `Error getting items for user ${userId}: ${itemsError?.message || itemsError}`,
          );
          continue;
        }

        // For free users, only allow up to N active expiration notifications
        const maxFreeReminders = 10;
        let remindersCreatedForUser = 0;

        for (const item of items || []) {
          if (!item.expiration_date) continue;

          const expirationDate = new Date(item.expiration_date);
          const daysUntilExpiration = Math.ceil(
            (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Check if item has expired and update status if needed
          // Only update items that aren't already in lifecycle states
          const lifecycleStates = ['used', 'disposed', 'expired'];
          const currentStatus = item.status as string;

          if (
            expirationDate < now &&
            !lifecycleStates.includes(currentStatus)
          ) {
            try {
              await this.supabase
                .from('inventory_items')
                .update({
                  status: 'expired',
                  updated_at: now.toISOString(),
                })
                .eq('id', item.id);

              totalExpiredUpdated++;
              logger.log(
                `Updated item ${item.id} (${item.supply_name}) to expired status`,
              );
            } catch (error) {
              logger.error(
                `Error updating expired status for item ${item.id}:`,
                error,
              );
            }
            // Skip notification logic for expired items
            continue;
          }

          if (!expirationAlertsEnabled) {
            continue;
          }

          // Check each alert threshold (user-defined or default, descending)
          for (const thresholdDays of alertDays) {
            // Find the next smaller alert threshold (or 0 if this is the smallest)
            const nextSmallerAlert =
              alertDays.find((d) => d < thresholdDays) || 0;

            // Check if we should send notification for this threshold
            // Send when: daysUntilExpiration <= thresholdDays AND daysUntilExpiration > nextSmallerAlert
            // This ensures we only send one alert per threshold window
            if (
              daysUntilExpiration <= thresholdDays &&
              daysUntilExpiration > nextSmallerAlert &&
              !(await this.hasNotificationBeenSent(userId, item.id, thresholdDays))
            ) {
              if (!isPremium && remindersCreatedForUser >= maxFreeReminders) {
                continue;
              }
              try {
                await this.sendExpirationNotification(
                  userId,
                  item,
                  thresholdDays,
                  daysUntilExpiration,
                );
                await this.markNotificationAsSent(userId, item.id, thresholdDays);
                totalNotificationsSent++;
                remindersCreatedForUser++;
                logger.log(
                  `Sent ${thresholdDays}-day expiration notification for item ${item.id} (${item.supply_name})`,
                );
              } catch (error) {
                logger.error(
                  `Error sending expiration notification for item ${item.id}:`,
                  error,
                );
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.log(
        `Completed expiration notification check. Sent ${totalNotificationsSent} notifications, updated ${totalExpiredUpdated} items to expired status in ${duration}ms`,
      );
    } catch (error) {
      logger.error('Error in expiration notification check:', error);
    }
  }

  /**
   * Get inventory items with expiration dates for a user.
   * Tries user_id-based schema first; falls back to tenant_id-based schema.
   */
  private async getUserInventoryItems(
    userId: string,
  ): Promise<InventoryItem[]> {
    // Try old schema where inventory_items has a user_id column
    const { data, error } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .not('expiration_date', 'is', null);

    if (!error) {
      return (data || []) as InventoryItem[];
    }

    // If error is not about the user_id column missing, rethrow
    if (
      error.code !== '42703' && // undefined_column
      !error.message?.includes('column') &&
      !error.message?.includes('user_id')
    ) {
      throw error;
    }

    // New consolidated schema: use tenant_id instead
    const tenant = await this.tenantsService.getUserDefaultTenant(userId);
    const { data: tenantItems, error: tenantError } = await this.supabase
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenant.id)
      .not('expiration_date', 'is', null);

    if (tenantError) {
      throw tenantError;
    }

    return (tenantItems || []) as InventoryItem[];
  }

  private static expiryEventKey(itemId: string, alertDays: number): string {
    return `expiry:${itemId}:${alertDays}`;
  }

  /**
   * Check if a notification for this item/threshold has already been sent (via notification_events)
   */
  private async hasNotificationBeenSent(
    userId: string,
    itemId: string,
    alertDays: number,
  ): Promise<boolean> {
    const eventKey = ExpirationNotificationsService.expiryEventKey(
      itemId,
      alertDays,
    );
    const { data, error } = await this.supabase
      .from('notification_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_key', eventKey)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn(`Failed to check notification_events: ${error.message}`);
      return false;
    }
    return data != null;
  }

  /**
   * Record that we sent an expiration notification (in notification_events)
   */
  private async markNotificationAsSent(
    userId: string,
    itemId: string,
    alertDays: number,
  ): Promise<void> {
    const eventKey = ExpirationNotificationsService.expiryEventKey(
      itemId,
      alertDays,
    );
    await this.supabase.from('notification_events').upsert(
      {
        user_id: userId,
        event_key: eventKey,
        channel: 'inapp',
        sent_at: new Date().toISOString(),
        meta: { itemId, alertDays },
      },
      { onConflict: 'user_id,event_key', ignoreDuplicates: true },
    );
  }

  /**
   * Send expiration notification for an item
   */
  private async sendExpirationNotification(
    userId: string,
    item: InventoryItem,
    alertDays: number,
    actualDaysUntilExpiration: number,
  ): Promise<void> {
    const daysText =
      actualDaysUntilExpiration === 1
        ? '1 day'
        : `${actualDaysUntilExpiration} days`;

    const pushEnabled =
      await this.advancedNotificationsService.isPushEnabled(userId);
    if (pushEnabled) {
      await this.pushNotificationService.sendExpirationNotification(
        userId,
        item.supply_name,
        actualDaysUntilExpiration,
        item.id,
      );
    }

    // Create in-app notification
    await this.notificationsService.createNotification(userId, {
      type: 'expiration',
      title: 'Item Expiring Soon',
      message: `${item.supply_name} expires in ${daysText}`,
      data: {
        itemId: item.id,
        daysUntilExpiration: actualDaysUntilExpiration,
        alertThreshold: alertDays,
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
            .sendExpirationNotificationEmail(
              user.email,
              item.supply_name,
              actualDaysUntilExpiration,
            )
            .catch(() => {});
        }
      }
    }
  }

  /**
   * Manually trigger expiration check (useful for testing)
   */
  async checkExpiringItemsNow(): Promise<void> {
    await this.handleExpirationNotifications();
  }
}
