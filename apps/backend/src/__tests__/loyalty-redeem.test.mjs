// Integration tests for loyalty point redemption (P3-16).
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

async function createCustomerWithPoints(points) {
  const custRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Test Customer ${Date.now()}`, phone: `+628${Date.now().toString().slice(-10)}` });
  const customerId = custRes.body.id;

  // Set points directly
  const { query, runAsSystem } = require('../db');
  await runAsSystem(() =>
    query(`UPDATE customers SET points = $1 WHERE id = $2`, [points, customerId]),
  );

  return customerId;
}

async function createRedemptionRule() {
  const res = await request(app)
    .post('/api/v1/loyalty-rule')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Redeem Rule',
      rule_type: 'redemption',
      redemption_rate: 100,
      is_active: 1,
    });
  return res.body.id;
}

describe('POST /api/v1/loyalty/redeem', () => {
  it('200 redeems points successfully', async () => {
    const customerId = await createCustomerWithPoints(500);
    await createRedemptionRule();

    const res = await request(app)
      .post('/api/v1/loyalty/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, points: 100 });
    expect(res.status).toBe(200);
    expect(res.body.redeemed).toBe(true);
    expect(res.body.points_used).toBe(100);
    expect(res.body.discount_amount).toBe(10000); // 100 * 100
    expect(res.body.new_balance).toBe(400);
  });

  it('400 insufficient points', async () => {
    const customerId = await createCustomerWithPoints(50);

    const res = await request(app)
      .post('/api/v1/loyalty/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, points: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tidak cukup');
  });

  it('404 customer not found', async () => {
    const res = await request(app)
      .post('/api/v1/loyalty/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: 999999, points: 100 });
    expect(res.status).toBe(404);
  });

  it('400 missing customer_id', async () => {
    const res = await request(app)
      .post('/api/v1/loyalty/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ points: 100 });
    expect(res.status).toBe(400);
  });

  it('400 invalid points', async () => {
    const customerId = await createCustomerWithPoints(500);

    const res = await request(app)
      .post('/api/v1/loyalty/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, points: -10 });
    expect(res.status).toBe(400);
  });
});
