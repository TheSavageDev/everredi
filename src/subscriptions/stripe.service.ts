import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-11-17.clover',
    });
  }

  async createCheckoutSession(
    customerId: string | undefined,
    priceId: string,
    mode: 'subscription' | 'payment' = 'subscription',
    userId?: string,
  ): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      customer: customerId,
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: userId ? { userId } : undefined,
      subscription_data:
        mode === 'subscription' && userId
          ? {
              metadata: { userId },
            }
          : undefined,
    });
  }

  async createCustomer(
    email: string,
    userId: string,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    });
  }

  async createCustomerPortalSession(
    customerId: string,
  ): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings/subscription`,
    });
  }

  async handleWebhook(payload: string, signature: string) {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || '',
    );
  }
}
