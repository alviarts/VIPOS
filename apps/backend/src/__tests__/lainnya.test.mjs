// VIPOS — P1-18 LAINNYA endpoints (help, services, inspirasi, capital, supplies).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

beforeAll(async () => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
});

afterAll(() => {
  teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Bantuan: help topics', () => {
  it('list seeded topics', async () => {
    const res = await request(app).get('/api/help/topics').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('detail by slug', async () => {
    const res = await request(app).get('/api/help/topics/memulai-vipos').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Memulai VIPOS');
  });

  it('search by query', async () => {
    const res = await request(app).get('/api/help/topics?q=produk').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.some((t) => t.slug === 'kelola-produk')).toBe(true);
  });

  it('submit feedback (validation)', async () => {
    const bad = await request(app)
      .post('/api/help/feedback')
      .set(auth())
      .send({ type: 'invalid', title: 'x', description: 'short' });
    expect(bad.status).toBe(400);

    const ok = await request(app).post('/api/help/feedback').set(auth()).send({
      type: 'bug',
      title: 'Ada bug di kasir',
      description: 'Klik bayar kadang tidak mengembalikan kembalian dengan benar.',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('open');
  });
});

describe('Layanan: catalog & applications', () => {
  it('returns service catalog', async () => {
    const res = await request(app).get('/api/services/catalog').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
    const keys = res.body.map((s) => s.key).sort();
    expect(keys).toEqual(['aura', 'edc', 'majoopay', 'satu_sehat']);
  });

  it('apply for majoopay then prevent duplicate', async () => {
    const res = await request(app)
      .post('/api/services/applications')
      .set(auth())
      .send({ service_key: 'majoopay', payload: { volume: 50_000_000 } });
    expect(res.status).toBe(201);
    const dup = await request(app)
      .post('/api/services/applications')
      .set(auth())
      .send({ service_key: 'majoopay' });
    expect(dup.status).toBe(409);
  });
});

describe('Inspirasi: articles + events + magazines + changelog', () => {
  it('list articles', async () => {
    const res = await request(app).get('/api/inspirasi/articles').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('filter articles by category', async () => {
    const res = await request(app).get('/api/inspirasi/articles?category=tips').set(auth());
    expect(res.status).toBe(200);
    for (const a of res.body) expect(a.category).toBe('tips');
  });

  it('list events with rsvp_count', async () => {
    const res = await request(app).get('/api/inspirasi/events?upcoming=true').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].rsvp_count).toBeDefined();
  });

  it('rsvp to an event', async () => {
    const events = await request(app).get('/api/inspirasi/events?upcoming=true').set(auth());
    const eventId = events.body[0].id;
    const res = await request(app)
      .post(`/api/inspirasi/events/${eventId}/rsvp`)
      .set(auth())
      .send({ status: 'going' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('going');
  });

  it('list magazines', async () => {
    const res = await request(app).get('/api/inspirasi/magazines').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('list changelog', async () => {
    const res = await request(app).get('/api/inspirasi/changelog').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('Capital: pre-qualification + applications', () => {
  it('pre-qualification returns score + factors', async () => {
    const res = await request(app).get('/api/capital/pre-qualification').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('is_eligible');
    expect(res.body).toHaveProperty('pre_approved_limit');
    expect(res.body).toHaveProperty('score');
    expect(Array.isArray(res.body.factors)).toBe(true);
  });

  it('rejects application below validation threshold', async () => {
    const res = await request(app)
      .post('/api/capital/applications')
      .set(auth())
      .send({ amount: 500, tenure_months: 6, purpose: 'modal' });
    expect(res.status).toBe(400); // Zod min validation
  });
});

describe('Supplies: catalog + cart + checkout', () => {
  it('list categories', async () => {
    const res = await request(app).get('/api/supplies/categories').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('list products', async () => {
    const res = await request(app).get('/api/supplies/products').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('filter products by category', async () => {
    const res = await request(app).get('/api/supplies/products?category=kemasan').set(auth());
    expect(res.status).toBe(200);
    for (const p of res.body) expect(p.category_slug).toBe('kemasan');
  });

  it('add to cart, list, checkout', async () => {
    const products = await request(app).get('/api/supplies/products').set(auth());
    const product = products.body[0];

    const add = await request(app)
      .post('/api/supplies/cart/add')
      .set(auth())
      .send({ product_id: product.id, qty: Math.max(product.moq, 2) });
    expect(add.status).toBe(200);
    expect(add.body.items.length).toBeGreaterThan(0);

    const cart = await request(app).get('/api/supplies/cart').set(auth());
    expect(cart.status).toBe(200);
    expect(cart.body.total_amount).toBeGreaterThan(0);

    const checkout = await request(app).post('/api/supplies/checkout').set(auth()).send({
      payment_method: 'bank_transfer',
      delivery_address: 'Jl. Merdeka No. 1, Jakarta Pusat 10110',
    });
    expect(checkout.status).toBe(201);
    expect(checkout.body.status).toBe('ordered');
  });

  it('list orders + receive', async () => {
    const orders = await request(app).get('/api/supplies/orders').set(auth());
    expect(orders.status).toBe(200);
    expect(orders.body.length).toBeGreaterThan(0);

    const receive = await request(app)
      .post(`/api/supplies/orders/${orders.body[0].id}/receive`)
      .set(auth());
    expect(receive.status).toBe(200);
    expect(receive.body.status).toBe('delivered');
  });
});
