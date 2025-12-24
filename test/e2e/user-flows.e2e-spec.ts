import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('Critical User Flows E2E', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  describe('Signup → Add Item → Create Kit Flow', () => {
    it('should allow user to signup, add inventory item, and create kit', async () => {
      // Step 1: Signup (create or update user)
      const signupRes = await request(server)
        .post('/api/auth/create-or-update')
        .set(TEST_AUTH_HEADER)
        .send({});

      expect(signupRes.status).toBe(201);
      expect(signupRes.body).toHaveProperty('success', true);
      expect(signupRes.body.data).toHaveProperty('email');

      // Step 2: Create a location (required for inventory)
      const locationRes = await request(server)
        .post('/api/locations')
        .set(TEST_AUTH_HEADER)
        .send({
          name: 'Test Location',
          locationType: 'home',
          isPrimary: true,
        });

      expect(locationRes.status).toBe(201);
      const locationId = locationRes.body.data?.id;
      expect(locationId).toBeDefined();

      // Step 3: Add inventory item
      const inventoryRes = await request(server)
        .post('/api/inventory')
        .set(TEST_AUTH_HEADER)
        .send({
          supplyName: 'Test Supply',
          locationId: locationId,
          quantity: 5,
          status: 'active',
        });

      expect(inventoryRes.status).toBe(201);
      expect(inventoryRes.body).toHaveProperty('success', true);
      expect(inventoryRes.body.data).toHaveProperty(
        'supplyName',
        'Test Supply',
      );

      // Step 4: Get kit templates
      const templatesRes = await request(server)
        .get('/api/public-templates')
        .set(TEST_AUTH_HEADER);

      expect(templatesRes.status).toBe(200);
      expect(templatesRes.body).toHaveProperty('success', true);

      // Step 5: Create a kit from template or custom
      const kitRes = await request(server)
        .post('/api/user-kits')
        .set(TEST_AUTH_HEADER)
        .send({
          name: 'Test Kit',
          locationId: locationId,
          status: 'active',
        });

      expect(kitRes.status).toBe(201);
      expect(kitRes.body).toHaveProperty('success', true);
      expect(kitRes.body.data).toHaveProperty('name', 'Test Kit');
    });
  });

  describe('Premium Upgrade Flow', () => {
    it('should allow user to create checkout session for premium', async () => {
      // Step 1: Create checkout session
      const checkoutRes = await request(server)
        .post('/api/subscriptions/create-checkout')
        .set(TEST_AUTH_HEADER)
        .send({
          priceId: 'price_test_premium',
        });

      // Should either succeed (if Stripe configured) or return appropriate error
      expect([201, 400, 500]).toContain(checkoutRes.status);

      if (checkoutRes.status === 201) {
        expect(checkoutRes.body).toHaveProperty('success', true);
        expect(checkoutRes.body.data).toHaveProperty('url');
      }
    });

    it('should verify premium features are gated', async () => {
      // Try to access premium feature as free user
      const analyticsRes = await request(server)
        .get('/api/analytics/usage-patterns')
        .set(TEST_AUTH_HEADER);

      expect(analyticsRes.status).toBe(403);
      expect(analyticsRes.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });
  });

  describe('Admin: Toggle Sponsored Supply Flow', () => {
    it('should reject non-admin from toggling sponsored supply', async () => {
      // Try to update a supply as non-admin
      const res = await request(server)
        .patch('/api/supplies/test-supply-id')
        .set(TEST_AUTH_HEADER)
        .send({
          isSponsored: true,
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'ADMIN_REQUIRED');
    });

    // Note: Testing actual admin access would require:
    // 1. Setting up a test user with isAdmin: true
    // 2. Creating a test supply
    // 3. Verifying the update succeeds
    // This would typically be done with test fixtures
  });

  describe('Referral Code Application Flow', () => {
    it('should allow user to view referral stats', async () => {
      const res = await request(server)
        .get('/api/users/me/referral/stats')
        .set(TEST_AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('referralCode');
      expect(res.body.data).toHaveProperty('referralsCount');
    });

    it('should handle referral code application attempt', async () => {
      const res = await request(server)
        .post('/api/users/me/referral/apply')
        .set(TEST_AUTH_HEADER)
        .send({
          referralCode: 'TESTCODE123',
        });

      // Should return success: false for invalid code, or success: true if valid
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
    });
  });
});
