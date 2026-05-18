import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('GET /api/products', () => {
  it('200 + array (mungkin kosong di DB fresh)', async () => {
    const res = await request(app).get('/api/products').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('401 tanpa auth', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/products (validation + happy path)', () => {
  it('400 kalau name+price missing', async () => {
    const res = await request(app).post('/api/products').set(auth()).send({ sku: 'NOPE-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    const paths = res.body.details.map((d) => d.path);
    expect(paths).toContain('name');
  });

  it('400 kalau price negatif', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth())
      .send({ name: 'X', sku: 'NEG-1', price: -10 });
    expect(res.status).toBe(400);
  });

  it('201 + coerce string ke number', async () => {
    const res = await request(app).post('/api/products').set(auth()).send({
      name: 'Coerced product',
      sku: 'COE-1',
      price: '15000',
      harga_modal: '8000',
      stock: '5',
      is_favorit: 'true',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf('number');
    expect(res.body.price).toBe(15000);
    expect(res.body.harga_modal).toBe(8000);
    expect(res.body.stock).toBe(5);
    expect(res.body.is_favorit).toBe(1);
  });

  it('400 kalau SKU duplicate', async () => {
    await request(app)
      .post('/api/products')
      .set(auth())
      .send({ name: 'Dup A', sku: 'DUP-1', price: 100 });
    const res = await request(app)
      .post('/api/products')
      .set(auth())
      .send({ name: 'Dup B', sku: 'DUP-1', price: 200 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SKU/i);
  });
});

describe('PUT /api/products/:id', () => {
  let createdId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth())
      .send({ name: 'To update', sku: 'UPD-1', price: 1000 });
    createdId = res.body.id;
  });

  it('200 update dengan full payload', async () => {
    // Catatan: PUT current behavior overwrite semua kolom (pre-existing).
    // Untuk partial update tanpa overwrite, perlu PATCH endpoint (out of scope P0-05).
    const res = await request(app)
      .put(`/api/products/${createdId}`)
      .set(auth())
      .send({ name: 'Updated name', sku: 'UPD-1', price: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated name');
    expect(res.body.price).toBe(2000);
  });

  it('400 kalau price diubah ke negatif', async () => {
    const res = await request(app)
      .put(`/api/products/${createdId}`)
      .set(auth())
      .send({ price: -1 });
    expect(res.status).toBe(400);
  });
});
