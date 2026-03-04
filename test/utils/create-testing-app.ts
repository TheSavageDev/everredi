import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { UsersService } from '../../src/users/users.service';
import { AdminGuard } from '../../src/common/guards/admin.guard';
import { PremiumGuard } from '../../src/common/guards/premium.guard';
import { TEST_USER_EMAIL, TEST_USER_ID } from './test-auth';
import { StripeService } from '../../src/subscriptions/stripe.service';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

export interface TestAppContext {
  app: INestApplication;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  isPremium?: boolean;
  isAdmin?: boolean;
}

export async function createTestingApp(
  options?: TestAppOptions,
): Promise<TestAppContext> {
  const { isPremium = false, isAdmin = false } = options || {};

  const usersServiceMock: Partial<UsersService> = {
    createOrUpdateUser: jest
      .fn()
      .mockImplementation(
        (id: string, email: string, displayName?: string) => ({
          id,
          email,
          displayName,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        }),
      ),
    getUserById: jest.fn().mockResolvedValue({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }),
    updateUser: jest.fn().mockResolvedValue({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }),
    getSubscriptionStatus: jest.fn().mockResolvedValue({
      tier: isPremium ? 'premium' : 'free',
      status: 'active',
      expiresAt: undefined,
      isPremium: isPremium,
    }),
    isAdminUser: jest.fn().mockResolvedValue(isAdmin),
    isPremiumUser: jest.fn().mockResolvedValue(isPremium),
    getReferralStats: jest.fn().mockResolvedValue({
      referralCode: 'TESTCODE123',
      referredBy: undefined,
      referralsCount: 0,
      rewards: undefined,
    }),
    applyReferralCode: jest.fn().mockResolvedValue({
      success: false,
      message: 'Invalid referral code',
    }),
  };

  // Create a PremiumGuard mock that ensures user is set and checks premium status
  // For simplicity, we check premium status for all routes that reach here
  // The real guard checks @Premium() decorator first, but our mock simplifies this
  const premiumGuardMock = {
    canActivate: jest.fn().mockImplementation(async (context) => {
      const request = context.switchToHttp().getRequest();

      // CRITICAL: Always set user if auth header exists
      const authHeader =
        request.headers?.authorization || request.headers?.Authorization;
      if (
        authHeader &&
        typeof authHeader === 'string' &&
        authHeader.startsWith('Bearer ')
      ) {
        request.user = {
          uid: TEST_USER_ID,
          email: TEST_USER_EMAIL,
          name: 'Test User',
        };
      }

      const user = request.user as { uid?: string } | undefined;
      const uid = user?.uid;
      if (!uid) {
        throw new ForbiddenException({
          code: 'AUTH_REQUIRED',
          message: 'Authentication required.',
        });
      }

      // Check premium status for all routes (simplified - real guard checks @Premium() first)
      // This ensures all premium routes are protected in tests
      const subscription = await usersServiceMock.getSubscriptionStatus?.(uid);
      if (!subscription?.isPremium) {
        throw new ForbiddenException({
          code: 'PREMIUM_REQUIRED',
          message: 'Premium subscription required.',
        });
      }

      return true;
    }),
  } as unknown as PremiumGuard;

  // Create a mock AdminGuard that checks admin status
  // Matches the real AdminGuard implementation
  // Uses closure to access usersServiceMock
  const adminGuardMock = {
    canActivate: jest.fn().mockImplementation(async (context) => {
      const request = context.switchToHttp().getRequest();
      let user = request.user as { uid?: string } | undefined;

      // If user is not set but auth header exists, set it (for endpoints that only use AdminGuard)
      if (!user?.uid) {
        const authHeader = request.headers?.authorization;
        if (
          authHeader &&
          typeof authHeader === 'string' &&
          authHeader.startsWith('Bearer ')
        ) {
          // Set user so AdminGuard can check admin status
          request.user = {
            uid: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            name: 'Test User',
          };
          user = request.user;
        } else {
          // No user and no auth header - throw AUTH_REQUIRED
          throw new ForbiddenException({
            code: 'AUTH_REQUIRED',
            message: 'Authentication required.',
          });
        }
      }

      const uid = user?.uid;
      if (!uid) {
        throw new ForbiddenException({
          code: 'AUTH_REQUIRED',
          message: 'Authentication required.',
        });
      }

      // Check admin status using the usersServiceMock (via closure)
      // This will use the mock that's injected into the module
      const isAdmin = await usersServiceMock.isAdminUser?.(uid);

      if (!isAdmin) {
        throw new ForbiddenException({
          code: 'ADMIN_REQUIRED',
          message: 'Admin access required.',
        });
      }

      return true;
    }),
  } as unknown as AdminGuard;

  const stripeServiceMock: Partial<StripeService> = {
    createCheckoutSession: jest.fn().mockResolvedValue({
      id: 'test-session-id',
      url: 'https://checkout.stripe.com/test',
    } as any),
    createCustomer: jest.fn().mockResolvedValue({
      id: 'test-customer-id',
    } as any),
    createCustomerPortalSession: jest.fn().mockResolvedValue({
      url: 'https://billing.stripe.com/test',
    } as any),
    handleWebhook: jest.fn().mockImplementation((payload: string, signature: string) => {
      if (signature === 'valid' || signature?.startsWith('valid_')) {
        return { id: 'evt_test_123', type: 'checkout.session.completed' } as any;
      }
      throw new Error('Invalid signature');
    }),
  };

  const subscriptionsServiceMock: Partial<SubscriptionsService> = {
    createCheckoutSession: jest.fn().mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
      sessionId: 'test-session-id',
    }),
    createCustomerPortalSession: jest.fn().mockResolvedValue({
      url: 'https://billing.stripe.com/test',
    }),
    handleWebhookEvent: jest.fn().mockResolvedValue(undefined),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(AdminGuard)
    .useValue(adminGuardMock)
    // Override PremiumGuard with our mock that ensures user is set
    .overrideGuard(PremiumGuard)
    .useValue(premiumGuardMock)
    .overrideProvider(UsersService)
    .useValue(usersServiceMock)
    .overrideProvider(StripeService)
    .useValue(stripeServiceMock)
    .overrideProvider(SubscriptionsService)
    .useValue(subscriptionsServiceMock)
    .compile();

  const app = moduleFixture.createNestApplication({
    rawBody: true, // Required for Stripe webhook tests (req.rawBody)
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  await app.init();

  // After app initialization, we can access the module's Reflector
  // But for now, we'll rely on the guard overrides working correctly
  // The real PremiumGuard will use our mocked UsersService

  return {
    app: app,
    close: () => app.close(),
  };
}
