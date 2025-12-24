import { StripeService } from '../stripe.service';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://example.com/checkout',
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'ps_test_123',
          url: 'https://example.com/portal',
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        id: 'evt_test_123',
        type: 'checkout.session.completed',
      }),
    },
  }));
});

describe('StripeService', () => {
  it('creates a checkout session', async () => {
    const service = new StripeService();
    const session = await service.createCheckoutSession(
      'cust_123',
      'price_123',
      'subscription',
    );

    expect(session.id).toBe('cs_test_123');
  });

  it('creates a customer portal session', async () => {
    const service = new StripeService();
    const session = await service.createCustomerPortalSession('cust_123');

    expect(session.id).toBe('ps_test_123');
  });
});
