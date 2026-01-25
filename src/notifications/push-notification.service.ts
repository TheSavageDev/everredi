import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { DeviceTokensService } from './device-tokens.service';
import * as admin from 'firebase-admin';

const logger = new Logger('PushNotificationService');

@Injectable()
export class PushNotificationService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly deviceTokensService: DeviceTokensService,
  ) {}

  /**
   * Send expiration notification to user's devices
   */
  async sendExpirationNotification(
    userId: string,
    itemName: string,
    daysUntilExpiration: number,
    itemId: string,
  ): Promise<void> {
    try {
      const deviceTokens =
        await this.deviceTokensService.getUserDeviceTokens(userId);

      if (deviceTokens.length === 0) {
        logger.warn(`No device tokens found for user ${userId}`);
        return;
      }

      const daysText =
        daysUntilExpiration === 1 ? '1 day' : `${daysUntilExpiration} days`;
      const title = 'Item Expiring Soon';
      const body = `${itemName} expires in ${daysText}`;

      const messages = deviceTokens.map((device) => {
        const message: admin.messaging.Message = {
          token: device.token,
          notification: {
            title,
            body,
          },
          data: {
            type: 'expiration_warning',
            itemId,
            daysUntilExpiration: String(daysUntilExpiration),
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                category: 'EXPIRATION_ALERT',
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'expiration-alerts',
              sound: 'default',
            },
          },
        };

        return message;
      });

      // Send messages in batches (FCM allows up to 500 per batch)
      const batchSize = 500;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const response = await admin.messaging().sendEach(batch);

        // Log results
        response.responses.forEach((resp, idx) => {
          if (resp.success) {
            logger.log(`Successfully sent notification to device ${i + idx}`);
          } else {
            logger.error(
              `Failed to send notification to device ${i + idx}:`,
              resp.error,
            );

            // If token is invalid, remove it from database
            if (
              resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered'
            ) {
              this.removeInvalidToken(
                userId,
                deviceTokens[i + idx].token,
              ).catch((err) => {
                logger.error(`Error removing invalid token:`, err);
              });
            }
          }
        });
      }

      logger.log(
        `Sent expiration notifications to ${deviceTokens.length} device(s) for user ${userId}`,
      );
    } catch (error) {
      logger.error(
        `Error sending expiration notification for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove invalid device token from database
   */
  private async removeInvalidToken(
    userId: string,
    token: string,
  ): Promise<void> {
    try {
      await this.deviceTokensService.removeDeviceToken(userId, token);
      logger.log(`Removed invalid token for user ${userId}`);
    } catch (error) {
      logger.error(`Error removing invalid token:`, error);
    }
  }
}
