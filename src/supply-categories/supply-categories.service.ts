import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../config/firebase.service';

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
  constructor(private readonly firebaseService: FirebaseService) {}

  async getCategories(): Promise<SupplyCategory[]> {
    return this.firebaseService.getCollection<SupplyCategory>(
      'supplyCategories',
      {
        where: [{ field: 'isActive', operator: '==', value: true }],
        orderBy: { field: 'sortOrder', direction: 'asc' },
      },
    );
  }

  async getCategory(categoryId: string): Promise<SupplyCategory | null> {
    return this.firebaseService.getDocument<SupplyCategory>(
      'supplyCategories',
      categoryId,
    );
  }
}
