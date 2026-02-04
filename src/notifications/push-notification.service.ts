import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { DeviceTokensService } from './device-tokens.service';
import { AdvancedNotificationsService } from './advanced-notifications.service';
import * as admin from 'firebase-admin';

const logger = new Logger('PushNotificationService');
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_PREFIX = 'ExponentPushToken[';

function isExpoToken(token: string): boolean {
  return token.startsWith(EXPO_TOKEN_PREFIX);
}

@Injectable()
export class PushNotificationService {
  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    private readonly deviceTokensService: DeviceTokensService,
    private readonly advancedNotificationsService: AdvancedNotificationsService,
  ) {}

  /**
   * Send low-stock notification to user's devices (Expo and FCM)
   */
  async sendLowStockNotification(
    userId: string,
    supplyName: string,
    currentQuantity: number,
    minimumQuantity: number,
    alertId: string,
  ): Promise<void> {
    const title = 'Low stock alert';
    const body = `${supplyName} is below your minimum (${currentQuantity} / ${minimumQuantity})`;
    const data = {
      type: 'low_stock',
      alertId,
      supplyName,
      currentQuantity: String(currentQuantity),
      minimumQuantity: String(minimumQuantity),
    };
    await this.sendToUserDevices(userId, { title, body, data });
  }

  /**
   * Send expiration notification to user's devices (Expo and FCM)
   */
  async sendExpirationNotification(
    userId: string,
    itemName: string,
    daysUntilExpiration: number,
    itemId: string,
  ): Promise<void> {
    const daysText =
      daysUntilExpiration === 1 ? '1 day' : `${daysUntilExpiration} days`;
    const title = 'Item Expiring Soon';
    const body = `${itemName} expires in ${daysText}`;
    const data = {
      type: 'expiration_warning',
      itemId,
      daysUntilExpiration: String(daysUntilExpiration),
    };
    await this.sendToUserDevices(userId, { title, body, data });
  }

  /**
   * Send broadcast to all users with notifications enabled (push_enabled and at least one device token).
   * Returns summary: userCount, messageCount, errors.
   */
  async sendBroadcast(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ userCount: number; messageCount: number; errors: string[] }> {
    const userIds =
      await this.deviceTokensService.getDistinctUserIdsWithActiveTokens();
    const errors: string[] = [];
    let messageCount = 0;
    let sentUserCount = 0;

    for (const userId of userIds) {
      const pushEnabled =
        await this.advancedNotificationsService.isPushEnabled(userId);
      if (!pushEnabled) continue;

      try {
        const count = await this.sendToUserDevices(userId, {
          title,
          body,
          data: data ?? {},
        });
        messageCount += count;
        sentUserCount += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`user ${userId}: ${msg}`);
        logger.warn(`Broadcast failed for user ${userId}: ${msg}`);
      }
    }

    logger.log(
      `Broadcast sent to ${sentUserCount} users, ${messageCount} messages, ${errors.length} errors`,
    );
    return {
      userCount: sentUserCount,
      messageCount,
      errors,
    };
  }

  /**
   * Send title/body/data to all of a user's devices (Expo + FCM). Returns number of messages sent.
   */
  private async sendToUserDevices(
    userId: string,
    payload: { title: string; body: string; data: Record<string, string> },
  ): Promise<number> {
    const deviceTokens =
      await this.deviceTokensService.getUserDeviceTokens(userId);
    if (deviceTokens.length === 0) {
      logger.warn(`No device tokens found for user ${userId}`);
      return 0;
    }

    const expoDevices = deviceTokens.filter((d) => isExpoToken(d.token));
    const fcmDevices = deviceTokens.filter((d) => !isExpoToken(d.token));

    if (expoDevices.length > 0) {
      await this.sendExpoPush(
        userId,
        expoDevices.map((d) => d.token),
        payload,
      );
    }

    if (fcmDevices.length > 0) {
      const messages: admin.messaging.Message[] = fcmDevices.map((device) => ({
        token: device.token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
      }));

      const batchSize = 500;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const response = await admin.messaging().sendEach(batch);
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            logger.error(
              `Failed to send FCM to device ${i + idx}:`,
              resp.error,
            );
            if (
              resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered'
            ) {
              this.removeInvalidToken(userId, fcmDevices[i + idx].token).catch(
                (err) => logger.error(`Error removing invalid token:`, err),
              );
            }
          }
        });
      }
    }

    return deviceTokens.length;
  }

  /**
   * Send push via Expo Push API (for ExponentPushToken[...] tokens)
   */
  private async sendExpoPush(
    userId: string,
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    const messages = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: 'default' as const,
      data: payload.data ?? {},
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const body = batch.length === 1 ? batch[0] : batch;
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        logger.error(`Expo push request failed: ${res.status} ${errText}`);
        throw new Error(`Expo push failed: ${res.status}`);
      }

      const result = (await res.json()) as {
        data?: Array<{
          status: string;
          id?: string;
          message?: string;
          details?: { error?: string };
        }>;
        errors?: Array<{ code: string; message: string }>;
      };

      if (result.errors?.length) {
        logger.error(`Expo push errors: ${JSON.stringify(result.errors)}`);
      }

      const tickets = Array.isArray(result.data)
        ? result.data
        : result.data != null
          ? [result.data]
          : [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          const token = tokens[i + idx];
          logger.warn(`Expo push ticket error for token: ${ticket.message}`);
          if (ticket.details?.error === 'DeviceNotRegistered' && token) {
            this.removeInvalidToken(userId, token).catch((err) =>
              logger.error(`Error removing invalid Expo token:`, err),
            );
          }
        }
      });
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
