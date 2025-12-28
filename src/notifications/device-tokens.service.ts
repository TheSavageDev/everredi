import { Injectable, Logger } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';

const logger = new Logger('DeviceTokensService');

export interface DeviceToken {
  id?: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DeviceTokensService {
  constructor(private readonly firebaseService: FirebaseService) {}

  /**
   * Register or update a device token for a user
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    try {
      // Check if token already exists for this user
      const existing = await this.firebaseService.getSubcollection(
        'users',
        userId,
        'deviceTokens',
        {
          where: [{ field: 'token', operator: '==', value: token }],
          limit: 1,
        },
      );

      const now = Timestamp.now();

      if (existing.length > 0) {
        // Update existing token
        await this.firebaseService.updateSubcollectionDocument(
          'users',
          userId,
          'deviceTokens',
          existing[0].id,
          {
            platform,
            updatedAt: now,
          },
        );
        logger.log(`Updated device token for user ${userId}`);
      } else {
        // Create new token
        await this.firebaseService.addSubcollectionDocument(
          'users',
          userId,
          'deviceTokens',
          {
            token,
            platform,
            userId,
            createdAt: now,
            updatedAt: now,
          },
        );
        logger.log(`Registered new device token for user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error registering device token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all device tokens for a user
   */
  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    try {
      return this.firebaseService.getSubcollection<DeviceToken>(
        'users',
        userId,
        'deviceTokens',
      );
    } catch (error) {
      logger.error(`Error getting device tokens for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Remove a device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
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
      logger.log(`Removed device token for user ${userId}`);
    } catch (error) {
      logger.error(`Error removing device token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove all device tokens for a user (e.g., on logout)
   */
  async removeAllUserTokens(userId: string): Promise<void> {
    try {
      const tokens = await this.firebaseService.getSubcollection(
        'users',
        userId,
        'deviceTokens',
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
      logger.log(`Removed all device tokens for user ${userId}`);
    } catch (error) {
      logger.error(
        `Error removing all device tokens for user ${userId}:`,
        error,
      );
      throw error;
    }
  }
}
