import { Injectable, NotFoundException } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';

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
  constructor(private readonly firebaseService: FirebaseService) {}

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
    let partnerships =
      await this.firebaseService.getCollection<BrandPartnership>(
        'brandPartnerships',
        {
          where: [
            { field: 'isActive', operator: '==', value: true },
            { field: 'startDate', operator: '<=', value: now },
          ],
        },
      );

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
    const partnerships =
      await this.firebaseService.getCollection<BrandPartnership>(
        'brandPartnerships',
        {
          orderBy: { field: 'priority', direction: 'desc' },
        },
      );
    // Secondary sort by brandName (Firestore only supports one orderBy, so we do it in memory)
    return partnerships.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.brandName.localeCompare(b.brandName);
    });
  }

  async getPartnership(
    partnershipId: string,
  ): Promise<BrandPartnership | null> {
    return this.firebaseService.getDocument<BrandPartnership>(
      'brandPartnerships',
      partnershipId,
    );
  }

  async createPartnership(
    partnershipData: Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandPartnership> {
    return this.firebaseService.addDocument<BrandPartnership>(
      'brandPartnerships',
      {
        ...partnershipData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    );
  }

  async updatePartnership(
    partnershipId: string,
    updates: Partial<Omit<BrandPartnership, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandPartnership> {
    return this.firebaseService.updateDocument<BrandPartnership>(
      'brandPartnerships',
      partnershipId,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deletePartnership(partnershipId: string): Promise<void> {
    await this.firebaseService.deleteDocument(
      'brandPartnerships',
      partnershipId,
    );
  }
}
