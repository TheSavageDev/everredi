import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

export interface BrandPartnership {
  id: string;
  brandName: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  categoryIds?: string[]; // Which categories this brand applies to
  isActive: boolean;
  partnershipType: 'featured' | 'recommended' | 'sponsor';
  priority: number;
  startDate: Timestamp;
  endDate?: Timestamp; // Optional expiration
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class BrandPartnershipsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  /**
   * Gets all active brand partnerships, optionally filtered by category.
   *
   * This method:
   * - Returns only partnerships where `isActive === true`
   * - Filters out partnerships that haven't started yet (startDate > now)
   * - Filters out expired partnerships (endDate < now)
   * - Optionally filters by category IDs (shows partnerships that match any provided category)
   * - Sorts by priority (descending) then by partnership type (featured > sponsor > recommended)
   *
   * @param categoryIds - Optional array of category IDs to filter partnerships
   * @returns Promise resolving to array of active BrandPartnership objects
   *
   * @example
   * ```typescript
   * // Get all active partnerships
   * const all = await service.getActivePartnerships();
   *
   * // Get partnerships for specific categories
   * const medical = await service.getActivePartnerships(['medical', 'first-aid']);
   * ```
   */
  async getActivePartnerships(
    categoryIds?: string[],
  ): Promise<BrandPartnership[]> {
    const now = Timestamp.now();
    const query = this.firestore
      .collection('brandPartnerships')
      .where('isActive', '==', true)
      .where('startDate', '<=', now);

    const snapshot = await query.get();
    let partnerships = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BrandPartnership[];

    // Filter out expired partnerships
    partnerships = partnerships.filter((p) => {
      if (p.endDate && p.endDate.toMillis() < now.toMillis()) {
        return false;
      }
      return true;
    });

    // Filter by category if provided
    if (categoryIds && categoryIds.length > 0) {
      partnerships = partnerships.filter((p) => {
        if (!p.categoryIds || p.categoryIds.length === 0) {
          return true; // Show partnerships without category restrictions
        }
        return p.categoryIds.some((catId) => categoryIds.includes(catId));
      });
    }

    // Sort by priority (higher first), then by partnership type
    return partnerships.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      const typeOrder = { featured: 0, sponsor: 1, recommended: 2 };
      return typeOrder[a.partnershipType] - typeOrder[b.partnershipType];
    });
  }

  async getAllPartnerships(): Promise<BrandPartnership[]> {
    const snapshot = await this.firestore
      .collection('brandPartnerships')
      .orderBy('priority', 'desc')
      .orderBy('brandName', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BrandPartnership[];
  }

  async getPartnership(
    partnershipId: string,
  ): Promise<BrandPartnership | null> {
    const doc = await this.firestore
      .collection('brandPartnerships')
      .doc(partnershipId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as BrandPartnership;
  }

  async createPartnership(
    partnershipData: Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandPartnership> {
    const now = Timestamp.now();
    const partnershipRef = this.firestore.collection('brandPartnerships').doc();

    const partnership: Omit<BrandPartnership, 'id'> = {
      ...partnershipData,
      createdAt: now,
      updatedAt: now,
    };

    await partnershipRef.set(partnership);
    return { id: partnershipRef.id, ...partnership };
  }

  async updatePartnership(
    partnershipId: string,
    updates: Partial<Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandPartnership> {
    const partnershipRef = this.firestore
      .collection('brandPartnerships')
      .doc(partnershipId);

    const doc = await partnershipRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Brand partnership not found');
    }

    await partnershipRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const updatedDoc = await partnershipRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as BrandPartnership;
  }

  async deletePartnership(partnershipId: string): Promise<void> {
    const partnershipRef = this.firestore
      .collection('brandPartnerships')
      .doc(partnershipId);

    const doc = await partnershipRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Brand partnership not found');
    }

    await partnershipRef.delete();
  }
}
