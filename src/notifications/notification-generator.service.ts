import { Injectable } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';

@Injectable()
export class NotificationGeneratorService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly firebaseService: FirebaseService,
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

      const items = await this.firebaseService.getSubcollection(
        'users',
        userId,
        'inventoryItems',
        {
          where: [
            { field: 'status', operator: '==', value: 'active' },
            { field: 'expirationDate', operator: '>=', value: now },
            { field: 'expirationDate', operator: '<=', value: thresholdDate },
          ],
        },
      );

      for (const item of items) {
        const expirationDate = item.expirationDate.toDate();
        const daysUntil = Math.ceil(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        await this.notificationsService.createNotification(userId, {
          type: 'expiration',
          title: 'Item Expiring Soon',
          message: `${item.supplyName} expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          data: {
            inventoryItemId: item.id,
            expirationDate: item.expirationDate,
          },
          isRead: false,
          sentAt: Timestamp.now(),
        });
      }
    }
  }

  async generateLowStockNotifications(userId: string, threshold: number = 5) {
    const items = await this.firebaseService.getSubcollection(
      'users',
      userId,
      'inventoryItems',
      {
        where: [
          { field: 'status', operator: '==', value: 'active' },
          { field: 'quantity', operator: '<=', value: threshold },
        ],
      },
    );

    for (const item of items) {
      await this.notificationsService.createNotification(userId, {
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${item.supplyName} is running low (${item.quantity} remaining)`,
        data: {
          inventoryItemId: item.id,
        },
        isRead: false,
        sentAt: Timestamp.now(),
      });
    }
  }
}
