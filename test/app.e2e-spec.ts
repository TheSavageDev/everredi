import request from 'supertest';
import type { TestAppContext } from './utils/create-testing-app';
import { createTestingApp } from './utils/create-testing-app';

describe('AppController (e2e)', () => {
  let context: TestAppContext;
  let server: unknown;

  beforeEach(async () => {
    context = await createTestingApp();
    server = context.app.getHttpServer();
  });

  afterEach(async () => {
    await context.close();
  });

  it('/api/health (GET)', () => {
    return request(server)
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'ok',
          service: 'everredi-api',
        });
      });
  });
});
