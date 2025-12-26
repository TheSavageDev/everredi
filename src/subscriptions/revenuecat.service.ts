import { Injectable, Logger } from '@nestjs/common';

export interface RevenueCatCustomerInfo {
  request_date: string;
  request_date_ms: number;
  subscriber: {
    entitlements: {
      [key: string]: {
        expires_date: string | null;
        product_identifier: string;
        purchase_date: string;
      };
    };
    first_seen: string;
    last_seen: string;
    management_url: string | null;
    non_subscriptions: {
      [key: string]: Array<{
        id: string;
        is_sandbox: boolean;
        purchase_date: string;
        store: string;
      }>;
    };
    original_app_user_id: string;
    other_purchases: {
      [key: string]: Array<{
        id: string;
        is_sandbox: boolean;
        purchase_date: string;
        store: string;
      }>;
    };
    subscriptions: {
      [key: string]: {
        billing_issues_detected_at: string | null;
        expires_date: string | null;
        grace_period_expires_date: string | null;
        is_sandbox: boolean;
        original_purchase_date: string;
        period_type: string;
        purchase_date: string;
        store: string;
        unsubscribe_detected_at: string | null;
        will_renew: boolean;
      };
    };
  };
}

export interface RevenueCatCancelResponse {
  request_date: string;
  request_date_ms: number;
  subscriber: RevenueCatCustomerInfo['subscriber'];
}

@Injectable()
export class RevenueCatService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.revenuecat.com/v1';
  private readonly logger = new Logger(RevenueCatService.name);

  constructor() {
    this.apiKey = process.env.REVENUECAT_SECRET_API_KEY || '';
    if (!this.apiKey) {
      this.logger.warn('[RevenueCat] REVENUECAT_SECRET_API_KEY is not set');
    }
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `RevenueCat API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async getCustomerInfo(appUserId: string): Promise<RevenueCatCustomerInfo> {
    return this.makeRequest<RevenueCatCustomerInfo>(
      'GET',
      `/subscribers/${appUserId}`,
    );
  }

  async cancelSubscription(
    appUserId: string,
    productId: string,
  ): Promise<RevenueCatCancelResponse> {
    // For web billing subscriptions, RevenueCat uses a different approach
    // We need to update the subscription to set will_renew to false
    // First get customer info to verify the subscription exists
    const customerInfo = await this.getCustomerInfo(appUserId);
    const subscription = customerInfo.subscriber.subscriptions[productId];

    if (!subscription) {
      throw new Error(`No active subscription found for product ${productId}`);
    }

    if (subscription.unsubscribe_detected_at) {
      throw new Error('Subscription is already cancelled');
    }

    // For web billing, we cancel by updating the subscription
    // RevenueCat REST API endpoint for canceling web billing subscriptions
    // This sets the subscription to not renew at the end of the period
    return this.makeRequest<RevenueCatCancelResponse>(
      'POST',
      `/subscribers/${appUserId}/subscriptions/${productId}/cancel`,
      {},
    );
  }

  async updateSubscription(
    appUserId: string,
    productId: string,
    updates: {
      expiresDate?: string;
      gracePeriodExpiresDate?: string;
    },
  ): Promise<RevenueCatCustomerInfo> {
    return this.makeRequest<RevenueCatCustomerInfo>(
      'POST',
      `/subscribers/${appUserId}/subscriptions/${productId}`,
      updates,
    );
  }
}
