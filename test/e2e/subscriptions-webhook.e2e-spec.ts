import request from 'supertest';
import type { TestAppContext } from '../utils/create-testing-app';
import { createTestingApp } from '../utils/create-testing-app';

describe('Subscriptions webhook (e2e)', () => {
  let context: TestAppContext;
  let server: ReturnType<TestAppContext['app']['getHttpServer']>;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  it('POST /api/subscriptions/webhook accepts valid signature and returns 200', () => {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    return request(server)
      .post('/api/subscriptions/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'valid')
      .send(payload)
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual({ received: true });
      });
  });

  it('POST /api/subscriptions/webhook rejects invalid signature with 401', () => {
    const payload = JSON.stringify({ type: 'checkout.session.completed' });
    return request(server)
      .post('/api/subscriptions/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'invalid')
      .send(payload)
      .expect(401)
      .expect((res) => {
        expect(res.body).toHaveProperty('message');
        expect(String(res.body.message).toLowerCase()).toMatch(
          /invalid|signature/,
        );
      });
  });
});
