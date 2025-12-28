import { Injectable } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';

@Injectable()
export class ExpirationService {
  constructor(private readonly firebaseService: FirebaseService) {}

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
          orderBy: { field: 'expirationDate', direction: 'asc' },
        },
      );

      results.push(...items.map((item) => ({ ...item, thresholdDays: days })));
    }

    return results;
  }

  async bulkUpdateExpirationDates(
    userId: string,
    updates: Array<{ itemId: string; expirationDate: Timestamp }>,
  ): Promise<void> {
    const batch = this.firebaseService.createBatch();

    for (const update of updates) {
      const ref = this.firebaseService.getSubcollectionDocumentRef(
        'users',
        userId,
        'inventoryItems',
        update.itemId,
      );
      batch.update(ref, {
        expirationDate: update.expirationDate,
        updatedAt: Timestamp.now(),
      });
    }

    await batch.commit();
  }
}
