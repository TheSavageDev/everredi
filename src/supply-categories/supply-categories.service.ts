import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { FIRESTORE } from '../config/firebase.provider';

export interface SupplyCategory {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  parentCategoryPath?: string;
  iconName?: string;
  sortOrder: number;
  createdAt: any;
  updatedAt: any;
}

@Injectable()
export class SupplyCategoriesService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async getCategories(): Promise<SupplyCategory[]> {
    const snapshot = await this.firestore
      .collection('supplyCategories')
      .where('isActive', '==', true)
      .orderBy('sortOrder')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SupplyCategory[];
  }

  async getCategory(categoryId: string): Promise<SupplyCategory | null> {
    const doc = await this.firestore
      .collection('supplyCategories')
      .doc(categoryId)
      .get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as SupplyCategory;
  }
}
