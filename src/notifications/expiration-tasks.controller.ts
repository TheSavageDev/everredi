import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import type { ExpirationTaskPayload } from './cloud-tasks.service';
import { Timestamp } from 'firebase-admin/firestore';
import { Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { FIRESTORE } from '../config/firebase.provider';

const logger = new Logger('ExpirationTasksController');

@Controller('notifications')
export class ExpirationTasksController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationService: PushNotificationService,
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  /**
   * Endpoint called by Cloud Tasks to send expiration notification
   * This endpoint should be publicly accessible but protected by Cloud Tasks authentication
   */
  @Post('expiration')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handleExpirationTask(@Body() payload: ExpirationTaskPayload) {
    logger.log(
      `Processing expiration task for item ${payload.itemId}, ${payload.daysUntilExpiration} days before expiration`,
    );

    try {
      // Verify the item still exists and expiration date is still relevant
      let item;
      try {
        const itemDoc = await this.firestore
          .collection('users')
          .doc(payload.userId)
          .collection('inventoryItems')
          .doc(payload.itemId)
          .get();

        if (!itemDoc.exists) {
          logger.warn(
            `Item ${payload.itemId} not found, skipping notification`,
          );
          return {
            success: true,
            message: 'Item not found, notification skipped',
          };
        }

        item = { id: itemDoc.id, ...itemDoc.data() } as any;
      } catch (error) {
        logger.warn(`Error fetching item ${payload.itemId}:`, error);
        return {
          success: true,
          message: 'Error fetching item, notification skipped',
        };
      }

      // Check if expiration date has changed
      if (item.expirationDate) {
        const itemExpirationDate = item.expirationDate.toDate();
        const expectedExpirationDate = new Date(payload.expirationDate);

        // If expiration date changed significantly (more than 1 day difference), skip notification
        const daysDifference = Math.abs(
          (itemExpirationDate.getTime() - expectedExpirationDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysDifference > 1) {
          logger.warn(
            `Item ${payload.itemId} expiration date changed from ${expectedExpirationDate.toISOString()} to ${itemExpirationDate.toISOString()}, skipping notification`,
          );
          return {
            success: true,
            message: 'Expiration date changed, notification skipped',
          };
        }

        // Check if item is still active
        if (item.status !== 'active') {
          logger.warn(
            `Item ${payload.itemId} is not active (status: ${item.status}), skipping notification`,
          );
          return {
            success: true,
            message: 'Item not active, notification skipped',
          };
        }

        // Calculate actual days until expiration
        const now = new Date();
        const actualDaysUntilExpiration = Math.ceil(
          (itemExpirationDate.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        // Only send notification if we're within 2 days of the expected alert date
        // This handles slight timing differences
        if (
          Math.abs(actualDaysUntilExpiration - payload.daysUntilExpiration) > 2
        ) {
          logger.warn(
            `Item ${payload.itemId} days until expiration (${actualDaysUntilExpiration}) doesn't match expected (${payload.daysUntilExpiration}), skipping notification`,
          );
          return {
            success: true,
            message: 'Timing mismatch, notification skipped',
          };
        }
      } else {
        // Item no longer has expiration date
        logger.warn(
          `Item ${payload.itemId} no longer has expiration date, skipping notification`,
        );
        return {
          success: true,
          message: 'Item has no expiration date, notification skipped',
        };
      }

      // Create in-app notification
      const daysText =
        payload.daysUntilExpiration === 1
          ? '1 day'
          : `${payload.daysUntilExpiration} days`;
      await this.notificationsService.createNotification(payload.userId, {
        type: 'expiration',
        title: 'Item Expiring Soon',
        message: `${item.supplyName} expires in ${daysText}`,
        data: {
          itemId: payload.itemId,
          daysUntilExpiration: payload.daysUntilExpiration,
        },
        isRead: false,
        sentAt: Timestamp.now(),
      });

      // Send push notification
      await this.pushNotificationService.sendExpirationNotification(
        payload.userId,
        item.supplyName,
        payload.daysUntilExpiration,
        payload.itemId,
      );

      logger.log(
        `Successfully sent expiration notification for item ${payload.itemId}`,
      );
      return { success: true, message: 'Notification sent successfully' };
    } catch (error) {
      logger.error(
        `Error processing expiration task for item ${payload.itemId}:`,
        error,
      );
      // Return success to prevent Cloud Tasks from retrying
      // Log the error for manual investigation
      return {
        success: false,
        message: 'Error processing notification',
        error: error.message,
      };
    }
  }
}
