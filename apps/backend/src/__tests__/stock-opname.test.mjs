import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;
let productAId;
let productBId;
let productCId;

beforeAll(async () => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = login.body.token;

  const a = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send({
    name: 'Opname A',
    sku: 'OP-A',
    price: 10000,
    stock: 20,
    monitor_stok: 1,
  });
  productAId = a.body.id;

  const b = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send({
    name: 'Opname B',
    sku: 'OP-B',
    price: 5000,
    stock: 5,
    monitor_stok: 1,
  });
  productBId = b.body.id;

  // Product without monitor_stok — should not appear in default opname.
  const c = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send({
    name: 'Opname C',
    sku: 'OP-C',
    price: 1000,
    stock: 3,
    monitor_stok: 0,
  });
  productCId = c.body.id;
});

afterAll(() => {
  teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Stock opname lifecycle', () => {
  let opnameId;

  it('POST /api/stock-opname: creates draft snapshotting all monitor_stok products', async () => {
    const res = await request(app)
      .post('/api/stock-opname')
      .set(auth())
      .send({ catatan: 'Cek bulanan' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.kode).toMatch(/^OP-\d{8}-\d{3}$/);
    expect(res.body.items.length).toBe(2);
    const ids = res.body.items.map((i) => i.product_id).sort();
    expect(ids).toEqual([productAId, productBId].sort());
    const aRow = res.body.items.find((i) => i.product_id === productAId);
    expect(aRow.qty_sistem).toBe(20);
    expect(aRow.qty_fisik).toBeNull();
    opnameId = res.body.id;
  });

  it('POST with explicit product_ids includes non-monitor products', async () => {
    const res = await request(app)
      .post('/api/stock-opname')
      .set(auth())
      .send({ product_ids: [productCId] });
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].product_id).toBe(productCId);
    // Cleanup so it doesn't pollute subsequent listing assertions
    const del = await request(app).delete(`/api/stock-opname/${res.body.id}`).set(auth());
    expect(del.status).toBe(204);
  });

  it('GET /api/stock-opname returns the draft', async () => {
    const res = await request(app).get('/api/stock-opname').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].status).toBe('draft');
    expect(res.body[0].item_count).toBe(2);
  });

  it('GET /api/stock-opname/:id returns detail with items', async () => {
    const res = await request(app).get(`/api/stock-opname/${opnameId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
  });

  it('PUT /api/stock-opname/:id: updates qty_fisik (with variance)', async () => {
    const res = await request(app)
      .put(`/api/stock-opname/${opnameId}`)
      .set(auth())
      .send({
        items: [
          { product_id: productAId, qty_fisik: 18 }, // -2 selisih
          { product_id: productBId, qty_fisik: 5 }, // 0 selisih
        ],
      });
    expect(res.status).toBe(200);
    const aRow = res.body.items.find((i) => i.product_id === productAId);
    expect(aRow.qty_fisik).toBe(18);
    expect(aRow.selisih).toBe(-2);
    expect(res.body.counted_count).toBe(2);
    expect(res.body.variance_count).toBe(1);
  });

  it('POST /api/stock-opname/:id/finalize: posts movements + locks', async () => {
    const res = await request(app)
      .post(`/api/stock-opname/${opnameId}/finalize`)
      .set(auth())
      .send({ confirm: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('final');
    expect(res.body.finalized_at).toBeTruthy();

    // Product A stock should be 18 (was 20, opname 18).
    const prodA = await request(app).get(`/api/products/${productAId}`).set(auth());
    expect(prodA.body.stock).toBe(18);

    // Product B stock should still be 5 (no variance, no movement posted).
    const prodB = await request(app).get(`/api/products/${productBId}`).set(auth());
    expect(prodB.body.stock).toBe(5);

    // Movement should be linked via ref_type=stock_opname / ref_id.
    const mv = await request(app).get(`/api/inventory/movements/${productAId}`).set(auth());
    expect(mv.status).toBe(200);
    const opMov = mv.body.find((m) => m.ref_type === 'stock_opname' && m.ref_id === opnameId);
    expect(opMov).toBeTruthy();
    expect(opMov.qty).toBe(18);
    expect(opMov.stok_sebelum).toBe(20);
    expect(opMov.stok_sesudah).toBe(18);
  });

  it('PUT after finalize is rejected', async () => {
    const res = await request(app)
      .put(`/api/stock-opname/${opnameId}`)
      .set(auth())
      .send({ items: [{ product_id: productAId, qty_fisik: 100 }] });
    expect(res.status).toBe(400);
  });

  it('Re-finalize is rejected', async () => {
    const res = await request(app)
      .post(`/api/stock-opname/${opnameId}/finalize`)
      .set(auth())
      .send({ confirm: true });
    expect(res.status).toBe(400);
  });

  it('DELETE on final is rejected', async () => {
    const res = await request(app).delete(`/api/stock-opname/${opnameId}`).set(auth());
    expect(res.status).toBe(400);
  });

  it('Finalize without any qty_fisik returns 400', async () => {
    const draft = await request(app).post('/api/stock-opname').set(auth()).send({});
    expect(draft.status).toBe(201);
    const res = await request(app)
      .post(`/api/stock-opname/${draft.body.id}/finalize`)
      .set(auth())
      .send({ confirm: true });
    expect(res.status).toBe(400);
    // Cleanup.
    await request(app).delete(`/api/stock-opname/${draft.body.id}`).set(auth());
  });
});

describe('Inventory movement enrichment', () => {
  it('stok_in with unit_cost updates harga_modal (weighted average)', async () => {
    const create = await request(app).post('/api/products').set(auth()).send({
      name: 'COGS Avg',
      sku: 'AVG-1',
      price: 10000,
      stock: 0,
      harga_modal: 0,
    });
    const pid = create.body.id;

    // First buy: 10 @ 1000 → avg = 1000
    let mv = await request(app)
      .post('/api/inventory/movements')
      .set(auth())
      .send({ product_id: pid, tipe: 'stok_in', qty: 10, unit_cost: 1000 });
    expect(mv.status).toBe(201);
    let prod = await request(app).get(`/api/products/${pid}`).set(auth());
    expect(prod.body.harga_modal).toBeCloseTo(1000, 2);
    expect(prod.body.stock).toBe(10);

    // Second buy: 10 @ 1500 → avg = (10*1000 + 10*1500)/20 = 1250
    mv = await request(app)
      .post('/api/inventory/movements')
      .set(auth())
      .send({ product_id: pid, tipe: 'stok_in', qty: 10, unit_cost: 1500 });
    expect(mv.status).toBe(201);
    prod = await request(app).get(`/api/products/${pid}`).set(auth());
    expect(prod.body.harga_modal).toBeCloseTo(1250, 2);
    expect(prod.body.stock).toBe(20);
  });

  it('GET /api/inventory/movements/:product_id returns history', async () => {
    const res = await request(app).get(`/api/inventory/movements/${productAId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('product_name');
  });

  it('stok_out with reason persists', async () => {
    const create = await request(app)
      .post('/api/products')
      .set(auth())
      .send({ name: 'Waste Test', sku: 'W-1', price: 1000, stock: 5 });
    const pid = create.body.id;
    const mv = await request(app).post('/api/inventory/movements').set(auth()).send({
      product_id: pid,
      tipe: 'stok_out',
      qty: 2,
      reason: 'damaged',
      keterangan: 'Pecah waktu loading',
    });
    expect(mv.status).toBe(201);
    expect(mv.body.reason).toBe('damaged');
    expect(mv.body.stok_sesudah).toBe(3);
  });
});
