import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('Admin Endpoints E2E', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  describe('Admin Guard Protection', () => {
    it('should reject non-admin user from admin endpoints', async () => {
      // Test sponsored supplies endpoint
      const res = await request(server)
        .patch('/api/supplies/test-id')
        .set(TEST_AUTH_HEADER)
        .send({ isSponsored: true });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'ADMIN_REQUIRED');
    });

    it('should reject non-admin user from brand partnerships endpoints', async () => {
      const res = await request(server)
        .get('/api/brand-partnerships/all')
        .set(TEST_AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'ADMIN_REQUIRED');
    });

    it('should reject non-admin user from public kit template endpoints', async () => {
      const res = await request(server)
        .post('/api/kits/public-templates')
        .set(TEST_AUTH_HEADER)
        .send({
          name: 'Test Template',
          description: 'Test',
          category: 'test',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'ADMIN_REQUIRED');
    });
  });

  // Note: Testing actual admin access would require setting up a test user with isAdmin: true
  // This would typically be done in the test setup or using a test fixture
});
