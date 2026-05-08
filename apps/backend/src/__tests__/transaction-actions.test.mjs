// Integration tests for transaction void/refund/reprint (P4-10).
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
  expect(res.status).toBe(200);
  return res.body.token;
}

async function createTransaction() {
  // Get first product from seed data
  const prodListRes = await request(app)
    .get('/api/v1/products?page=1&per_page=1')
    .set('Authorization', `Bearer ${adminToken}`);

  let productId;
  if (prodListRes.body.data && prodListRes.body.data.length > 0) {
    productId = prodListRes.body.data[0].id;
  } else {
    // Create a product if none exist
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Product', price: 10000, stock: 100, sku: `TST-${Date.now()}` });
    productId = prodRes.body.id;
  }

  // Ensure stock is sufficient
  const { query, runAsSystem } = require('../db');
  await runAsSystem(() =>
    query(`UPDATE products SET stock = 100 WHERE id = $1`, [productId]),
  );

  // Create transaction
  const txRes = await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      items: [{ product_id: productId, price: 10000, quantity: 2 }],
      payment_amount: 20000,
      payment_method: 'CASH',
    });
  expect(txRes.status).toBe(201);
  return { transactionId: txRes.body.id, productId };
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('POST /api/v1/transactions/:id/void', () => {
  it('200 voids a transaction and restores stock', async () => {
    const { transactionId, productId } = await createTransaction();

    const res = await request(app)
      .post(`/api/v1/transactions/${transactionId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer changed mind' });
    expect(res.status).toBe(200);
    expect(res.body.voided).toBe(true);
    expect(res.body.transaction.status).toBe('voided');

    // Verify stock restored
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.body.stock).toBe(100); // restored from 98
  });

  it('409 when already voided', async () => {
    const { transactionId } = await createTransaction();

    await request(app)
      .post(`/api/v1/transactions/${transactionId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'First void' });

    const res = await request(app)
      .post(`/api/v1/transactions/${transactionId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Second void' });
    expect(res.status).toBe(409);
  });

  it('400 when reason is missing', async () => {
    const { transactionId } = await createTransaction();

    const res = await request(app)
      .post(`/api/v1/transactions/${transactionId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('404 for non-existent transaction', async () => {
    const res = await request(app)
      .post('/api/v1/transactions/999999/void')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'test' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/transactions/:id/refund', () => {
  it('201 partial refund', async () => {
    const { transactionId, productId } = await createTransaction();

    const res = await request(app)
      .post(`/api/v1/transactions/${transactionId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ product_id: productId, quantity: 1 }],
        reason: 'Defective item',
      });
    expect(res.status).toBe(201);
    expect(res.body.refund.refund_amount).toBe(10000);
    expect(res.body.refund.items_refunded).toBe(1);
  });

  it('400 when items is empty', async () => {
    const { transactionId } = await createTransaction();

    const res = await request(app)
      .post(`/api/v1/transactions/${transactionId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [], reason: 'test' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/transactions/:id/receipt', () => {
  it('200 returns receipt data', async () => {
    const { transactionId } = await createTransaction();

    const res = await request(app)
      .get(`/api/v1/transactions/${transactionId}/receipt`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.invoice_number).toBeDefined();
    expect(res.body.receipt.items).toBeDefined();
    expect(res.body.receipt.items.length).toBeGreaterThan(0);
  });

  it('404 for non-existent transaction', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/999999/receipt')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
