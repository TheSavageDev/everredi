import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { SUPABASE } from '../config/supabase.provider';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { AdvancedNotificationsService } from './advanced-notifications.service';
import type { ExpirationTaskPayload } from './cloud-tasks.service';

const logger = new Logger('ExpirationTasksController');

@Controller('notifications')
export class ExpirationTasksController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly advancedNotificationsService: AdvancedNotificationsService,
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  private validateTaskAuth(taskSecretHeader?: string) {
    const expectedSecret = this.configService.get<string>(
      'CLOUD_TASKS_TASK_SECRET',
    );
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';

    if (!expectedSecret) {
      if (nodeEnv !== 'production') {
        logger.warn(
          'CLOUD_TASKS_TASK_SECRET is not configured; skipping task auth check in non-production environment.',
        );
        return;
      }

      logger.error(
        'CLOUD_TASKS_TASK_SECRET is not configured in production. Rejecting Cloud Tasks request.',
      );
      throw new UnauthorizedException('Task authentication misconfigured');
    }

    if (!taskSecretHeader || taskSecretHeader !== expectedSecret) {
      logger.warn(
        'Received Cloud Tasks expiration request with invalid or missing x-task-secret header.',
      );
      throw new UnauthorizedException('Invalid task authentication');
    }
  }

  /**
   * Endpoint called by Cloud Tasks to send expiration notification
   * This endpoint should be publicly accessible but protected by Cloud Tasks authentication
   */
  @Post('expiration')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handleExpirationTask(
    @Body() payload: ExpirationTaskPayload,
    @Headers('x-task-secret') taskSecret?: string,
  ) {
    this.validateTaskAuth(taskSecret);

    logger.log(
      `Processing expiration task for item ${payload.itemId}, ${payload.daysUntilExpiration} days before expiration`,
    );

    try {
      // Verify the item still exists and expiration date is still relevant
      let item;
      try {
        const { data: itemData, error: itemError } = await this.supabase
          .from('inventory_items')
          .select('*')
          .eq('id', payload.itemId)
          .eq('user_id', payload.userId)
          .single();

        if (itemError || !itemData) {
          logger.warn(
            `Item ${payload.itemId} not found, skipping notification`,
          );
          return {
            success: true,
            message: 'Item not found, notification skipped',
          };
        }

        item = itemData;
      } catch (error) {
        logger.warn(`Error fetching item ${payload.itemId}:`, error);
        return {
          success: true,
          message: 'Error fetching item, notification skipped',
        };
      }

      // Check if expiration date has changed
      if (item.expiration_date) {
        const itemExpirationDate = new Date(item.expiration_date);
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

        // Status is now based on quantities, not lifecycle state
        // Items with expiration dates can receive notifications regardless of status

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
        message: `${item.supply_name} expires in ${daysText}`,
        data: {
          itemId: payload.itemId,
          daysUntilExpiration: payload.daysUntilExpiration,
        },
        isRead: false,
        sentAt: new Date(),
      });

      const pushEnabled = await this.advancedNotificationsService.isPushEnabled(
        payload.userId,
      );
      if (pushEnabled) {
        await this.pushNotificationService.sendExpirationNotification(
          payload.userId,
          item.supply_name,
          payload.daysUntilExpiration,
          payload.itemId,
        );
      }

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
