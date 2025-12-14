import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getNotifications(userId: string): Promise<Notification[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
  }

  async createNotification(
    userId: string,
    notificationData: Omit<Notification, 'id' | 'userId' | 'createdAt'>,
  ): Promise<Notification> {
    const now = Timestamp.now();
    const docRef = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .add({
        ...notificationData,
        userId,
        createdAt: now,
      });

    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() } as Notification;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notificationRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(notificationId);

    const doc = await notificationRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Notification not found');
    }

    await notificationRef.update({ isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .where('isRead', '==', false)
      .get();

    const batch = this.firestore.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
  }
}
