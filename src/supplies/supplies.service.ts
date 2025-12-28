import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../config/firebase.service';

export interface Supply {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  brand?: string;
  model?: string;
  barcode?: string;
  sku?: string;
  unitType: 'piece' | 'box' | 'pack' | 'roll' | 'bottle' | 'tube';
  defaultExpirationDays?: number;
  oshaRequired: boolean;
  isActive: boolean;
  affiliateLink?: string; // Optional affiliate link for monetization
  isSponsored?: boolean; // Admin toggle
  sponsoredBy?: string; // Brand/partner name
  sponsoredUntil?: any; // Optional expiration (Timestamp)
  sponsoredPriority?: number; // For ordering (higher = shown first)
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class SuppliesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async getSupplies(categoryId?: string): Promise<Supply[]> {
    const whereConditions: Array<{
      field: string;
      operator: '==';
      value: boolean | string;
    }> = [{ field: 'isActive', operator: '==', value: true }];

    if (categoryId) {
      whereConditions.push({
        field: 'categoryId',
        operator: '==',
        value: categoryId,
      });
    }

    const supplies = await this.firebaseService.getCollection<Supply>(
      'supplies',
      {
        where: whereConditions,
        orderBy: { field: 'name', direction: 'asc' },
      },
    );

    // Sort: sponsored first (by priority desc), then by name
    return supplies.sort((a, b) => {
      if (a.isSponsored && !b.isSponsored) return -1;
      if (!a.isSponsored && b.isSponsored) return 1;
      if (a.isSponsored && b.isSponsored) {
        const priorityA = a.sponsoredPriority || 0;
        const priorityB = b.sponsoredPriority || 0;
        if (priorityA !== priorityB) return priorityB - priorityA;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async searchSupplies(term: string): Promise<Supply[]> {
    const allSupplies = await this.firebaseService.getCollection<Supply>(
      'supplies',
      {
        where: [{ field: 'isActive', operator: '==', value: true }],
      },
    );

    const searchTerm = term.toLowerCase();
    const filtered = allSupplies.filter(
      (supply) =>
        supply.name.toLowerCase().includes(searchTerm) ||
        supply.description?.toLowerCase().includes(searchTerm) ||
        supply.barcode?.toLowerCase().includes(searchTerm),
    );

    // Sort: sponsored first (by priority desc), then by name
    return filtered.sort((a, b) => {
      if (a.isSponsored && !b.isSponsored) return -1;
      if (!a.isSponsored && b.isSponsored) return 1;
      if (a.isSponsored && b.isSponsored) {
        const priorityA = a.sponsoredPriority || 0;
        const priorityB = b.sponsoredPriority || 0;
        if (priorityA !== priorityB) return priorityB - priorityA;
      }
      return a.name.localeCompare(b.name);
    });
  }

  async getSupply(supplyId: string): Promise<Supply | null> {
    return this.firebaseService.getDocument<Supply>('supplies', supplyId);
  }

  async updateSupply(
    supplyId: string,
    updates: Partial<Omit<Supply, 'id' | 'createdAt'>>,
  ): Promise<Supply> {
    return this.firebaseService.updateDocument<Supply>('supplies', supplyId, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}
