import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
import { UsersService } from '../users/users.service';

export interface AlertThreshold {
  id: string;
  userId: string;
  categoryId?: string;
  daysBeforeExpiration: number;
  alertLevel: 'warning' | 'critical';
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LowStockAlert {
  id: string;
  userId: string;
  supplyId: string;
  supplyName: string;
  minimumQuantity: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  expirationAlertsEnabled: boolean;
  lowStockAlertsEnabled: boolean;
  usageRemindersEnabled: boolean;
  updatedAt: Timestamp;
}

@Injectable()
export class AdvancedNotificationsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly usersService: UsersService,
  ) {}

  async getAlertThresholds(userId: string): Promise<AlertThreshold[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('alertThresholds')
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      userId,
      ...doc.data(),
    })) as AlertThreshold[];
  }

  async createAlertThreshold(
    userId: string,
    thresholdData: Omit<
      AlertThreshold,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<AlertThreshold> {
    const now = Timestamp.now();
    const docRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('alertThresholds')
      .doc();

    const threshold: Omit<AlertThreshold, 'id'> = {
      userId,
      ...thresholdData,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(threshold);
    return { id: docRef.id, ...threshold };
  }

  async updateAlertThreshold(
    userId: string,
    thresholdId: string,
    updates: Partial<Omit<AlertThreshold, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<AlertThreshold> {
    const thresholdRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('alertThresholds')
      .doc(thresholdId);

    await thresholdRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const doc = await thresholdRef.get();
    return { id: doc.id, userId, ...doc.data() } as AlertThreshold;
  }

  async deleteAlertThreshold(
    userId: string,
    thresholdId: string,
  ): Promise<void> {
    await this.firestore
      .collection('users')
      .doc(userId)
      .collection('alertThresholds')
      .doc(thresholdId)
      .delete();
  }

  async getLowStockAlerts(userId: string): Promise<LowStockAlert[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('lowStockAlerts')
      .where('isActive', '==', true)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      userId,
      ...doc.data(),
    })) as LowStockAlert[];
  }

  async createLowStockAlert(
    userId: string,
    alertData: Omit<LowStockAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<LowStockAlert> {
    const now = Timestamp.now();
    const docRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('lowStockAlerts')
      .doc();

    const alert: Omit<LowStockAlert, 'id'> = {
      userId,
      ...alertData,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(alert);
    return { id: docRef.id, ...alert };
  }

  async updateLowStockAlert(
    userId: string,
    alertId: string,
    updates: Partial<Omit<LowStockAlert, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<LowStockAlert> {
    const alertRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('lowStockAlerts')
      .doc(alertId);

    await alertRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const doc = await alertRef.get();
    return { id: doc.id, userId, ...doc.data() } as LowStockAlert;
  }

  async deleteLowStockAlert(userId: string, alertId: string): Promise<void> {
    await this.firestore
      .collection('users')
      .doc(userId)
      .collection('lowStockAlerts')
      .doc(alertId)
      .delete();
  }

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    const doc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('notificationPreferences')
      .doc('preferences')
      .get();

    if (!doc.exists) {
      // Return defaults
      return {
        userId,
        emailEnabled: true,
        pushEnabled: true,
        emailFrequency: 'immediate',
        expirationAlertsEnabled: true,
        lowStockAlertsEnabled: true,
        usageRemindersEnabled: false,
        updatedAt: Timestamp.now(),
      };
    }

    return { userId, ...doc.data() } as NotificationPreferences;
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>,
  ): Promise<NotificationPreferences> {
    const prefsRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('notificationPreferences')
      .doc('preferences');

    const existing = await prefsRef.get();
    const now = Timestamp.now();

    if (!existing.exists) {
      await prefsRef.set({
        userId,
        emailEnabled: true,
        pushEnabled: true,
        emailFrequency: 'immediate',
        expirationAlertsEnabled: true,
        lowStockAlertsEnabled: true,
        usageRemindersEnabled: false,
        ...preferences,
        updatedAt: now,
      });
    } else {
      await prefsRef.update({
        ...preferences,
        updatedAt: now,
      });
    }

    const doc = await prefsRef.get();
    return { userId, ...doc.data() } as NotificationPreferences;
  }
}


