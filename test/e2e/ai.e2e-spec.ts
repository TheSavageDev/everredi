import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('AI E2E', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
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
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
  });
});
