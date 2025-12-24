import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { FIRESTORE } from '../config/firebase.provider';

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
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getSupplies(categoryId?: string): Promise<Supply[]> {
    let query = this.firestore
      .collection('supplies')
      .where('isActive', '==', true);

    if (categoryId) {
      query = query.where('categoryId', '==', categoryId);
    }

    const snapshot = await query.orderBy('name').get();
    const supplies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Supply[];

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
    const snapshot = await this.firestore
      .collection('supplies')
      .where('isActive', '==', true)
      .get();

    const allSupplies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Supply[];

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
    const doc = await this.firestore.collection('supplies').doc(supplyId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as Supply;
  }

  async updateSupply(
    supplyId: string,
    updates: Partial<Omit<Supply, 'id' | 'createdAt'>>,
  ): Promise<Supply> {
    const supplyRef = this.firestore.collection('supplies').doc(supplyId);
    await supplyRef.update({
      ...updates,
      updatedAt: new Date(),
    });
    const updatedDoc = await supplyRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Supply;
  }
}
