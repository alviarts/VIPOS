// Integration tests for transaction history endpoints (P4-05).
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

async function createTransaction(paymentMethod = 'cash', status = 'completed') {
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
      payment_method: paymentMethod,
    });
  expect(txRes.status).toBe(201);

  // If status is void, void the transaction
  if (status === 'void') {
    await request(app)
      .post(`/api/v1/transactions/${txRes.body.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test void' });
  }

  return txRes.body.id;
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

describe('GET /api/v1/transactions', () => {
  it('200 returns paginated transaction list', async () => {
    // Create some transactions
    await createTransaction('CASH');
    await createTransaction('QRIS');

    const res = await request(app)
      .get('/api/v1/transactions?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('total_pages');
  });

  it('200 filters by status', async () => {
    // Create completed and void transactions
    await createTransaction('CASH', 'completed');
    await createTransaction('CASH', 'void');

    const res = await request(app)
      .get('/api/v1/transactions?status=void')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((tx) => tx.status === 'void')).toBe(true);
  });

  it('200 filters by date', async () => {
    await createTransaction('CASH');

    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/v1/transactions?date=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('200 filters by date range', async () => {
    await createTransaction('CASH');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const res = await request(app)
      .get(`/api/v1/transactions?start_date=${yesterday}&end_date=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('200 returns empty array when no transactions match filter', async () => {
    const futureDate = '2099-12-31';
    const res = await request(app)
      .get(`/api/v1/transactions?date=${futureDate}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('200 respects pagination limit', async () => {
    // Create multiple transactions
    for (let i = 0; i < 5; i++) {
      await createTransaction('CASH');
    }

    const res = await request(app)
      .get('/api/v1/transactions?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('401 without authentication', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/transactions/:id', () => {
  it('200 returns transaction detail with items', async () => {
    const transactionId = await createTransaction('CASH');

    const res = await request(app)
      .get(`/api/v1/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', transactionId);
    expect(res.body).toHaveProperty('invoice_number');
    expect(res.body).toHaveProperty('total_amount');
    expect(res.body).toHaveProperty('payment_amount');
    expect(res.body).toHaveProperty('change_amount');
    expect(res.body).toHaveProperty('payment_method');
    expect(res.body).toHaveProperty('cashier_name');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('404 for non-existent transaction', async () => {
    const res = await request(app)
      .get('/api/v1/transactions/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('401 without authentication', async () => {
    const transactionId = await createTransaction('CASH');
    const res = await request(app).get(`/api/v1/transactions/${transactionId}`);
    expect(res.status).toBe(401);
  });
});
