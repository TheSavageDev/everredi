import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../config/firebase.service';
import * as admin from 'firebase-admin';
import { DocumentData, Timestamp } from 'firebase-admin/firestore';

const logger = new Logger('PushNotificationService');

interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PushNotificationService {
  constructor(private readonly firebaseService: FirebaseService) {}

  /**
   * Get all device tokens for a user
   */
  private async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    try {
      const tokens = await this.firebaseService.getSubcollection<{
        token: string;
        platform: string;
        userId: string;
        createdAt?: Timestamp;
        updatedAt?: Timestamp;
      }>('users', userId, 'deviceTokens');

      return tokens.map((doc) => {
        const data = doc as DocumentData;
        const token: string = data.token as string;
        const platform: string = data.platform as string;
        const userId: string = data.userId as string;
        const createdAt: Date =
          (data.createdAt as Timestamp)?.toDate() || new Date();
        const updatedAt: Date =
          (data.updatedAt as Timestamp)?.toDate() || new Date();

        return {
          id: doc.id,
          token,
          platform: platform as 'ios' | 'android' | 'web',
          userId,
          createdAt,
          updatedAt,
        } as DeviceToken;
      });
    } catch (error) {
      logger.error(`Error getting device tokens for user ${userId}:`, error);
      return [];
    }
  }

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
      const deviceTokens = await this.getUserDeviceTokens(userId);

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
      const tokens = await this.firebaseService.getSubcollection(
        'users',
        userId,
        'deviceTokens',
        {
          where: [{ field: 'token', operator: '==', value: token }],
        },
      );

      const batch = this.firebaseService.createBatch();
      for (const tokenDoc of tokens) {
        const ref = this.firebaseService.getSubcollectionDocumentRef(
          'users',
          userId,
          'deviceTokens',
          tokenDoc.id,
        );
        batch.delete(ref);
      }

      await batch.commit();
      logger.log(`Removed invalid token for user ${userId}`);
    } catch (error) {
      logger.error(`Error removing invalid token:`, error);
    }
  }
}
