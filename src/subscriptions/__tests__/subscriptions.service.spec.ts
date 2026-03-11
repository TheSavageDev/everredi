import { SubscriptionsService } from '../subscriptions.service';
import { StripeService } from '../stripe.service';
import { UsersService } from '../users/users.service';
import { RevenueCatService } from '../revenuecat.service';
import { createSupabaseClientMock } from '../../../test/utils/supabase-client.mock';
import { SUPABASE } from '../../config/supabase.provider';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let stripeService: jest.Mocked<Partial<StripeService>>;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let revenueCatService: jest.Mocked<Partial<RevenueCatService>>;
  const supabaseMock = createSupabaseClientMock();

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseMock._clearAll as jest.Mock)();

    stripeService = {
      createCustomer: jest.fn().mockResolvedValue({ id: 'cus_123' }),
      createCheckoutSession: jest.fn().mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.example.com',
      }),
      createCustomerPortalSession: jest.fn().mockResolvedValue({
        id: 'ps_test_123',
        url: 'https://portal.example.com',
      }),
    };

    usersService = {
      getUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        stripeCustomerId: null,
      }),
      updateUser: jest.fn().mockResolvedValue(undefined),
    };

    revenueCatService = {
      getCustomerInfo: jest.fn().mockResolvedValue({
        subscriber: {
          entitlements: {
            'everredi-pro': {
              expires_date: new Date(Date.now() + 86400000).toISOString(),
              product_identifier: 'pro',
              purchase_date: new Date().toISOString(),
            },
          },
        },
      }),
    };

    service = new SubscriptionsService(
      stripeService as StripeService,
      usersService as UsersService,
      revenueCatService as RevenueCatService,
      supabaseMock as any,
    );
  });

  describe('createCheckoutSession', () => {
    it('throws when user not found', async () => {
      (usersService.getUserById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('user-1', 'price_123', 'subscription'),
      ).rejects.toThrow('User not found');
    });

    it('creates Stripe customer and checkout session when user has no customerId', async () => {
      const result = await service.createCheckoutSession(
        'user-1',
        'price_123',
        'subscription',
      );

      expect(stripeService.createCustomer).toHaveBeenCalledWith(
        'test@example.com',
        'user-1',
      );
      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_123',
      });
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_123',
        'price_123',
        'subscription',
        'user-1',
      );
      expect(result).toEqual({
        url: 'https://checkout.example.com',
        sessionId: 'cs_test_123',
      });
    });

    it('uses existing customerId when user has stripeCustomerId', async () => {
      (usersService.getUserById as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        stripeCustomerId: 'cus_existing',
      });

      const result = await service.createCheckoutSession(
        'user-1',
        'price_123',
        'subscription',
      );

      expect(stripeService.createCustomer).not.toHaveBeenCalled();
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_existing',
        'price_123',
        'subscription',
        'user-1',
      );
      expect(result.sessionId).toBe('cs_test_123');
    });
  });

  describe('createCustomerPortalSession', () => {
    it('throws when user not found', async () => {
      (usersService.getUserById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createCustomerPortalSession('user-1'),
      ).rejects.toThrow('User not found');
    });

    it('throws when user has no stripeCustomerId', async () => {
      (usersService.getUserById as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        stripeCustomerId: null,
      });

      await expect(
        service.createCustomerPortalSession('user-1'),
      ).rejects.toThrow('Stripe customer not found for user');
    });

    it('returns portal url when user has customerId', async () => {
      (usersService.getUserById as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        stripeCustomerId: 'cus_123',
      });

      const result = await service.createCustomerPortalSession('user-1');

      expect(stripeService.createCustomerPortalSession).toHaveBeenCalledWith(
        'cus_123',
      );
      expect(result).toEqual({ url: 'https://portal.example.com' });
    });
  });

  describe('handleWebhookEvent', () => {
    it('calls handleCheckoutCompleted for checkout.session.completed', async () => {
      await service.handleWebhookEvent({
        type: 'checkout.session.completed',
        data: { object: { metadata: { userId: 'user-1' } } },
      } as any);

      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', {
        subscriptionTier: 'premium',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: undefined,
      });
    });

    it('does nothing when session has no userId', async () => {
      await service.handleWebhookEvent({
        type: 'checkout.session.completed',
        data: { object: { metadata: {} } },
      } as any);

      expect(usersService.updateUser).not.toHaveBeenCalled();
    });

    it('calls handleSubscriptionUpdated for customer.subscription.updated', async () => {
      await service.handleWebhookEvent({
        type: 'customer.subscription.updated',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            status: 'active',
            current_period_end: 2000000000,
          },
        },
      } as any);

      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', {
        subscriptionTier: 'premium',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expect.any(Date),
      });
    });

    it('calls handleSubscriptionDeleted for customer.subscription.deleted', async () => {
      await service.handleWebhookEvent({
        type: 'customer.subscription.deleted',
        data: { object: { metadata: { userId: 'user-1' } } },
      } as any);

      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', {
        subscriptionTier: 'free',
        subscriptionStatus: 'expired',
        subscriptionExpiresAt: undefined,
      });
    });
  });

  describe('handleRevenueCatWebhook', () => {
    it('updates user subscription from entitlement', async () => {
      await service.handleRevenueCatWebhook({
        event: {
          app_user_id: 'user-1',
          entitlement_ids: ['everredi-pro'],
          expiration_at_ms: Date.now() + 86400000,
          product_id: 'pro',
          period_type: 'normal',
          purchased_at_ms: Date.now(),
          environment: 'production',
          transaction_id: 'tx_1',
          original_transaction_id: 'tx_1',
          is_family_share: false,
          store: 'app_store',
        },
      } as any);

      expect(revenueCatService.getCustomerInfo).toHaveBeenCalledWith('user-1');
      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', {
        subscriptionTier: 'premium',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expect.any(Date),
      });
    });

    it('sets free when entitlement expired', async () => {
      (revenueCatService.getCustomerInfo as jest.Mock).mockResolvedValue({
        subscriber: {
          entitlements: {
            'everredi-pro': {
              expires_date: new Date(Date.now() - 1000).toISOString(),
              product_identifier: 'pro',
              purchase_date: new Date().toISOString(),
            },
          },
        },
      });

      await service.handleRevenueCatWebhook({
        event: {
          app_user_id: 'user-1',
          entitlement_ids: [],
          expiration_at_ms: null,
          product_id: 'pro',
          period_type: 'normal',
          purchased_at_ms: Date.now(),
          environment: 'production',
          transaction_id: 'tx_1',
          original_transaction_id: 'tx_1',
          is_family_share: false,
          store: 'app_store',
        },
      } as any);

      expect(usersService.updateUser).toHaveBeenCalledWith('user-1', {
        subscriptionTier: 'free',
        subscriptionStatus: 'expired',
        subscriptionExpiresAt: expect.any(Date),
      });
    });
  });

  describe('syncRevenueCatCustomerToDatabase', () => {
    it('upserts revenuecat_customers row', async () => {
      const customerInfo = {
        request_date: '',
        request_date_ms: 0,
        subscriber: {
          entitlements: { 'everredi-pro': {} as any },
          first_seen: '',
          last_seen: '',
          management_url: null,
          non_subscriptions: {},
          original_app_user_id: 'user-1',
          other_purchases: {},
          subscriptions: {},
        },
      };

      await service.syncRevenueCatCustomerToDatabase('user-1', customerInfo);

      expect(supabaseMock.from).toHaveBeenCalledWith('revenuecat_customers');
    });
  });
});
