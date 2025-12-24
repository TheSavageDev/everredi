import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('Inventory E2E', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  it('GET /api/inventory returns inventory list', async () => {
    const res = await request(server)
      .get('/api/inventory')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  it('GET /api/inventory/expiring returns expiring items', async () => {
    const res = await request(server)
      .get('/api/inventory/expiring')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
