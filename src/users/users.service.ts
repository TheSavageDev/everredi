import {
  Injectable,
  Inject,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase.provider';
import { RevenueCatService } from '../subscriptions/revenuecat.service';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  stripeCustomerId?: string;
  subscriptionTier: 'free' | 'premium';
  subscriptionStatus: 'active' | 'cancelled' | 'expired';
  subscriptionExpiresAt?: Date;
  referralCode?: string; // Unique code for this user
  referredBy?: string; // userId of referrer
  referralRewards?: {
    freeMonthsEarned: number;
    lastRewardDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  isAdmin?: boolean; // Admin access flag
  onboardingCompleted?: boolean; // Track if user completed onboarding
}

// Helper function to convert PostgreSQL row to User interface
function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionTier: row.subscription_tier,
    subscriptionStatus: row.subscription_status,
    subscriptionExpiresAt: row.subscription_expires_at
      ? new Date(row.subscription_expires_at)
      : undefined,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    referralRewards: row.referral_rewards
      ? {
          freeMonthsEarned: row.referral_rewards.freeMonthsEarned || 0,
          lastRewardDate: row.referral_rewards.lastRewardDate
            ? new Date(row.referral_rewards.lastRewardDate)
            : undefined,
        }
      : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    isActive: row.is_active,
    isAdmin: row.is_admin,
    onboardingCompleted: row.onboarding_completed,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly ENTITLEMENT_ID = 'everredi_pro';

  constructor(
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
    @Optional()
    @Inject(forwardRef(() => RevenueCatService))
    private readonly revenueCatService?: RevenueCatService,
  ) {}

  async createOrUpdateUser(
    userId: string,
    email: string,
    displayName?: string,
  ): Promise<User> {
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const now = new Date();
      const userData: any = {
        email,
        updated_at: now.toISOString(),
        last_login_at: now.toISOString(),
      };

      // Only include displayName if it's defined (not undefined)
      if (displayName !== undefined) {
        userData.display_name = displayName;
      }

      if (!existingUser || fetchError) {
        // Generate unique referral code
        const referralCode = this.generateReferralCode(userId);

        // Create new user
        const { data: newUser, error: insertError } = await this.supabase
          .from('users')
          .insert({
            id: userId,
            ...userData,
            subscription_tier: 'free',
            subscription_status: 'active',
            referral_code: referralCode,
            onboarding_completed: false,
            created_at: now.toISOString(),
            is_active: true,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(
            `Failed to create user: ${insertError.message || 'Unknown error'}`,
          );
        }

        // Create default location for new users
        try {
          const { data: existingLocations } = await this.supabase
            .from('locations')
            .select('id')
            .eq('user_id', userId);

          if (!existingLocations || existingLocations.length === 0) {
            await this.supabase.from('locations').insert({
              user_id: userId,
              name: 'Home',
              location_type: 'home',
              is_primary: true,
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            });
          }
        } catch (locationError: unknown) {
          // Log but don't fail user creation if location creation fails
          const errorMessage =
            locationError instanceof Error
              ? locationError.message
              : String(locationError);
          this.logger.warn(
            `Failed to create default location for user ${userId}: ${errorMessage}`,
          );
        }

        return rowToUser(newUser);
      } else {
        // Update existing user - filter out undefined values
        const updateData = Object.fromEntries(
          Object.entries(userData).filter(([, value]) => value !== undefined),
        );

        const { data: updatedUser, error: updateError } = await this.supabase
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single();

        if (updateError) {
          throw new Error(
            `Failed to update user: ${updateError.message || 'Unknown error'}`,
          );
        }

        return rowToUser(updatedUser);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create or update user: ${errorMessage}`);
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      this.logger.error(`Error fetching user ${userId}: ${error?.message}`);
      return null;
    }

    return rowToUser(data);
  }

  /**
   * Get user by Stripe customer ID (for webhook fallback when session metadata has no userId).
   */
  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    if (!stripeCustomerId) return null;
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') return null;
      this.logger.error(
        `Error fetching user by stripe_customer_id: ${error?.message}`,
      );
      return null;
    }
    return rowToUser(data);
  }

  /**
   * List users for admin (paginated, optional email search).
   */
  async listUsers(filters?: {
    limit?: number;
    offset?: number;
    emailSearch?: string;
  }): Promise<User[]> {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);

    let query = this.supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.emailSearch?.trim()) {
      query = query.ilike('email', `%${filters.emailSearch.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error listing users: ${error.message}`);
      return [];
    }

    return (data || []).map(rowToUser);
  }

  async searchUserByEmail(
    email: string,
  ): Promise<{ uid: string; email: string; displayName?: string } | null> {
    try {
      // Search in Supabase users table by email
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email, display_name')
        .eq('email', email)
        .single();

      if (error || !user) {
        return null;
      }

      return {
        uid: user.id,
        email: user.email,
        displayName: user.display_name || undefined,
      };
    } catch (error: unknown) {
      // If user not found, return null
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    // Convert User interface fields to database column names
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.displayName !== undefined) {
      updateData.display_name = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      updateData.avatar_url = updates.avatarUrl;
    }
    if (updates.stripeCustomerId !== undefined) {
      updateData.stripe_customer_id = updates.stripeCustomerId;
    }
    if (updates.subscriptionTier !== undefined) {
      updateData.subscription_tier = updates.subscriptionTier;
    }
    if (updates.subscriptionStatus !== undefined) {
      updateData.subscription_status = updates.subscriptionStatus;
    }
    if (updates.subscriptionExpiresAt !== undefined) {
      updateData.subscription_expires_at = updates.subscriptionExpiresAt
        ? updates.subscriptionExpiresAt.toISOString()
        : null;
    }
    if (updates.referralCode !== undefined) {
      updateData.referral_code = updates.referralCode;
    }
    if (updates.referredBy !== undefined) {
      updateData.referred_by = updates.referredBy;
    }
    if (updates.referralRewards !== undefined) {
      updateData.referral_rewards = updates.referralRewards
        ? {
            freeMonthsEarned: updates.referralRewards.freeMonthsEarned,
            lastRewardDate: updates.referralRewards.lastRewardDate
              ? updates.referralRewards.lastRewardDate.toISOString()
              : undefined,
          }
        : null;
    }
    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
    }
    if (updates.isAdmin !== undefined) {
      updateData.is_admin = updates.isAdmin;
    }
    if (updates.onboardingCompleted !== undefined) {
      updateData.onboarding_completed = updates.onboardingCompleted;
    }
    if (updates.lastLoginAt !== undefined) {
      updateData.last_login_at = updates.lastLoginAt
        ? updates.lastLoginAt.toISOString()
        : null;
    }

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined),
    );

    const { data, error } = await this.supabase
      .from('users')
      .update(filteredData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return rowToUser(data);
  }

  /**
   * Get subscription status from RevenueCat table
   * Falls back to user document if RevenueCat data not available
   */
  private async getRevenueCatSubscriptionFromSupabase(userId: string): Promise<{
    isPremium: boolean;
    expiresAt?: Date;
  } | null> {
    try {
      const { data: rcData, error } = await this.supabase
        .from('revenuecat_customers')
        .select('entitlements')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        // Only log as error if it's not a "no rows" error
        if (error.code !== 'PGRST116') {
          this.logger.error(
            `[getRevenueCatSubscriptionFromSupabase] Error querying revenuecat_customers for ${userId}: ${error.message}`,
          );
        }
        return null;
      }

      if (!rcData) {
        // No RevenueCat data is expected for many users, so don't log as warning
        return null;
      }

      // Check for active entitlement
      const entitlements = rcData.entitlements || {};
      const entitlement = entitlements[this.ENTITLEMENT_ID];

      if (!entitlement) {
        this.logger.warn(
          `[getRevenueCatSubscriptionFromSupabase] No entitlement '${this.ENTITLEMENT_ID}' found for user ${userId}`,
        );
        return { isPremium: false };
      }

      // Check if entitlement is active (not expired)
      const expiresDate = entitlement.expires_date
        ? new Date(entitlement.expires_date)
        : null;
      const isExpired = expiresDate && expiresDate < new Date();
      const isPremium = !isExpired;

      return {
        isPremium,
        expiresAt: expiresDate || undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to read RevenueCat data from Supabase for user ${userId}: ${errorMessage}`,
      );
      return null;
    }
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // First, try to get subscription status from RevenueCat table
    const rcStatus = await this.getRevenueCatSubscriptionFromSupabase(userId);

    if (rcStatus) {
      // Sync RevenueCat status to user document for backward compatibility
      const shouldUpdate =
        user.subscriptionTier !== (rcStatus.isPremium ? 'premium' : 'free') ||
        (rcStatus.isPremium && user.subscriptionStatus !== 'active');

      if (shouldUpdate) {
        await this.updateUser(userId, {
          subscriptionTier: rcStatus.isPremium ? 'premium' : 'free',
          subscriptionStatus: rcStatus.isPremium ? 'active' : 'expired',
          subscriptionExpiresAt: rcStatus.expiresAt,
        });
      }

      const result = {
        tier: rcStatus.isPremium ? 'premium' : 'free',
        status: rcStatus.isPremium ? 'active' : 'expired',
        expiresAt: rcStatus.expiresAt?.toISOString(),
        isPremium: rcStatus.isPremium,
      };
      return result;
    }

    // Fallback: Check user document (for Stripe subscriptions or if RevenueCat not set up)
    let isPremium =
      user.subscriptionTier === 'premium' &&
      user.subscriptionStatus === 'active';

    // If database shows free and RevenueCat not available, check RevenueCat API as fallback
    if (!isPremium && this.revenueCatService) {
      try {
        // RevenueCat uses Supabase UUID (which is the user ID)
        const rcInfo = await this.revenueCatService.getCustomerInfo(userId);
        const rcIsPremium =
          !!rcInfo.subscriber.entitlements[this.ENTITLEMENT_ID];

        if (rcIsPremium) {
          // Sync RevenueCat status to database
          const entitlement =
            rcInfo.subscriber.entitlements[this.ENTITLEMENT_ID];
          const expiresDate = entitlement.expires_date
            ? new Date(entitlement.expires_date)
            : null;

          await this.updateUser(userId, {
            subscriptionTier: 'premium',
            subscriptionStatus: 'active',
            subscriptionExpiresAt: expiresDate || undefined,
          });

          isPremium = true;
          this.logger.log(
            `Synced RevenueCat premium status via API to database for user ${userId}`,
          );
        }
      } catch (error: unknown) {
        // Log but don't fail if RevenueCat check fails
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to check RevenueCat status for user ${userId}: ${errorMessage}`,
        );
      }
    }

    // Re-fetch user to get updated subscription status if it was synced
    const updatedUser = isPremium ? await this.getUserById(userId) : user;

    const result = {
      tier: updatedUser?.subscriptionTier || user.subscriptionTier,
      status: updatedUser?.subscriptionStatus || user.subscriptionStatus,
      expiresAt:
        updatedUser?.subscriptionExpiresAt?.toISOString() ||
        user.subscriptionExpiresAt?.toISOString(),
      isPremium,
    };
    return result;
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
    const { data: referrers, error: referrerError } = await this.supabase
      .from('users')
      .select('id, referral_rewards')
      .eq('referral_code', referralCode.toUpperCase())
      .limit(1);

    if (referrerError || !referrers || referrers.length === 0) {
      return { success: false, message: 'Invalid referral code' };
    }

    const referrer = referrers[0];
    const referrerId = referrer.id;

    // Can't refer yourself
    if (referrerId === userId) {
      return {
        success: false,
        message: 'You cannot use your own referral code',
      };
    }

    const now = new Date();

    // Award rewards to both parties
    const freeMonths = 1; // 1 month free premium for both

    // Get referrer's current rewards
    const referrerRewards = referrer.referral_rewards || {
      freeMonthsEarned: 0,
    };

    // Update referee (this user)
    await this.supabase
      .from('users')
      .update({
        referred_by: referrerId,
        updated_at: now.toISOString(),
      })
      .eq('id', userId);

    // Award to referrer
    await this.supabase
      .from('users')
      .update({
        referral_rewards: {
          freeMonthsEarned: referrerRewards.freeMonthsEarned + freeMonths,
          lastRewardDate: now.toISOString(),
        },
        updated_at: now.toISOString(),
      })
      .eq('id', referrerId);

    // Award to referee (this user)
    await this.supabase
      .from('users')
      .update({
        referral_rewards: {
          freeMonthsEarned: freeMonths,
          lastRewardDate: now.toISOString(),
        },
        updated_at: now.toISOString(),
      })
      .eq('id', userId);

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
   * ```
   */
  async getReferralStats(userId: string): Promise<{
    referralCode?: string;
    referredBy?: string;
    rewards?: { freeMonthsEarned: number; lastRewardDate?: Date };
    referralsCount: number;
  }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Count how many users this user has referred
    const { count, error } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', userId);

    if (error) {
      this.logger.error(
        `Error counting referrals for user ${userId}: ${error.message}`,
      );
    }

    return {
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      rewards: user.referralRewards,
      referralsCount: count || 0,
    };
  }
}
