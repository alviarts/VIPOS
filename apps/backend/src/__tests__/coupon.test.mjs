import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;
let promoId;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

beforeAll(async () => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();
  const promo = await request(app)
    .post('/api/promo')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Welcome Voucher Rp 25k',
      promo_type: 'NOMINAL',
      discount_value: 25000,
      min_purchase: 100000,
      requires_coupon: true,
    });
  promoId = promo.body.id;
});

afterAll(() => {
  teardownTestEnv();
});

describe('POST /api/coupon (single)', () => {
  it('201 create kupon dengan kode custom', async () => {
    const res = await request(app)
      .post('/api/coupon')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        promo_id: promoId,
        code: 'welcome25',
        max_uses: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('WELCOME25');
    expect(res.body.max_uses).toBe(1);
  });

  it('400 kode duplikat', async () => {
    const res = await request(app)
      .post('/api/coupon')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promo_id: promoId, code: 'WELCOME25' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sudah/i);
  });

  it('400 promo_id invalid', async () => {
    const res = await request(app)
      .post('/api/coupon')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promo_id: 99999, code: 'NEWCODE' });
    expect(res.status).toBe(400);
  });

  it('400 kode tidak valid (lowercase tanpa allowed chars)', async () => {
    const res = await request(app)
      .post('/api/coupon')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promo_id: promoId, code: 'has space' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/coupon/bulk', () => {
  it('201 generate 5 kode bulk', async () => {
    const res = await request(app)
      .post('/api/coupon/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        promo_id: promoId,
        count: 5,
        prefix: 'JAN-',
        code_length: 6,
      });
    expect(res.status).toBe(201);
    expect(res.body.codes).toHaveLength(5);
    expect(res.body.batch_id).toMatch(/^BATCH-/);
    res.body.codes.forEach((c) => expect(c.startsWith('JAN-')).toBe(true));
  });

  it('semua kode unik', async () => {
    const res = await request(app)
      .post('/api/coupon/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promo_id: promoId, count: 50, code_length: 8 });
    expect(res.status).toBe(201);
    const set = new Set(res.body.codes);
    expect(set.size).toBe(50);
  });
});

describe('GET /api/coupon + GET /api/coupon/batches', () => {
  it('200 list dengan total + items', async () => {
    const res = await request(app).get('/api/coupon').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('200 filter is_active=1', async () => {
    const res = await request(app)
      .get('/api/coupon?is_active=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((c) => c.is_active === 1)).toBe(true);
  });

  it('200 batches summary', async () => {
    const res = await request(app)
      .get('/api/coupon/batches')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((b) => {
      expect(b).toHaveProperty('batch_id');
      expect(b).toHaveProperty('generated');
      expect(b).toHaveProperty('used');
      expect(b).toHaveProperty('remaining');
    });
  });
});

describe('POST /api/coupon/validate', () => {
  it('valid: subtotal cukup', async () => {
    const res = await request(app)
      .post('/api/coupon/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'WELCOME25', subtotal: 150000 });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.estimated_discount).toBe(25000);
  });

  it('invalid: subtotal kurang dari min_purchase', async () => {
    const res = await request(app)
      .post('/api/coupon/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'WELCOME25', subtotal: 50000 });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/Min belanja/);
  });

  it('invalid: kode tidak ditemukan', async () => {
    const res = await request(app)
      .post('/api/coupon/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'NONEXISTENT', subtotal: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });
});

describe('POST /api/coupon/redeem', () => {
  let bulkBatch;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/coupon/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promo_id: promoId, count: 2, code_length: 6 });
    bulkBatch = res.body;
  });

  it('200 redeem berhasil + increment used_count', async () => {
    const code = bulkBatch.codes[0];
    const res = await request(app)
      .post('/api/coupon/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code, subtotal: 200000, amount: 25000 });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.coupon.used_count).toBe(1);
  });

  it('400 redeem dua kali (max_uses=1)', async () => {
    const code = bulkBatch.codes[0];
    const res = await request(app)
      .post('/api/coupon/redeem')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code, subtotal: 200000 });
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toMatch(/maksimal/i);
  });
});

describe('DELETE /api/coupon/batch/:batch_id', () => {
  it('200 deactivate batch', async () => {
    const bulk = await request(app)
      .post('/api/coupon/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promo_id: promoId, count: 3, code_length: 6 });
    const batchId = bulk.body.batch_id;
    const del = await request(app)
      .delete(`/api/coupon/batch/${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    expect(del.body.updated).toBe(3);

    // All in batch should now be inactive.
    const list = await request(app)
      .get(`/api/coupon?batch_id=${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.items.every((c) => c.is_active === 0)).toBe(true);
  });
});
