import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;

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
});

afterAll(() => {
  teardownTestEnv();
});

describe('GET /api/promo', () => {
  it('401 tanpa token', async () => {
    const res = await request(app).get('/api/promo');
    expect(res.status).toBe(401);
  });

  it('200 array kosong di awal', async () => {
    const res = await request(app).get('/api/promo').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/promo', () => {
  it('201 buat PERCENT promo', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Diskon 10%',
        promo_type: 'PERCENT',
        discount_value: 10,
        max_discount: 20000,
        min_purchase: 100000,
        is_stackable: false,
        is_active: true,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Diskon 10%',
      promo_type: 'PERCENT',
      discount_value: 10,
      max_discount: 20000,
      is_active: 1,
    });
    expect(res.body.target_product_ids).toEqual([]);
    expect(res.body.target_category_ids).toEqual([]);
    expect(res.body.customer_group_ids).toEqual([]);
  });

  it('400 PERCENT dengan discount_value > 100', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad Percent',
        promo_type: 'PERCENT',
        discount_value: 150,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/discount_value/);
  });

  it('201 buat NOMINAL promo dengan kondisi waktu', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Happy Hour Rp 5k',
        promo_type: 'NOMINAL',
        discount_value: 5000,
        time_of_day_start: '14:00',
        time_of_day_end: '17:00',
        day_of_week_mask: 62, // Mon-Fri (bits 1..5)
      });
    expect(res.status).toBe(201);
    expect(res.body.time_of_day_start).toBe('14:00');
    expect(res.body.day_of_week_mask).toBe(62);
  });

  it('400 BUY_X_GET_Y tanpa target_product_ids', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'BOGO bad',
        promo_type: 'BUY_X_GET_Y',
        qty_required: 2,
        give_qty: 1,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/target_product_ids/);
  });

  it('201 BUY_X_GET_Y valid', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Beli 2 Gratis 1',
        promo_type: 'BUY_X_GET_Y',
        qty_required: 3,
        give_qty: 1,
        discount_target: 'CHEAPEST_OF_TARGET',
        target_product_ids: [1, 2],
      });
    expect(res.status).toBe(201);
    expect(res.body.target_product_ids).toEqual([1, 2]);
    expect(res.body.discount_target).toBe('CHEAPEST_OF_TARGET');
  });

  it('400 BUNDLE_PRICE dengan < 2 produk', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Paket 1',
        promo_type: 'BUNDLE_PRICE',
        bundle_price: 50000,
        target_product_ids: [1],
      });
    expect(res.status).toBe(400);
  });

  it('400 STEP_DISCOUNT tanpa step_tiers', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Step',
        promo_type: 'STEP_DISCOUNT',
      });
    expect(res.status).toBe(400);
  });

  it('201 STEP_DISCOUNT dengan tiers', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Step Discount',
        promo_type: 'STEP_DISCOUNT',
        step_tiers: [
          { min_qty: 5, discount_percent: 5 },
          { min_qty: 10, discount_percent: 10 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.step_tiers).toHaveLength(2);
  });

  it('400 nama kosong', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', promo_type: 'PERCENT', discount_value: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('400 invalid time_of_day order', async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad time',
        promo_type: 'NOMINAL',
        discount_value: 1000,
        time_of_day_start: '18:00',
        time_of_day_end: '10:00',
      });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/promo/:id', () => {
  let promoId;
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Editable',
        promo_type: 'PERCENT',
        discount_value: 5,
      });
    promoId = res.body.id;
  });

  it('200 update discount_value', async () => {
    const res = await request(app)
      .put(`/api/promo/${promoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ discount_value: 12 });
    expect(res.status).toBe(200);
    expect(res.body.discount_value).toBe(12);
  });

  it('404 promo tidak ada', async () => {
    const res = await request(app)
      .put('/api/promo/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ discount_value: 1 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/promo/:id + filter', () => {
  it('200 detail + coupon_count', async () => {
    const res = await request(app).get('/api/promo').set('Authorization', `Bearer ${adminToken}`);
    const first = res.body[0];
    const res2 = await request(app)
      .get(`/api/promo/${first.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body).toHaveProperty('coupon_count');
  });

  it('200 filter promo_type=PERCENT', async () => {
    const res = await request(app)
      .get('/api/promo?promo_type=PERCENT')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((p) => p.promo_type === 'PERCENT')).toBe(true);
  });
});

describe('DELETE /api/promo/:id', () => {
  it('200 delete', async () => {
    const create = await request(app)
      .post('/api/promo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToDelete', promo_type: 'NOMINAL', discount_value: 1000 });
    const res = await request(app)
      .delete(`/api/promo/${create.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('404 delete tidak ada', async () => {
    const res = await request(app)
      .delete('/api/promo/99999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
