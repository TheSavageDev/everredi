import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('Premium Feature Gates E2E', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  describe('Premium Guard Protection', () => {
    it('should reject free user from premium analytics endpoint', async () => {
      const res = await request(server)
        .get('/api/analytics/usage-patterns')
        .set(TEST_AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });

    it('should reject free user from bulk operations endpoint', async () => {
      const res = await request(server)
        .post('/api/bulk/export')
        .set(TEST_AUTH_HEADER)
        .send({ type: 'inventory' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });

    it('should reject free user from custom fields endpoint', async () => {
      const res = await request(server)
        .post('/api/custom-fields')
        .set(TEST_AUTH_HEADER)
        .send({
          name: 'Test Field',
          type: 'text',
          required: false,
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });

    it('should reject free user from API keys endpoint', async () => {
      const res = await request(server)
        .post('/api/api-keys')
        .set(TEST_AUTH_HEADER)
        .send({
          name: 'Test API Key',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });

    it('should reject free user from teams endpoint', async () => {
      const res = await request(server)
        .post('/api/teams')
        .set(TEST_AUTH_HEADER)
        .send({
          name: 'Test Team',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });

    it('should reject free user from sharing endpoint', async () => {
      const res = await request(server)
        .post('/api/sharing/kits/test-kit-id/share')
        .set(TEST_AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });

    it('should reject free user from advanced notifications endpoint', async () => {
      const res = await request(server)
        .get('/api/notifications/advanced/preferences')
        .set(TEST_AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
    });
  });

  // Note: Testing actual premium access would require setting up a test user with subscriptionTier: 'premium'
  // This would typically be done in the test setup or using a test fixture
});
