import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;
let customerId;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();
  const cust = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Member Test', phone: '08123456789' });
  customerId = cust.body.id;
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('POST /api/loyalty-rule', () => {
  it('201 earn_per_total rule', async () => {
    const res = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Earn 1 poin per Rp 1.000',
        rule_type: 'earn_per_total',
        earn_rate: 1000,
        excluded_payment_methods: ['deposit'],
      });
    expect(res.status).toBe(201);
    expect(res.body.rule_type).toBe('earn_per_total');
    expect(res.body.earn_rate).toBe(1000);
    expect(res.body.excluded_payment_methods).toEqual(['deposit']);
  });

  it('400 earn_per_total tanpa earn_rate', async () => {
    const res = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', rule_type: 'earn_per_total' });
    expect(res.status).toBe(400);
  });

  it('201 redemption rule', async () => {
    const res = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Tukar 100 poin = Rp 5.000',
        rule_type: 'redemption',
        redemption_rate: 50, // 1 poin = Rp 50, jadi 100 poin = Rp 5000
        min_redeem_per_transaction: 100,
        max_redeem_per_transaction: 1000,
        redemption_block: 100,
        points_expire_after_months: 12,
      });
    expect(res.status).toBe(201);
    expect(res.body.redemption_rate).toBe(50);
    expect(res.body.points_expire_after_months).toBe(12);
  });

  it('400 redemption rule tanpa redemption_rate', async () => {
    const res = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', rule_type: 'redemption' });
    expect(res.status).toBe(400);
  });

  it('201 earn_per_product rule', async () => {
    const res = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bonus poin produk Premium',
        rule_type: 'earn_per_product',
        bonus_points: 50,
        target_product_ids: [1, 2, 3],
      });
    expect(res.status).toBe(201);
    expect(res.body.target_product_ids).toEqual([1, 2, 3]);
  });

  it('400 earn_per_product tanpa target produk', async () => {
    const res = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad earn_per_product',
        rule_type: 'earn_per_product',
        bonus_points: 10,
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/loyalty-rule', () => {
  it('200 list semua rule', async () => {
    const res = await request(app)
      .get('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('200 filter rule_type=redemption', async () => {
    const res = await request(app)
      .get('/api/loyalty-rule?rule_type=redemption')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((r) => r.rule_type === 'redemption')).toBe(true);
  });
});

describe('PUT /api/loyalty-rule/:id', () => {
  it('200 update earn_rate', async () => {
    const list = await request(app)
      .get('/api/loyalty-rule?rule_type=earn_per_total')
      .set('Authorization', `Bearer ${adminToken}`);
    const id = list.body[0].id;
    const res = await request(app)
      .put(`/api/loyalty-rule/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ earn_rate: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.earn_rate).toBe(5000);
  });
});

describe('POST /api/loyalty/adjust', () => {
  it('200 tambah poin manual', async () => {
    const res = await request(app)
      .post('/api/loyalty/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, points: 200, notes: 'Bonus opening' });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(200);
    expect(res.body.transaction.type).toBe('adjust');
    expect(res.body.transaction.points).toBe(200);
  });

  it('200 kurangi poin', async () => {
    const res = await request(app)
      .post('/api/loyalty/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, points: -50, notes: 'Penyesuaian' });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(150);
  });

  it('400 saldo tidak boleh negatif', async () => {
    const res = await request(app)
      .post('/api/loyalty/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, points: -10000 });
    expect(res.status).toBe(400);
  });

  it('404 customer tidak ada', async () => {
    const res = await request(app)
      .post('/api/loyalty/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: 99999, points: 100 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/loyalty/transactions', () => {
  it('200 list ledger entries dengan total', async () => {
    const res = await request(app)
      .get(`/api/loyalty/transactions?customer_id=${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('balance_after');
    expect(res.body.items[0]).toHaveProperty('customer_name', 'Member Test');
  });

  it('200 filter type=adjust', async () => {
    const res = await request(app)
      .get('/api/loyalty/transactions?type=adjust')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((t) => t.type === 'adjust')).toBe(true);
  });
});

describe('DELETE /api/loyalty-rule/:id', () => {
  it('200 hapus rule', async () => {
    const create = await request(app)
      .post('/api/loyalty-rule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'ToDelete',
        rule_type: 'redemption',
        redemption_rate: 100,
      });
    const res = await request(app)
      .delete(`/api/loyalty-rule/${create.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
