import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

@Injectable()
export class ExpirationService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getExpiringItemsByThreshold(
    userId: string,
    thresholdDays: number[],
  ): Promise<any[]> {
    const results: any[] = [];

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
        .orderBy('expirationDate', 'asc')
        .get();

      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        thresholdDays: days,
      }));

      results.push(...items);
    }

    return results;
  }

  async bulkUpdateExpirationDates(
    userId: string,
    updates: Array<{ itemId: string; expirationDate: Timestamp }>,
  ): Promise<void> {
    const batch = this.firestore.batch();

    for (const update of updates) {
      const itemRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('inventoryItems')
        .doc(update.itemId);

      batch.update(itemRef, {
        expirationDate: update.expirationDate,
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
  }
}
