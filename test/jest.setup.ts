import 'reflect-metadata';

// Ensure NODE_ENV is set for tests
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Provide safe default env vars used in the app so tests don't depend on real secrets
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_dummy';

// Mock @google/generative-ai to avoid real network calls
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () =>
              JSON.stringify([
                {
                  supplyName: 'Bandage',
                  quantity: 10,
                  reason: 'Basic wound care',
                },
              ]),
          },
        }),
      }),
    })),
  };
});

// Mock Stripe to avoid hitting real Stripe API
jest.mock('stripe', () => {
  const createCheckoutSession = jest.fn().mockResolvedValue({
    id: 'cs_test_123',
    url: 'https://example.com/checkout',
  });

  const createPortalSession = jest.fn().mockResolvedValue({
    id: 'ps_test_123',
    url: 'https://example.com/portal',
  });

  const constructEvent = jest.fn().mockReturnValue({
    id: 'evt_test_123',
    type: 'checkout.session.completed',
  });

  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: createCheckoutSession,
      },
    },
    billingPortal: {
      sessions: {
        create: createPortalSession,
      },
    },
    webhooks: {
      constructEvent,
    },
  }));
});

// Mock @google-cloud/tasks to avoid real Cloud Tasks usage
jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => ({
      createTask: jest.fn().mockResolvedValue([{}]),
    })),
  };
});

export {};
