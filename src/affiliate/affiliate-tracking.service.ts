import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async trackClick(
    userId: string,
    dto: TrackClickDto,
  ): Promise<AffiliateClick> {
    // Get supply information to include in tracking
    const supplyDoc = await this.firestore
      .collection('supplies')
      .doc(dto.supplyId)
      .get();

    if (!supplyDoc.exists) {
      throw new Error(`Supply with id ${dto.supplyId} not found`);
    }

    const supplyData = supplyDoc.data();
    const affiliateLink = supplyData?.affiliateLink;

    if (!affiliateLink) {
      throw new Error(`Supply ${dto.supplyId} does not have an affiliate link`);
    }

    // Create click tracking document
    const clickData: Omit<AffiliateClick, 'id'> = {
      userId,
      supplyId: dto.supplyId,
      supplyName: supplyData?.name,
      affiliateLink,
      source: dto.source,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
    };

    const docRef = await this.firestore
      .collection('affiliateClicks')
      .add(clickData);

    return {
      id: docRef.id,
      ...clickData,
    };
  }

  async getClicksByUser(
    userId: string,
    limit: number = 100,
  ): Promise<AffiliateClick[]> {
    try {
      // Try query with orderBy (requires composite index)
      const snapshot = await this.firestore
        .collection('affiliateClicks')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AffiliateClick[];
    } catch (error: any) {
      // If index doesn't exist, fall back to query without orderBy and sort in memory
      if (error.code === 9 || error.message?.includes('index')) {
        const snapshot = await this.firestore
          .collection('affiliateClicks')
          .where('userId', '==', userId)
          .get();

        const clicks = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AffiliateClick[];

        // Sort by timestamp descending in memory
        clicks.sort((a, b) => {
          const aTime = a.timestamp?.toMillis() || 0;
          const bTime = b.timestamp?.toMillis() || 0;
          return bTime - aTime;
        });

        return clicks.slice(0, limit);
      }
      throw error;
    }
  }
}
