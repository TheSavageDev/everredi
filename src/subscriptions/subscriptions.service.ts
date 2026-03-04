import { Injectable, Inject, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { UsersService } from '../users/users.service';
import {
  RevenueCatService,
  type RevenueCatCustomerInfo,
} from './revenuecat.service';
import { SUPABASE } from '../config/supabase.provider';

export interface SubscriptionUpdate {
  subscriptionTier: 'free' | 'premium';
  subscriptionStatus: 'active' | 'cancelled' | 'expired';
  subscriptionExpiresAt?: Date;
}

export interface RevenueCatWebhookPayload {
  event: {
    id: string;
    app_user_id: string;
    product_id: string;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    environment: string;
    entitlement_ids: string[];
    presented_offering_id?: string;
    transaction_id: string;
    original_transaction_id: string;
    is_family_share: boolean;
    store: string;
  };
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly ENTITLEMENT_ID = 'everredi_pro';

  constructor(
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
    private readonly revenueCatService: RevenueCatService,
    @Inject(SUPABASE) private readonly supabase: SupabaseClient,
  ) {}

  async createCheckoutSession(
    userId: string,
    priceId: string,
    mode: 'subscription' | 'payment' = 'subscription',
  ) {
    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        user.email,
        userId,
      );
      customerId = customer.id;
      await this.usersService.updateUser(userId, {
        stripeCustomerId: customerId,
      });
    }

    const session = await this.stripeService.createCheckoutSession(
      customerId,
      priceId,
      mode,
      userId,
    );

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  async createCustomerPortalSession(userId: string) {
    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const customerId = user.stripeCustomerId;
    if (!customerId) {
      throw new Error('Stripe customer not found for user');
    }

    const session =
      await this.stripeService.createCustomerPortalSession(customerId);

    return { url: session.url };
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription(userId, {
      subscriptionTier: 'premium',
      subscriptionStatus: 'active',
      // Expiration will be managed by subsequent subscription.updated events
      subscriptionExpiresAt: undefined,
    });
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const currentPeriodEnd = (
      subscription as Stripe.Subscription & { current_period_end?: number }
    ).current_period_end;

    await this.updateUserSubscription(userId, {
      subscriptionTier: subscription.status === 'active' ? 'premium' : 'free',
      subscriptionStatus:
        subscription.status === 'active' ? 'active' : 'cancelled',
      subscriptionExpiresAt: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : undefined,
    });
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription(userId, {
      subscriptionTier: 'free',
      subscriptionStatus: 'expired',
      subscriptionExpiresAt: undefined,
    });
  }

  private async updateUserSubscription(
    userId: string,
    updates: SubscriptionUpdate,
  ): Promise<void> {
    // Use UsersService which is already migrated to Supabase
    await this.usersService.updateUser(userId, {
      subscriptionTier: updates.subscriptionTier,
      subscriptionStatus: updates.subscriptionStatus,
      subscriptionExpiresAt: updates.subscriptionExpiresAt,
    });
  }

  /**
   * Handle RevenueCat webhook events
   * RevenueCat sends webhooks when purchases, renewals, cancellations happen
   */
  async handleRevenueCatWebhook(
    event: RevenueCatWebhookPayload,
  ): Promise<void> {
    try {
      const { app_user_id, entitlement_ids, expiration_at_ms } = event.event;

      this.logger.log(
        `[RevenueCat Webhook] Processing event for user ${app_user_id}`,
      );

      // Fetch latest customer info from RevenueCat API to get full entitlement data
      const customerInfo =
        await this.revenueCatService.getCustomerInfo(app_user_id);

      // Update revenuecat_customers table
      await this.syncRevenueCatCustomerToDatabase(app_user_id, customerInfo);

      // Sync to users table
      const entitlement =
        customerInfo.subscriber.entitlements[this.ENTITLEMENT_ID];
      const isPremium = !!entitlement;
      const expiresAt = entitlement?.expires_date
        ? new Date(entitlement.expires_date)
        : null;
      const isExpired = expiresAt && expiresAt < new Date();

      await this.usersService.updateUser(app_user_id, {
        subscriptionTier: isPremium && !isExpired ? 'premium' : 'free',
        subscriptionStatus: isPremium && !isExpired ? 'active' : 'expired',
        subscriptionExpiresAt: expiresAt || undefined,
      });

      this.logger.log(
        `[RevenueCat Webhook] Updated subscription for user ${app_user_id}: isPremium=${isPremium && !isExpired}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[RevenueCat Webhook] Error processing webhook: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Sync RevenueCat customer data to revenuecat_customers table
   * Public method so it can be called from controller for manual sync
   */
  async syncRevenueCatCustomerToDatabase(
    userId: string,
    customerInfo: RevenueCatCustomerInfo,
  ): Promise<void> {
    try {
      const entitlements = customerInfo.subscriber.entitlements || {};

      // Upsert into revenuecat_customers table
      const { error } = await this.supabase.from('revenuecat_customers').upsert(
        {
          user_id: userId,
          entitlements,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      );

      if (error) {
        this.logger.error(
          `Failed to sync RevenueCat customer to database: ${error.message}`,
        );
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error syncing RevenueCat customer: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
