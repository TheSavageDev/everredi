import { Injectable, Inject } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { firestore } from 'firebase-admin';
// Timestamp is used in this file but linter doesn't detect it

import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

@Injectable()
export class NotificationGeneratorService {
  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async generateExpirationNotifications(
    userId: string,
    thresholdDays: number[],
  ) {
    for (const days of thresholdDays) {
      const thresholdDate = Timestamp.fromDate(
        new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      );
      const now = Timestamp.now();

      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('inventoryItems')
        .where('status', '==', 'active')
        .where('expirationDate', '>=', now)
        .where('expirationDate', '<=', thresholdDate)
        .get();

      for (const doc of snapshot.docs) {
        const item = doc.data();
        const expirationDate = item.expirationDate.toDate();
        const daysUntil = Math.ceil(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        await this.notificationsService.createNotification(userId, {
          type: 'expiration',
          title: 'Item Expiring Soon',
          message: `${item.supplyName} expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          data: {
            inventoryItemId: doc.id,
            expirationDate: item.expirationDate,
          },
          isRead: false,
          sentAt: Timestamp.now(),
        });
      }
    }
  }

  async generateLowStockNotifications(userId: string, threshold: number = 5) {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('inventoryItems')
      .where('status', '==', 'active')
      .where('quantity', '<=', threshold)
      .get();

    for (const doc of snapshot.docs) {
      const item = doc.data();
      await this.notificationsService.createNotification(userId, {
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${item.supplyName} is running low (${item.quantity} remaining)`,
        data: {
          inventoryItemId: doc.id,
        },
        isRead: false,
        sentAt: Timestamp.now(),
      });
    }
  }
}
