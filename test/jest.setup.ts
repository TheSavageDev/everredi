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
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'everredi-dev-test';

// Mock firebase-admin so we never hit real Firebase in tests
jest.mock('firebase-admin', () => {
  const auth = {
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-user',
      email: 'test@example.com',
    }),
  };

  const firestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      size: 0,
      docs: [],
      exists: false,
      data: () => ({}),
      id: 'doc-id',
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue({
      id: 'doc-id',
      get: jest.fn().mockResolvedValue({
        id: 'doc-id',
        data: () => ({}),
      }),
    }),
  };

  return {
    __esModule: true,
    initializeApp: jest.fn().mockReturnValue({}),
    getApps: jest.fn().mockReturnValue([]),
    getApp: jest.fn().mockReturnValue({}),
    applicationDefault: jest.fn(),
    credential: {
      cert: jest.fn(),
    },
    auth: () => auth,
    firestore: () => firestore,
    // Re-export types shape placeholders where needed
  };
});

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
