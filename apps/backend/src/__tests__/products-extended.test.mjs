// VIPOS — P1-04 product master + variants + recipe tests.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;
let productId;
let ingredientId;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = login.body.token;
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('POST /api/products with new fields', () => {
  it('creates a product with image_urls + price_online + is_online_active', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth())
      .send({
        name: 'Espresso Single',
        sku: `ESP-${Date.now()}`,
        price: 15000,
        image_urls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
        price_online: 18000,
        is_online_active: true,
      });
    expect(res.status).toBe(201);
    productId = res.body.id;

    const single = await request(app).get(`/api/products/${productId}`).set(auth());
    expect(single.body.image_urls).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
    expect(single.body.price_online).toBe(18000);
    expect(single.body.is_online_active).toBe(1);
  });

  it('rejects more than 4 images via Zod', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth())
      .send({
        name: 'Too Many Pics',
        sku: `TMP-${Date.now()}`,
        price: 1000,
        image_urls: ['1', '2', '3', '4', '5'],
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/products with pagination', () => {
  it('returns { data, total, page, per_page, total_pages } when ?page=', async () => {
    const res = await request(app).get('/api/products?page=1&per_page=2').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body.page).toBe(1);
    expect(res.body.per_page).toBe(2);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns array (legacy) when no page param', async () => {
    const res = await request(app).get('/api/products').set(auth());
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PUT /api/products/:id/variants', () => {
  it('replaces the entire variant set atomically', async () => {
    const variants = [
      { group_name: 'Ukuran', option_label: 'Reguler', price_modifier: 0, is_default: true },
      { group_name: 'Ukuran', option_label: 'Large', price_modifier: 5000 },
      { group_name: 'Ukuran', option_label: 'Jumbo', price_modifier: 10000 },
    ];
    const res = await request(app)
      .put(`/api/products/${productId}/variants`)
      .set(auth())
      .send({ variants });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].group_name).toBe('Ukuran');

    // Reduce to 1 variant — must wipe the others.
    const reduced = await request(app)
      .put(`/api/products/${productId}/variants`)
      .set(auth())
      .send({ variants: [variants[0]] });
    expect(reduced.body.length).toBe(1);
  });

  it('rejects invalid variants', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}/variants`)
      .set(auth())
      .send({ variants: [{ price_modifier: 1 }] });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/products/:id/recipe', () => {
  it('creates an ingredient and links it via recipe', async () => {
    const ing = await request(app)
      .post('/api/products')
      .set(auth())
      .send({
        name: 'Susu Cair',
        sku: `MILK-${Date.now()}`,
        price: 15000,
        satuan: 'ml',
      });
    expect(ing.status).toBe(201);
    ingredientId = ing.body.id;

    const res = await request(app)
      .put(`/api/products/${productId}/recipe`)
      .set(auth())
      .send({
        items: [{ ingredient_id: ingredientId, qty: 200, unit: 'ml' }],
      });
    expect(res.status).toBe(200);
    expect(res.body[0].ingredient_id).toBe(ingredientId);
    expect(res.body[0].qty).toBe(200);
    expect(res.body[0].ingredient_name).toBe('Susu Cair');
  });

  it('rejects qty <= 0', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}/recipe`)
      .set(auth())
      .send({ items: [{ ingredient_id: ingredientId, qty: 0 }] });
    expect(res.status).toBe(400);
  });

  it('rejects self-reference', async () => {
    const res = await request(app)
      .put(`/api/products/${productId}/recipe`)
      .set(auth())
      .send({ items: [{ ingredient_id: productId, qty: 1 }] });
    expect(res.status).toBe(400);
  });
});
