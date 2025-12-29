import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('AI E2E', () => {
  let context: TestAppContext;
  let server: any;

  beforeEach(async () => {
    // Create test app with premium status enabled for AI tests
    context = await createTestingApp({ isPremium: true });
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  it('POST /api/ai/recommendations returns a recommendation', async () => {
    const res = await request(server)
      .post('/api/ai/recommendations')
      .set(TEST_AUTH_HEADER)
      .send({
        prompt: 'Basic first aid kit',
        purpose: 'home',
        groupSize: 4,
        environment: 'home',
        skillLevel: 'beginner',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
  });
});
