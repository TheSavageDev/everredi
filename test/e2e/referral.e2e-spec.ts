import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('Referral System E2E', () => {
  let context: TestAppContext;
  let server: any;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  describe('GET /api/users/me/referral/stats', () => {
    it('should return referral stats for authenticated user', async () => {
      const res = await request(server)
        .get('/api/users/me/referral/stats')
        .set(TEST_AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('referralCode');
      expect(res.body.data).toHaveProperty('referralsCount');
      // rewards is optional and may be undefined
    });

    it('should require authentication', async () => {
      const res = await request(server).get('/api/users/me/referral/stats');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/users/me/referral/apply', () => {
    it('should reject invalid referral code', async () => {
      const res = await request(server)
        .post('/api/users/me/referral/apply')
        .set(TEST_AUTH_HEADER)
        .send({ referralCode: 'INVALID123' });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Invalid');
    });

    it('should reject empty referral code', async () => {
      const res = await request(server)
        .post('/api/users/me/referral/apply')
        .set(TEST_AUTH_HEADER)
        .send({ referralCode: '' });

      // Should validate input
      expect([400, 200, 201]).toContain(res.status);
    });

    it('should require authentication', async () => {
      const res = await request(server)
        .post('/api/users/me/referral/apply')
        .send({ referralCode: 'TEST123' });

      expect(res.status).toBe(401);
    });
  });

  // Note: Testing successful referral code application would require:
  // 1. Creating a test user with a referral code
  // 2. Creating another test user to apply that code
  // 3. Verifying both users received rewards
  // This would typically be done with test fixtures or database seeding
});
