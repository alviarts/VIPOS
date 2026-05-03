import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;
let productId;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

async function newOrder(overrides = {}) {
  const payload = {
    channel: 'emenu',
    order_type: 'delivery',
    customer_name: 'Andi',
    customer_phone: '08123456789',
    customer_address: 'Jl. Kenanga 12',
    delivery_fee: 10000,
    items: [{ product_id: productId, product_name: 'Kopi', qty: 2, price: 25000 }],
    ...overrides,
  };
  const res = await request(app)
    .post('/api/online-order')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(payload);
  return res.body;
}

beforeAll(async () => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();

  // Create a category + product so order items reference real product.
  const cat = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Minuman' });
  const prod = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Kopi Susu',
      sku: 'KS-001',
      price: 25000,
      category_id: cat.body.id,
    });
  productId = prod.body.id;
});

afterAll(() => {
  teardownTestEnv();
});

describe('Online order CRUD + state machine', () => {
  it('creates order with computed totals', async () => {
    const order = await newOrder();
    expect(order.id).toBeGreaterThan(0);
    expect(order.status).toBe('NEW');
    expect(order.subtotal).toBe(50000);
    expect(order.total).toBe(60000); // subtotal 50000 + delivery 10000
    expect(order.items).toHaveLength(1);
    expect(order.ref_no).toMatch(/^EME-/);
  });

  it('rejects empty items', async () => {
    const res = await request(app)
      .post('/api/online-order')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ channel: 'emenu', items: [] });
    expect(res.status).toBe(400);
  });

  it('lists orders with status filter', async () => {
    const res = await request(app)
      .get('/api/online-order?status=NEW&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((o) => o.status === 'NEW')).toBe(true);
  });

  it('transitions NEW → PREPARING → READY → COMPLETED', async () => {
    const order = await newOrder();
    const accept = await request(app)
      .post(`/api/online-order/${order.id}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(accept.body.status).toBe('PREPARING');
    expect(accept.body.accepted_at).toBeTruthy();

    const ready = await request(app)
      .post(`/api/online-order/${order.id}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ready.body.status).toBe('READY');
    expect(ready.body.ready_at).toBeTruthy();

    const complete = await request(app)
      .post(`/api/online-order/${order.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(complete.body.status).toBe('COMPLETED');
    expect(complete.body.completed_at).toBeTruthy();
  });

  it('rejects invalid transition (e.g. COMPLETED → CANCELLED)', async () => {
    const order = await newOrder();
    await request(app)
      .post(`/api/online-order/${order.id}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/online-order/${order.id}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/online-order/${order.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .post(`/api/online-order/${order.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test cancel' });
    expect(res.status).toBe(400);
  });

  it('rejects with reason', async () => {
    const order = await newOrder();
    const res = await request(app)
      .post(`/api/online-order/${order.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Stok habis' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.reject_reason).toBe('Stok habis');
  });

  it('cancels with reason', async () => {
    const order = await newOrder();
    const res = await request(app)
      .post(`/api/online-order/${order.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer batal' });
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancel_reason).toBe('Customer batal');
    expect(res.body.cancelled_at).toBeTruthy();
  });
});

describe('Marketplace webhook ingestion', () => {
  it('accepts webhook from gofood (no auth)', async () => {
    const res = await request(app)
      .post('/api/online-order/webhook/gofood')
      .send({
        channel: 'gofood', // overridden by route param
        external_ref: 'GF-EXT-9999',
        order_type: 'delivery',
        customer_name: 'Webhook Test',
        items: [{ product_id: productId, product_name: 'Kopi', qty: 1, price: 30000 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.channel).toBe('gofood');
    expect(res.body.status).toBe('NEW');
  });

  it('rejects unknown provider in webhook', async () => {
    const res = await request(app)
      .post('/api/online-order/webhook/unknown-provider')
      .send({ channel: 'emenu', items: [] });
    expect(res.status).toBe(400);
  });

  it('auto-accepts when marketplace.auto_accept=1', async () => {
    // Connect provider with auto_accept=1
    await request(app)
      .post('/api/marketplace/grabfood/connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ merchant_id: 'GF-MERCHANT', auto_accept: 1 });

    const res = await request(app)
      .post('/api/online-order/webhook/grabfood')
      .send({
        channel: 'grabfood',
        order_type: 'delivery',
        items: [{ product_id: productId, product_name: 'Kopi', qty: 1, price: 25000 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PREPARING');
  });
});

describe('Marketplace connections + sync', () => {
  it('lists all providers (auto-create rows)', async () => {
    const res = await request(app)
      .get('/api/marketplace')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(5);
    const providers = res.body.map((c) => c.provider).sort();
    expect(providers).toEqual(['gofood', 'grabfood', 'grabmart', 'shopeefood', 'tokopedia']);
  });

  it('connect generates mock oauth_token', async () => {
    const res = await request(app)
      .post('/api/marketplace/gofood/connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        merchant_id: 'M-123',
        outlet_id: 'O-1',
        sla_accept_minutes: 5,
        sla_ready_minutes: 15,
        mdr_percent: 22,
        price_markup_percent: 25,
      });
    expect(res.body.status).toBe('connected');
    expect(res.body.merchant_id).toBe('M-123');
    expect(res.body.oauth_token).toMatch(/^mock_/);
    expect(res.body.connected_at).toBeTruthy();
  });

  it('disconnect clears tokens', async () => {
    await request(app)
      .post('/api/marketplace/shopeefood/connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ merchant_id: 'S-1' });
    const res = await request(app)
      .post('/api/marketplace/shopeefood/disconnect')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const list = await request(app)
      .get('/api/marketplace')
      .set('Authorization', `Bearer ${adminToken}`);
    const sf = list.body.find((c) => c.provider === 'shopeefood');
    expect(sf.status).toBe('disconnected');
    expect(sf.oauth_token).toBe(null);
  });

  it('upserts product override + sync marks synced', async () => {
    await request(app)
      .post('/api/marketplace/gofood/connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ merchant_id: 'M-1' });
    const upsert = await request(app)
      .post('/api/marketplace/gofood/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        product_id: productId,
        override_price: 30000,
        is_enabled: 1,
      });
    expect(upsert.body.sync_status).toBe('pending');
    expect(upsert.body.override_price).toBe(30000);

    const sync = await request(app)
      .post('/api/marketplace/gofood/sync-products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sync.body.synced).toBeGreaterThanOrEqual(1);

    const products = await request(app)
      .get('/api/marketplace/gofood/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const row = products.body.find((p) => p.product_id === productId);
    expect(row.sync_status).toBe('synced');
    expect(row.product_name).toBe('Kopi Susu');
  });

  it('sync fails when not connected', async () => {
    const res = await request(app)
      .post('/api/marketplace/tokopedia/sync-products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('settlement aggregates per provider', async () => {
    // Create + complete a gofood order
    const order = await request(app)
      .post('/api/online-order/webhook/gofood')
      .send({
        channel: 'gofood',
        order_type: 'delivery',
        items: [{ product_id: productId, product_name: 'Kopi', qty: 2, price: 30000 }],
      });
    const id = order.body.id;
    // Skip accept if auto-accepted
    if (order.body.status === 'NEW') {
      await request(app)
        .post(`/api/online-order/${id}/accept`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await request(app)
      .post(`/api/online-order/${id}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/online-order/${id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/marketplace/settlement')
      .set('Authorization', `Bearer ${adminToken}`);
    const gf = res.body.rows.find((r) => r.provider === 'gofood');
    expect(gf).toBeTruthy();
    expect(gf.completed_orders).toBeGreaterThanOrEqual(1);
    expect(gf.gross_revenue).toBeGreaterThanOrEqual(60000);
    // mdr_percent default 22 (kalau dari connect sebelumnya), atau 20.
    expect(gf.mdr).toBeGreaterThan(0);
    expect(gf.net_revenue).toBeLessThan(gf.gross_revenue);
  });
});

describe('Storefront + Consumer App config', () => {
  it('GET storefront-settings auto-creates default row', async () => {
    const res = await request(app)
      .get('/api/storefront-settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.brand_name).toBe('Toko Saya');
    expect(res.body.primary_color).toBe('#04C99E');
  });

  it('PUT storefront-settings persists JSON fields', async () => {
    const res = await request(app)
      .put('/api/storefront-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        brand_name: 'Toko Vipos',
        operating_hours: [{ day: 'mon', open: '09:00', close: '21:00', is_closed: false }],
        delivery_zones: [{ name: 'Zona A', fee: 10000, min_order: 50000, radius_km: 3 }],
        min_order_amount: 50000,
        supports_delivery: 1,
      });
    expect(res.body.brand_name).toBe('Toko Vipos');
    expect(res.body.operating_hours).toHaveLength(1);
    expect(res.body.delivery_zones[0].name).toBe('Zona A');
    expect(res.body.min_order_amount).toBe(50000);
  });

  it('GET consumer-app-config auto-creates default row', async () => {
    const res = await request(app)
      .get('/api/consumer-app-config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.app_name).toBe('Toko Saya App');
    expect(res.body.status).toBe('draft');
  });

  it('PUT consumer-app-config persists status transitions', async () => {
    const res = await request(app)
      .put('/api/consumer-app-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        app_name: 'Vipos Customer App',
        bundle_id_android: 'com.vipos.customer',
        status: 'submitted',
      });
    expect(res.body.app_name).toBe('Vipos Customer App');
    expect(res.body.status).toBe('submitted');
  });
});
