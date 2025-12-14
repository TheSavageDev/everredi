import { Injectable, Inject } from '@nestjs/common';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  subscriptionTier: 'free' | 'premium';
  subscriptionStatus: 'active' | 'cancelled' | 'expired';
  subscriptionExpiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  isActive: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
  ) {}

  async createOrUpdateUser(
    firebaseUid: string,
    email: string,
    displayName?: string,
  ): Promise<User> {
    try {
      const userRef = this.firestore.collection('users').doc(firebaseUid);
      const userDoc = await userRef.get();

      const now = Timestamp.now();
      const userData: Partial<User> = {
        firebaseUid,
        email,
        updatedAt: now,
        lastLoginAt: now,
      };

      // Only include displayName if it's defined (not undefined)
      if (displayName !== undefined) {
        userData.displayName = displayName;
      }

      if (!userDoc.exists) {
        // Create new user
        await userRef.set({
          ...userData,
          id: firebaseUid,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          createdAt: now,
          isActive: true,
        });
      } else {
        // Update existing user - filter out undefined values
        const updateData = Object.fromEntries(
          Object.entries(userData).filter(([_, value]) => value !== undefined),
        );
        await userRef.update(updateData);
      }

      const updatedDoc = await userRef.get();
      return { id: updatedDoc.id, ...updatedDoc.data() } as User;
    } catch (error: unknown) {
      const firestoreError = error as {
        code?: number | string;
        message?: string;
      };
      if (firestoreError.code === 5 || firestoreError.code === 'NOT_FOUND') {
        throw new Error(
          'Firestore database not found. Please ensure:\n' +
            '  1. Firestore is enabled in your Firebase Console\n' +
            '  2. The database exists in your Firebase project\n' +
            '  3. Your FIREBASE_PROJECT_ID matches your Firebase project\n' +
            '  4. If using a named database, set FIREBASE_DATABASE_ID in your .env file',
        );
      }
      throw new Error(
        `Failed to create or update user: ${firestoreError.message || 'Unknown error'}`,
      );
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const userDoc = await this.firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    return { id: userDoc.id, ...userDoc.data() } as User;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const userRef = this.firestore.collection('users').doc(userId);
    // Filter out undefined values before updating
    const updateData = Object.fromEntries(
      Object.entries({
        ...updates,
        updatedAt: Timestamp.now(),
      }).filter(([_, value]) => value !== undefined),
    );
    await userRef.update(updateData);
    const updatedDoc = await userRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as User;
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      expiresAt: user.subscriptionExpiresAt?.toDate().toISOString(),
    };
  }
}
