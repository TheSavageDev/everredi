import { Injectable } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../config/firebase.service';
import { UsersService } from '../users/users.service';

export interface UserCategory {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Injectable()
export class UserCategoriesService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  async getUserCategories(userId: string): Promise<UserCategory[]> {
    const categories =
      await this.firebaseService.getSubcollection<UserCategory>(
        'users',
        userId,
        'userCategories',
        {
          orderBy: { field: 'order', direction: 'asc' },
        },
      );
    // Secondary sort by name (Firestore only supports one orderBy, so we do it in memory)
    return categories.sort((a, b) => {
      if ((a.order || 0) !== (b.order || 0))
        return (a.order || 0) - (b.order || 0);
      return a.name.localeCompare(b.name);
    });
  }

  async getUserCategory(
    userId: string,
    categoryId: string,
  ): Promise<UserCategory | null> {
    return this.firebaseService.getSubcollectionDocument<UserCategory>(
      'users',
      userId,
      'userCategories',
      categoryId,
    );
  }

  async createUserCategory(
    userId: string,
    categoryData: Omit<
      UserCategory,
      'id' | 'userId' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<UserCategory> {
    const now = Timestamp.now();

    // Get current max order
    const existingCategories = await this.getUserCategories(userId);
    const maxOrder = existingCategories.reduce(
      (max, cat) => Math.max(max, cat.order || 0),
      0,
    );

    return this.firebaseService.addSubcollectionDocument<UserCategory>(
      'users',
      userId,
      'userCategories',
      {
        userId,
        ...categoryData,
        order: categoryData.order ?? maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      },
    );
  }

  async updateUserCategory(
    userId: string,
    categoryId: string,
    updates: Partial<Omit<UserCategory, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<UserCategory> {
    return this.firebaseService.updateSubcollectionDocument<UserCategory>(
      'users',
      userId,
      'userCategories',
      categoryId,
      {
        ...updates,
        updatedAt: Timestamp.now(),
      },
    );
  }

  async deleteUserCategory(userId: string, categoryId: string): Promise<void> {
    await this.firebaseService.deleteSubcollectionDocument(
      'users',
      userId,
      'userCategories',
      categoryId,
    );
  }

  async reorderCategories(
    userId: string,
    categoryIds: string[],
  ): Promise<void> {
    const batch = this.firebaseService.createBatch();

    categoryIds.forEach((categoryId, index) => {
      const ref = this.firebaseService.getSubcollectionDocumentRef(
        'users',
        userId,
        'userCategories',
        categoryId,
      );
      batch.update(ref, { order: index, updatedAt: Timestamp.now() });
    });

    await batch.commit();
  }
}
