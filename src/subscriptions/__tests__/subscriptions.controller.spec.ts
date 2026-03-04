import { SubscriptionsController } from '../subscriptions.controller';
import { SubscriptionsService } from '../subscriptions.service';
import { StripeService } from '../stripe.service';
import { RevenueCatService } from '../revenuecat.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let subscriptionsService: jest.Mocked<Partial<SubscriptionsService>>;
  let stripeService: jest.Mocked<Partial<StripeService>>;
  let revenueCatService: jest.Mocked<Partial<RevenueCatService>>;

  beforeEach(() => {
    subscriptionsService = {
      createCheckoutSession: jest.fn().mockResolvedValue({
        url: 'https://checkout.example.com',
        sessionId: 'cs_123',
      }),
      createCustomerPortalSession: jest.fn().mockResolvedValue({
        url: 'https://portal.example.com',
      }),
      handleWebhookEvent: jest.fn().mockResolvedValue(undefined),
      handleRevenueCatWebhook: jest.fn().mockResolvedValue(undefined),
      syncRevenueCatCustomerToDatabase: jest.fn().mockResolvedValue(undefined),
    };

    stripeService = {
      handleWebhook: jest.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: {} },
      }),
    };

    revenueCatService = {
      getCustomerInfo: jest.fn().mockResolvedValue({ subscriber: {} }),
      cancelSubscription: jest.fn().mockResolvedValue({}),
    };

    controller = new SubscriptionsController(
      subscriptionsService as SubscriptionsService,
      stripeService as StripeService,
      revenueCatService as RevenueCatService,
    );
  });

  describe('createCheckoutSession', () => {
    it('returns session data for authenticated user', async () => {
      const result = await controller.createCheckoutSession(
        { uid: 'user-1' },
        { priceId: 'price_123', mode: 'subscription' },
      );

      expect(subscriptionsService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'price_123',
        'subscription',
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        url: 'https://checkout.example.com',
        sessionId: 'cs_123',
      });
    });
  });

  describe('createCustomerPortal', () => {
    it('returns portal url', async () => {
      const result = await controller.createCustomerPortal({ uid: 'user-1' });

      expect(
        subscriptionsService.createCustomerPortalSession,
      ).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
      expect(result.data?.url).toBe('https://portal.example.com');
    });
  });

  describe('handleWebhook', () => {
    it('returns received when signature valid', async () => {
      const req = { rawBody: Buffer.from('{}') };
      const result = await controller.handleWebhook(req as any, 'sig_123');

      expect(stripeService.handleWebhook).toHaveBeenCalledWith('{}', 'sig_123');
      expect(subscriptionsService.handleWebhookEvent).toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('throws UnauthorizedException on signature error', async () => {
      (stripeService.handleWebhook as jest.Mock).mockImplementation(() => {
        throw new Error('Signature verification failed');
      });
      const req = { rawBody: Buffer.from('{}') };

      await expect(
        controller.handleWebhook(req as any, 'bad_sig'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException on other errors', async () => {
      (stripeService.handleWebhook as jest.Mock).mockImplementation(() => {
        throw new Error('Other error');
      });
      const req = { rawBody: Buffer.from('{}') };

      await expect(
        controller.handleWebhook(req as any, 'sig_123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRevenueCatInfo', () => {
    it('returns customer info on success', async () => {
      const result = await controller.getRevenueCatInfo({ uid: 'user-1' });

      expect(revenueCatService.getCustomerInfo).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ subscriber: {} });
    });

    it('returns error object on failure', async () => {
      (revenueCatService.getCustomerInfo as jest.Mock).mockRejectedValue(
        new Error('API error'),
      );

      const result = await controller.getRevenueCatInfo({ uid: 'user-1' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('API error');
    });
  });

  describe('cancelRevenueCatSubscription', () => {
    it('returns success when cancel succeeds', async () => {
      const result = await controller.cancelRevenueCatSubscription(
        { uid: 'user-1' },
        { productId: 'product_123' },
      );

      expect(revenueCatService.cancelSubscription).toHaveBeenCalledWith(
        'user-1',
        'product_123',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('handleRevenueCatWebhook', () => {
    it('calls service and returns received when no secret in non-production', async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      delete process.env.REVENUECAT_WEBHOOK_SECRET;

      const result = await controller.handleRevenueCatWebhook(
        { event: { app_user_id: 'u1', entitlement_ids: [] } } as any,
        undefined,
      );

      expect(subscriptionsService.handleRevenueCatWebhook).toHaveBeenCalled();
      expect(result).toEqual({ received: true });
      process.env.NODE_ENV = orig;
    });
  });

  describe('syncRevenueCatData', () => {
    it('syncs and returns success', async () => {
      const result = await controller.syncRevenueCatData({ uid: 'user-1' });

      expect(revenueCatService.getCustomerInfo).toHaveBeenCalledWith('user-1');
      expect(
        subscriptionsService.syncRevenueCatCustomerToDatabase,
      ).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(result.success).toBe(true);
    });
  });
});
