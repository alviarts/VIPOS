// Integration tests for online order endpoints (P4-01).
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

async function createOnlineOrder(channel = 'GOFOOD', orderType = 'delivery') {
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

  // Create online order
  const orderRes = await request(app)
    .post('/api/v1/online-order')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      channel,
      order_type: orderType,
      customer_name: 'Test Customer',
      customer_phone: '081234567890',
      customer_address: 'Test Address',
      items: [{ product_id: productId, product_name: 'Test Product', qty: 2, price: 10000 }],
      payment_method: 'COD',
      payment_status: 'unpaid',
    });

  expect(orderRes.status).toBe(201);
  return orderRes.body.id;
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

describe('GET /api/v1/online-order', () => {
  it('200 returns online order list', async () => {
    await createOnlineOrder('GOFOOD');
    await createOnlineOrder('GRABFOOD');

    const res = await request(app)
      .get('/api/v1/online-order')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('200 filters by status', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    // Accept the order to change status
    await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .get('/api/v1/online-order?status=PREPARING')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.some((order) => order.status === 'PREPARING')).toBe(true);
  });

  it('200 filters by channel', async () => {
    await createOnlineOrder('GOFOOD');
    await createOnlineOrder('GRABFOOD');

    const res = await request(app)
      .get('/api/v1/online-order?channel=GOFOOD')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.every((order) => order.channel === 'GOFOOD')).toBe(true);
  });

  it('401 without authentication', async () => {
    const res = await request(app).get('/api/v1/online-order');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/online-order/:id', () => {
  it('200 returns order detail with items', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    const res = await request(app)
      .get(`/api/v1/online-order/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', orderId);
    expect(res.body).toHaveProperty('ref_no');
    expect(res.body).toHaveProperty('channel');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/v1/online-order/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/online-order/:id/accept', () => {
  it('200 accepts NEW order and changes status to PREPARING', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PREPARING');
    expect(res.body.accepted_at).toBeTruthy();
  });

  it('400 for already accepted order', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    // First accept
    await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Second accept should fail
    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/online-order/:id/reject', () => {
  it('200 rejects NEW order', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Out of stock' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.reject_reason).toBe('Out of stock');
  });
});

describe('POST /api/v1/online-order/:id/ready', () => {
  it('200 marks PREPARING order as READY', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    // Accept first
    await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Mark ready
    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.ready_at).toBeTruthy();
  });

  it('400 for NEW order (must accept first)', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/online-order/:id/complete', () => {
  it('200 completes READY order', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    // Accept
    await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Mark ready
    await request(app)
      .post(`/api/v1/online-order/${orderId}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Complete
    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completed_at).toBeTruthy();
  });
});

describe('POST /api/v1/online-order/:id/cancel', () => {
  it('200 cancels order with reason', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer requested cancellation' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancel_reason).toBe('Customer requested cancellation');
    expect(res.body.cancelled_at).toBeTruthy();
  });

  it('400 for already completed order', async () => {
    const orderId = await createOnlineOrder('GOFOOD');

    // Complete the order
    await request(app)
      .post(`/api/v1/online-order/${orderId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/v1/online-order/${orderId}/ready`)
      .set('Authorization', `Bearer ${adminToken}`);
    await request(app)
      .post(`/api/v1/online-order/${orderId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try to cancel
    const res = await request(app)
      .post(`/api/v1/online-order/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test' });

    expect(res.status).toBe(400);
  });
});
