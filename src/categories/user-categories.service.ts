import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';
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
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
    private readonly usersService: UsersService,
  ) {}

  async getUserCategories(userId: string): Promise<UserCategory[]> {
    const snapshot = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userCategories')
      .orderBy('order', 'asc')
      .orderBy('name', 'asc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      userId,
      ...doc.data(),
    })) as UserCategory[];
  }

  async getUserCategory(
    userId: string,
    categoryId: string,
  ): Promise<UserCategory | null> {
    const doc = await this.firestore
      .collection('users')
      .doc(userId)
      .collection('userCategories')
      .doc(categoryId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, userId, ...doc.data() } as UserCategory;
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

    const docRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userCategories')
      .doc();

    const category: Omit<UserCategory, 'id'> = {
      userId,
      ...categoryData,
      order: categoryData.order ?? maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(category);

    return { id: docRef.id, ...category };
  }

  async updateUserCategory(
    userId: string,
    categoryId: string,
    updates: Partial<Omit<UserCategory, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<UserCategory> {
    const categoryRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userCategories')
      .doc(categoryId);

    const doc = await categoryRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Category not found');
    }

    await categoryRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    });

    const updatedDoc = await categoryRef.get();
    return { id: updatedDoc.id, userId, ...updatedDoc.data() } as UserCategory;
  }

  async deleteUserCategory(userId: string, categoryId: string): Promise<void> {
    const categoryRef = this.firestore
      .collection('users')
      .doc(userId)
      .collection('userCategories')
      .doc(categoryId);

    const doc = await categoryRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Category not found');
    }

    await categoryRef.delete();
  }

  async reorderCategories(
    userId: string,
    categoryIds: string[],
  ): Promise<void> {
    const batch = this.firestore.batch();

    categoryIds.forEach((categoryId, index) => {
      const categoryRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('userCategories')
        .doc(categoryId);
      batch.update(categoryRef, { order: index, updatedAt: Timestamp.now() });
    });

    await batch.commit();
  }
}


