import { Injectable } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
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
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  async getAlertThresholds(userId: string): Promise<AlertThreshold[]> {
    return this.firebaseService.getSubcollection<AlertThreshold>(
      'users',
      userId,
      'alertThresholds',
      {
        where: [{ field: 'isActive', operator: '==', value: true }],
      },
    );
  }

  async createAlertThreshold(
    userId: string,
    thresholdData: Omit<
      AlertThreshold,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<AlertThreshold> {
    return this.firebaseService.addSubcollectionDocument<AlertThreshold>(
      'users',
      userId,
      'alertThresholds',
      {
        userId,
        ...thresholdData,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    );
  }

  async updateAlertThreshold(
    userId: string,
    thresholdId: string,
    updates: Partial<Omit<AlertThreshold, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<AlertThreshold> {
    return this.firebaseService.updateSubcollectionDocument<AlertThreshold>(
      'users',
      userId,
      'alertThresholds',
      thresholdId,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deleteAlertThreshold(
    userId: string,
    thresholdId: string,
  ): Promise<void> {
    await this.firebaseService.deleteSubcollectionDocument(
      'users',
      userId,
      'alertThresholds',
      thresholdId,
    );
  }

  async getLowStockAlerts(userId: string): Promise<LowStockAlert[]> {
    return this.firebaseService.getSubcollection<LowStockAlert>(
      'users',
      userId,
      'lowStockAlerts',
      {
        where: [{ field: 'isActive', operator: '==', value: true }],
      },
    );
  }

  async createLowStockAlert(
    userId: string,
    alertData: Omit<LowStockAlert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<LowStockAlert> {
    return this.firebaseService.addSubcollectionDocument<LowStockAlert>(
      'users',
      userId,
      'lowStockAlerts',
      {
        userId,
        ...alertData,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    );
  }

  async updateLowStockAlert(
    userId: string,
    alertId: string,
    updates: Partial<Omit<LowStockAlert, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<LowStockAlert> {
    return this.firebaseService.updateSubcollectionDocument<LowStockAlert>(
      'users',
      userId,
      'lowStockAlerts',
      alertId,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deleteLowStockAlert(userId: string, alertId: string): Promise<void> {
    await this.firebaseService.deleteSubcollectionDocument(
      'users',
      userId,
      'lowStockAlerts',
      alertId,
    );
  }

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences | null> {
    const prefs =
      await this.firebaseService.getSubcollectionDocument<NotificationPreferences>(
        'users',
        userId,
        'notificationPreferences',
        'preferences',
      );

    if (!prefs) {
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

    return prefs;
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>,
  ): Promise<NotificationPreferences> {
    const existing = await this.firebaseService.getSubcollectionDocument(
      'users',
      userId,
      'notificationPreferences',
      'preferences',
    );
    const now = Timestamp.now();

    if (!existing) {
      return this.firebaseService.setSubcollectionDocument<NotificationPreferences>(
        'users',
        userId,
        'notificationPreferences',
        'preferences',
        {
          userId,
          emailEnabled: true,
          pushEnabled: true,
          emailFrequency: 'immediate',
          expirationAlertsEnabled: true,
          lowStockAlertsEnabled: true,
          usageRemindersEnabled: false,
          ...preferences,
          updatedAt: now,
        },
      );
    } else {
      return this.firebaseService.updateSubcollectionDocument<NotificationPreferences>(
        'users',
        userId,
        'notificationPreferences',
        'preferences',
        {
          ...preferences,
          updatedAt: now,
        },
      );
    }
  }
}
