import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';

const logger = new Logger('ExpirationNotificationsService');

interface InventoryItem {
  id: string;
  userId: string;
  supplyName: string;
  expirationDate?: Timestamp;
  status: 'active' | 'expired' | 'used' | 'disposed';
  sentNotifications?: string[]; // Array of days (e.g., ['60', '30', '10', '1'])
}

@Injectable()
export class ExpirationNotificationsService {
  private readonly alertDays = [60, 30, 10, 1]; // Days before expiration to send alerts

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Run daily at 9 AM to check for expiring items and send notifications
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleExpirationNotifications() {
    logger.log('Starting daily expiration notification check...');
    const startTime = Date.now();

    try {
      const now = new Date();
      let totalNotificationsSent = 0;

      // Get all active inventory items with expiration dates
      const allUsers = await this.firebaseService.getCollection('users');

      for (const user of allUsers) {
        const userId = user.id;

        const isPremium = await this.usersService.isPremiumUser(userId);

        const items =
          await this.firebaseService.getSubcollection<InventoryItem>(
            'users',
            userId,
            'inventoryItems',
            {
              where: [
                { field: 'status', operator: '==', value: 'active' },
                { field: 'expirationDate', operator: '!=', value: null },
              ],
            },
          );

        // For free users, only allow up to N active expiration notifications
        const maxFreeReminders = 10;
        let remindersCreatedForUser = 0;

        for (const item of items) {
          if (!item.expirationDate) continue;

          const expirationDate = item.expirationDate.toDate();
          const daysUntilExpiration = Math.ceil(
            (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Check each alert threshold (in descending order: 60, 30, 10, 1)
          for (const alertDays of this.alertDays) {
            // Find the next smaller alert threshold (or 0 if this is the smallest)
            const nextSmallerAlert =
              this.alertDays.find((d) => d < alertDays) || 0;

            // Check if we should send notification for this threshold
            // Send when: daysUntilExpiration <= alertDays AND daysUntilExpiration > nextSmallerAlert
            // This ensures we only send one alert per threshold window
            if (
              daysUntilExpiration <= alertDays &&
              daysUntilExpiration > nextSmallerAlert &&
              !this.hasNotificationBeenSent(item, alertDays)
            ) {
              if (!isPremium && remindersCreatedForUser >= maxFreeReminders) {
                continue;
              }
              try {
                await this.sendExpirationNotification(
                  item,
                  alertDays,
                  daysUntilExpiration,
                );
                await this.markNotificationAsSent(item.id, userId, alertDays);
                totalNotificationsSent++;
                remindersCreatedForUser++;
                logger.log(
                  `Sent ${alertDays}-day expiration notification for item ${item.id} (${item.supplyName})`,
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
        `Completed expiration notification check. Sent ${totalNotificationsSent} notifications in ${duration}ms`,
      );
    } catch (error) {
      logger.error('Error in expiration notification check:', error);
    }
  }

  /**
   * Check if a notification for a specific day threshold has already been sent
   */
  private hasNotificationBeenSent(
    item: InventoryItem,
    alertDays: number,
  ): boolean {
    const sentNotifications = item.sentNotifications || [];
    return sentNotifications.includes(String(alertDays));
  }

  /**
   * Mark a notification as sent for an item
   */
  private async markNotificationAsSent(
    itemId: string,
    userId: string,
    alertDays: number,
  ): Promise<void> {
    const item = await this.firebaseService.getSubcollectionDocument(
      'users',
      userId,
      'inventoryItems',
      itemId,
    );

    if (!item) {
      return;
    }

    const currentSent = (item.sentNotifications as string[]) || [];
    const updatedSent = [...new Set([...currentSent, String(alertDays)])];

    await this.firebaseService.updateSubcollectionDocument(
      'users',
      userId,
      'inventoryItems',
      itemId,
      {
        sentNotifications: updatedSent,
      },
    );
  }

  /**
   * Send expiration notification for an item
   */
  private async sendExpirationNotification(
    item: InventoryItem,
    alertDays: number,
    actualDaysUntilExpiration: number,
  ): Promise<void> {
    const daysText =
      actualDaysUntilExpiration === 1
        ? '1 day'
        : `${actualDaysUntilExpiration} days`;

    // Send push notification
    await this.pushNotificationService.sendExpirationNotification(
      item.userId,
      item.supplyName,
      actualDaysUntilExpiration,
      item.id,
    );

    // Create in-app notification
    await this.notificationsService.createNotification(item.userId, {
      type: 'expiration',
      title: 'Item Expiring Soon',
      message: `${item.supplyName} expires in ${daysText}`,
      data: {
        itemId: item.id,
        daysUntilExpiration: actualDaysUntilExpiration,
        alertThreshold: alertDays,
      },
      isRead: false,
      sentAt: Timestamp.now(),
    });
  }

  /**
   * Manually trigger expiration check (useful for testing)
   */
  async checkExpiringItemsNow(): Promise<void> {
    await this.handleExpirationNotifications();
  }
}
