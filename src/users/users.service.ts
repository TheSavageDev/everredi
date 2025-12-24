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
  stripeCustomerId?: string;
  subscriptionTier: 'free' | 'premium';
  subscriptionStatus: 'active' | 'cancelled' | 'expired';
  subscriptionExpiresAt?: Timestamp;
  referralCode?: string; // Unique code for this user
  referredBy?: string; // userId of referrer
  referralRewards?: {
    freeMonthsEarned: number;
    lastRewardDate?: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  isActive: boolean;
  isAdmin?: boolean; // Admin access flag
  onboardingCompleted?: boolean; // Track if user completed onboarding
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
        // Generate unique referral code
        const referralCode = this.generateReferralCode(firebaseUid);

        // Create new user
        await userRef.set({
          ...userData,
          id: firebaseUid,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          referralCode,
          onboardingCompleted: false,
          createdAt: now,
          isActive: true,
        });

        // Create default location for new users
        try {
          const locationsRef = this.firestore
            .collection('users')
            .doc(firebaseUid)
            .collection('locations');

          // Check if user already has locations (shouldn't happen for new user, but safety check)
          const existingLocations = await locationsRef.get();
          if (existingLocations.empty) {
            await locationsRef.add({
              userId: firebaseUid,
              name: 'Home',
              locationType: 'home',
              isPrimary: true,
              createdAt: now,
              updatedAt: now,
            });
          }
        } catch (locationError) {
          // Log but don't fail user creation if location creation fails
          console.warn(
            `Failed to create default location for user ${firebaseUid}:`,
            locationError,
          );
        }
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
    const isPremium =
      user.subscriptionTier === 'premium' &&
      user.subscriptionStatus === 'active';

    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      expiresAt: user.subscriptionExpiresAt?.toDate().toISOString(),
      isPremium,
    };
  }

  async isPremiumUser(userId: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userId);
    return status.isPremium;
  }

  async isAdminUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user?.isAdmin === true;
  }

  private generateReferralCode(userId: string): string {
    // Generate a short, unique code based on user ID
    const hash = userId.substring(0, 8).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${hash}${random}`;
  }

  /**
   * Applies a referral code to a user account.
   *
   * When a user applies a referral code:
   * - Both the referrer and the new user receive 1 free month of premium
   * - The new user's `referredBy` field is set to the referrer's user ID
   * - Both users' `referralRewards` are updated with the free months earned
   *
   * @param userId - The ID of the user applying the referral code
   * @param referralCode - The referral code to apply (case-insensitive)
   * @returns Promise resolving to success status and message
   * @throws Error if user not found, code invalid, or user already has a referrer
   *
   * @example
   * ```typescript
   * const result = await usersService.applyReferralCode('user123', 'REFCODE123');
   * if (result.success) {
   *   console.log('Referral code applied! Both users received rewards.');
   * }
   * ```
   */
  async applyReferralCode(
    userId: string,
    referralCode: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Check if user already has a referrer
    if (user.referredBy) {
      return {
        success: false,
        message: 'You have already used a referral code',
      };
    }

    // Find user with this referral code
    const referrerSnapshot = await this.firestore
      .collection('users')
      .where('referralCode', '==', referralCode.toUpperCase())
      .limit(1)
      .get();

    if (referrerSnapshot.empty) {
      return { success: false, message: 'Invalid referral code' };
    }

    const referrer = referrerSnapshot.docs[0];
    const referrerId = referrer.id;

    // Can't refer yourself
    if (referrerId === userId) {
      return {
        success: false,
        message: 'You cannot use your own referral code',
      };
    }

    const now = Timestamp.now();

    // Update referee (this user)
    await this.firestore.collection('users').doc(userId).update({
      referredBy: referrerId,
      updatedAt: now,
    });

    // Award rewards to both parties
    const freeMonths = 1; // 1 month free premium for both

    // Award to referrer
    const referrerData = referrer.data() as User;
    const referrerRewards = referrerData.referralRewards || {
      freeMonthsEarned: 0,
    };
    await this.firestore
      .collection('users')
      .doc(referrerId)
      .update({
        referralRewards: {
          freeMonthsEarned: referrerRewards.freeMonthsEarned + freeMonths,
          lastRewardDate: now,
        },
        updatedAt: now,
      });

    // Award to referee (this user)
    await this.firestore
      .collection('users')
      .doc(userId)
      .update({
        referralRewards: {
          freeMonthsEarned: freeMonths,
          lastRewardDate: now,
        },
        updatedAt: now,
      });

    // Apply free months to premium subscription if applicable
    // This would typically extend subscriptionExpiresAt
    // For now, we just track the reward

    return { success: true, message: 'Referral code applied successfully' };
  }

  /**
   * Gets referral statistics for a user.
   *
   * Returns:
   * - The user's referral code (if they have one)
   * - The user ID of who referred them (if applicable)
   * - Their referral rewards (free months earned)
   * - Count of users they have referred
   *
   * @param userId - The ID of the user to get stats for
   * @returns Promise resolving to referral statistics object
   * @throws Error if user not found
   *
   * @example
   * ```typescript
   * const stats = await usersService.getReferralStats('user123');
   * console.log(`You've referred ${stats.referralsCount} users`);
   * console.log(`Your code: ${stats.referralCode}`);
   * ```
   */
  async getReferralStats(userId: string): Promise<{
    referralCode: string | undefined;
    referredBy: string | undefined;
    rewards:
      | { freeMonthsEarned: number; lastRewardDate?: Timestamp }
      | undefined;
    referralsCount: number;
  }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Count how many users this user has referred
    const referralsSnapshot = await this.firestore
      .collection('users')
      .where('referredBy', '==', userId)
      .get();

    return {
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      rewards: user.referralRewards,
      referralsCount: referralsSnapshot.size,
    };
  }
}
