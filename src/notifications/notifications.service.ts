import { Injectable, NotFoundException } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';

export interface Notification {
  id: string;
  userId: string;
  type: 'expiration' | 'low_stock' | 'compliance' | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  sentAt?: Timestamp;
  createdAt: Timestamp;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.firebaseService.getSubcollection<Notification>(
      'users',
      userId,
      'notifications',
      {
        orderBy: { field: 'createdAt', direction: 'desc' },
        limit: 100,
      },
    );
  }

  async createNotification(
    userId: string,
    notificationData: Omit<Notification, 'id' | 'userId' | 'createdAt'>,
  ): Promise<Notification> {
    return this.firebaseService.addSubcollectionDocument<Notification>(
      'users',
      userId,
      'notifications',
      {
        ...notificationData,
        userId,
        createdAt: Timestamp.now(),
      },
    );
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.firebaseService.updateSubcollectionDocument(
      'users',
      userId,
      'notifications',
      notificationId,
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    const unreadNotifications = await this.firebaseService.getSubcollection(
      'users',
      userId,
      'notifications',
      {
        where: [{ field: 'isRead', operator: '==', value: false }],
      },
    );

    const batch = this.firebaseService.createBatch();
    for (const notification of unreadNotifications) {
      const ref = this.firebaseService.getSubcollectionDocumentRef(
        'users',
        userId,
        'notifications',
        notification.id,
      );
      batch.update(ref, { isRead: true });
    }

    await batch.commit();
  }
}
