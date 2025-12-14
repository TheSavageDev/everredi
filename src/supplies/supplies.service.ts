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
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Supply[];
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
    return allSupplies.filter(
      (supply) =>
        supply.name.toLowerCase().includes(searchTerm) ||
        supply.description?.toLowerCase().includes(searchTerm) ||
        supply.barcode?.toLowerCase().includes(searchTerm),
    );
  }

  async getSupply(supplyId: string): Promise<Supply | null> {
    const doc = await this.firestore.collection('supplies').doc(supplyId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as Supply;
  }
}
