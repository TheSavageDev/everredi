import { Injectable } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import type { firestore } from 'firebase-admin';
import { FirebaseService } from '../config/firebase.service';

export interface AffiliateClick {
  id: string;
  userId: string;
  supplyId: string;
  supplyName?: string;
  affiliateLink: string;
  source: 'inventory' | 'ai' | 'restock' | 'kit';
  timestamp: firestore.Timestamp;
  createdAt: firestore.Timestamp;
}

export interface TrackClickDto {
  supplyId: string;
  source: 'inventory' | 'ai' | 'restock' | 'kit';
}

@Injectable()
export class AffiliateTrackingService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async trackClick(
    userId: string,
    dto: TrackClickDto,
  ): Promise<AffiliateClick> {
    // Get supply information to include in tracking
    // throwIfNotFound will throw NotFoundException if document doesn't exist
    const supply = await this.firebaseService.getDocument<{
      affiliateLink?: string;
      name?: string;
    }>('supplies', dto.supplyId, { throwIfNotFound: true });

    // supply is guaranteed to be non-null here due to throwIfNotFound
    if (!supply) {
      // This should never happen due to throwIfNotFound, but TypeScript doesn't know that
      throw new Error(`Supply with id ${dto.supplyId} not found`);
    }

    const affiliateLink = supply.affiliateLink;

    if (!affiliateLink) {
      throw new Error(`Supply ${dto.supplyId} does not have an affiliate link`);
    }

    // Create click tracking document
    return this.firebaseService.addDocument<AffiliateClick>('affiliateClicks', {
      userId,
      supplyId: dto.supplyId,
      supplyName: supply.name,
      affiliateLink,
      source: dto.source,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
    });
  }

  async getClicksByUser(
    userId: string,
    limit: number = 100,
  ): Promise<AffiliateClick[]> {
    try {
      // Try query with orderBy (requires composite index)
      return this.firebaseService.getCollection<AffiliateClick>(
        'affiliateClicks',
        {
          where: [{ field: 'userId', operator: '==', value: userId }],
          orderBy: { field: 'timestamp', direction: 'desc' },
          limit,
        },
      );
    } catch (error: unknown) {
      // If index doesn't exist, fall back to query without orderBy and sort in memory
      const errorObj = error as { code?: number; message?: string };
      if (errorObj.code === 9 || errorObj.message?.includes('index')) {
        const clicks = await this.firebaseService.getCollection<AffiliateClick>(
          'affiliateClicks',
          {
            where: [{ field: 'userId', operator: '==', value: userId }],
          },
        );

        // Sort by timestamp descending in memory
        clicks.sort((a, b) => {
          const aTime = a.timestamp?.toMillis() ?? 0;
          const bTime = b.timestamp?.toMillis() ?? 0;
          return Number(bTime) - Number(aTime);
        });

        return clicks.slice(0, limit);
      }
      throw error;
    }
  }
}
