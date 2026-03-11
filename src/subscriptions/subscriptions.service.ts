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
  /** Top-level (RevenueCat actual format); event is optional legacy nesting */
  type?: string;
  id?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  event?: {
    type?: string;
    id?: string;
    app_user_id?: string;
    product_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number | null;
    environment?: string;
    entitlement_ids?: string[] | null;
    transaction_id?: string;
    original_transaction_id?: string;
    is_family_share?: boolean;
    store?: string;
  };
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  /** Must match the entitlement identifier in RevenueCat dashboard (e.g. everredi-pro). */
  private readonly ENTITLEMENT_ID = 'everredi-pro';

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
    this.logger.log(
      `[Stripe Webhook] handleWebhookEvent type=${event.type} id=${event.id}`,
    );
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
      default:
        this.logger.debug(
          `[Stripe Webhook] Unhandled event type=${event.type}`,
        );
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    let userId = session.metadata?.userId as string | undefined;
    this.logger.log(
      `[Stripe Webhook] checkout.session.completed sessionId=${session.id} metadata.userId=${userId ?? '(missing)'} customer=${session.customer ?? '(none)'}`,
    );

    if (!userId && session.customer) {
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer as { id?: string })?.id;
      if (customerId) {
        const user = await this.usersService.getUserByStripeCustomerId(
          customerId,
        );
        if (user) {
          userId = user.id;
          this.logger.log(
            `[Stripe Webhook] Resolved user by stripe_customer_id: ${userId}`,
          );
        } else {
          this.logger.warn(
            `[Stripe Webhook] No user found for stripe customer ${customerId}; Supabase user will not be updated. Session was likely created outside this app (e.g. RevenueCat). Rely on RevenueCat webhook to update user.`,
          );
        }
      }
    }

    if (!userId) {
      this.logger.warn(
        '[Stripe Webhook] checkout.session.completed: no userId in metadata and could not resolve by customer; skipping user update',
      );
      return;
    }

    await this.updateUserSubscription(userId, {
      subscriptionTier: 'premium',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: undefined,
    });
    this.logger.log(
      `[Stripe Webhook] Updated user ${userId} to premium (checkout.session.completed)`,
    );
  }

  private async resolveUserIdFromSubscription(
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    let userId = subscription.metadata?.userId as string | undefined;
    if (userId) return userId;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer as { id?: string })?.id;
    if (!customerId) return null;
    const user = await this.usersService.getUserByStripeCustomerId(customerId);
    return user?.id ?? null;
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const userId = await this.resolveUserIdFromSubscription(subscription);
    this.logger.log(
      `[Stripe Webhook] customer.subscription.updated subId=${subscription.id} status=${subscription.status} userId=${userId ?? '(none)'}`,
    );
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
    const userId = await this.resolveUserIdFromSubscription(subscription);
    this.logger.log(
      `[Stripe Webhook] customer.subscription.deleted subId=${subscription.id} userId=${userId ?? '(none)'}`,
    );
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
   * RevenueCat sends webhooks when purchases, renewals, cancellations happen.
   * Payload has top-level type, app_user_id, entitlement_ids, etc. (see RevenueCat docs).
   */
  async handleRevenueCatWebhook(
    payload: RevenueCatWebhookPayload,
  ): Promise<void> {
    const eventType = payload.type ?? payload.event?.type ?? 'unknown';
    const appUserId =
      payload.app_user_id ??
      payload.event?.app_user_id ??
      payload.original_app_user_id;
    const entitlementIds =
      payload.entitlement_ids ?? payload.event?.entitlement_ids ?? null;

    this.logger.log(
      `[RevenueCat Webhook] Received type=${eventType} app_user_id=${appUserId ?? '(none)'} store=${payload.store ?? payload.event?.store ?? '?'} entitlement_ids=${JSON.stringify(entitlementIds)}`,
    );

    if (!appUserId) {
      this.logger.warn(
        '[RevenueCat Webhook] No app_user_id in payload; TRANSFER events use transferred_to. Skipping.',
      );
      return;
    }

    if (
      entitlementIds == null ||
      (Array.isArray(entitlementIds) && entitlementIds.length === 0)
    ) {
      this.logger.warn(
        `[RevenueCat Webhook] entitlement_ids is null or empty for product_id=${payload.product_id ?? payload.event?.product_id ?? '?'}. ` +
          'In RevenueCat dashboard, ensure the product is attached to the everredi-pro entitlement.',
      );
    }

    try {
      // Fetch latest customer info from RevenueCat API to get full entitlement data
      const customerInfo =
        await this.revenueCatService.getCustomerInfo(appUserId);

      // Update revenuecat_customers table
      await this.syncRevenueCatCustomerToDatabase(appUserId, customerInfo);

      // Resolve Pro entitlement (dashboard may use everredi-pro or everredi_pro)
      const entitlements = customerInfo.subscriber.entitlements || {};
      const entitlement =
        entitlements[this.ENTITLEMENT_ID] ??
        entitlements['everredi_pro'];

      const isPremium = !!entitlement;
      const expiresAt = entitlement?.expires_date
        ? new Date(entitlement.expires_date)
        : null;
      const isExpired = expiresAt && expiresAt < new Date();

      await this.usersService.updateUser(appUserId, {
        subscriptionTier: isPremium && !isExpired ? 'premium' : 'free',
        subscriptionStatus: isPremium && !isExpired ? 'active' : 'expired',
        subscriptionExpiresAt: expiresAt ?? undefined,
      });

      this.logger.log(
        `[RevenueCat Webhook] Updated user ${appUserId} isPremium=${isPremium && !isExpired} (entitlement=${!!entitlement} expired=${isExpired})`,
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
