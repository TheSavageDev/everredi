import { Injectable, Inject, Logger } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

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
      const existingSnapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('deviceTokens')
        .where('token', '==', token)
        .get();

      const now = Timestamp.now();

      if (!existingSnapshot.empty) {
        // Update existing token
        const doc = existingSnapshot.docs[0];
        await doc.ref.update({
          platform,
          updatedAt: now,
        });
        logger.log(`Updated device token for user ${userId}`);
      } else {
        // Create new token
        await this.firestore
          .collection('users')
          .doc(userId)
          .collection('deviceTokens')
          .add({
            token,
            platform,
            userId,
            createdAt: now,
            updatedAt: now,
          });
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
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('deviceTokens')
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeviceToken[];
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
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('deviceTokens')
        .where('token', '==', token)
        .get();

      const batch = this.firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

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
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('deviceTokens')
        .get();

      const batch = this.firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

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
