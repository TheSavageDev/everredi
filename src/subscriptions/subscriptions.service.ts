import { Injectable, Inject } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { UsersService } from '../users/users.service';
import type { firestore } from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { FIRESTORE } from '../config/firebase.provider';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly usersService: UsersService,
    @Inject(FIRESTORE) private readonly firestore: firestore.Firestore,
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

  async handleWebhookEvent(event: any) {
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

  private async handleCheckoutCompleted(session: any) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription(userId, {
      subscriptionTier: 'premium',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: Timestamp.fromDate(
        new Date(session.subscription?.current_period_end * 1000),
      ),
    });
  }

  private async handleSubscriptionUpdated(subscription: any) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription(userId, {
      subscriptionTier: subscription.status === 'active' ? 'premium' : 'free',
      subscriptionStatus:
        subscription.status === 'active' ? 'active' : 'cancelled',
      subscriptionExpiresAt: Timestamp.fromDate(
        new Date(subscription.current_period_end * 1000),
      ),
    });
  }

  private async handleSubscriptionDeleted(subscription: any) {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await this.updateUserSubscription(userId, {
      subscriptionTier: 'free',
      subscriptionStatus: 'expired',
      subscriptionExpiresAt: undefined,
    });
  }

  private async updateUserSubscription(userId: string, updates: any) {
    await this.firestore
      .collection('users')
      .doc(userId)
      .update({
        ...updates,
        updatedAt: Timestamp.now(),
      });
  }
}
