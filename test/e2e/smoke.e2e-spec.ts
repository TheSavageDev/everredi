import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';
import { TEST_AUTH_HEADER } from '../utils/test-auth';

describe('API Smoke E2E', () => {
  let context: TestAppContext;
  let server: any;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  it('GET /api/locations responds successfully', async () => {
    const res = await request(server)
      .get('/api/locations')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('GET /api/supply-categories responds successfully', async () => {
    const res = await request(server)
      .get('/api/supply-categories')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('GET /api/supplies responds successfully', async () => {
    const res = await request(server)
      .get('/api/supplies')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('GET /api/notifications responds successfully', async () => {
    const res = await request(server)
      .get('/api/notifications')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('GET /api/notifications/preferences requires premium', async () => {
    const res = await request(server)
      .get('/api/notifications/preferences')
      .set(TEST_AUTH_HEADER);

    // This endpoint is now a premium feature (moved to AdvancedNotificationsController)
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('code', 'PREMIUM_REQUIRED');
  });

  it('GET /api/kits responds successfully', async () => {
    const res = await request(server).get('/api/kits').set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('GET /api/user-kits responds successfully', async () => {
    const res = await request(server)
      .get('/api/user-kits')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('GET /api/public-templates responds successfully', async () => {
    const res = await request(server)
      .get('/api/public-templates')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('POST /api/subscriptions/create-checkout responds successfully', async () => {
    const res = await request(server)
      .post('/api/subscriptions/create-checkout')
      .set(TEST_AUTH_HEADER)
      .send({ priceId: 'price_test' });

    expect(res.status).toBe(201);
  });

  it('GET /api/compliance/checks responds successfully', async () => {
    const res = await request(server)
      .get('/api/compliance/checks')
      .set(TEST_AUTH_HEADER);

    expect(res.status).toBe(200);
  });
});
