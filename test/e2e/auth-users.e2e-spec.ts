import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('Auth & Users E2E', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  it('POST /api/auth/create-or-update creates or updates a user', async () => {
    const res = await request(server)
      .post('/api/auth/create-or-update')
      .set(TEST_AUTH_HEADER)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /api/users/me returns current user', async () => {
    const res = await request(server)
      .get('/api/users/me')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });
});
