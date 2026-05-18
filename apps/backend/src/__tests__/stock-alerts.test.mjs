// Integration tests for stock alerts endpoint.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('GET /api/v1/stock-alerts', () => {
  it('200 returns alerts array', async () => {
    const res = await request(app)
      .get('/api/v1/stock-alerts')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('alerts');
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('threshold');
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('respects custom threshold', async () => {
    const res = await request(app)
      .get('/api/v1/stock-alerts?threshold=0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.threshold).toBe(0);
  });

  it('401 without auth', async () => {
    const res = await request(app)
      .get('/api/v1/stock-alerts');
    expect(res.status).toBe(401);
  });
});
