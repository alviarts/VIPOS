import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let adminToken;
let categoryId;
let productAId;
let productBId;
let customerId;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

function auth() {
  return { Authorization: `Bearer ${adminToken}` };
}

async function createCategory(name = 'B2B Cat') {
  const res = await request(app).post('/api/categories').set(auth()).send({ name });
  return res.body.id;
}

async function createProduct(name, price, options = {}) {
  const sku = options.sku || `SKU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const res = await request(app)
    .post('/api/products')
    .set(auth())
    .send({
      name,
      sku,
      price,
      stock: options.stock ?? 100,
      category_id: options.category_id ?? categoryId,
    });
  if (!res.body.id) {
    throw new Error(`createProduct failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

async function createCustomer(name = 'PT B2B') {
  const res = await request(app).post('/api/customers').set(auth()).send({ name });
  return res.body.id;
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();
  categoryId = await createCategory();
  productAId = await createProduct('Office Chair', 500000, { stock: 100 });
  productBId = await createProduct('Office Desk', 1500000, { stock: 50 });
  customerId = await createCustomer();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('POST /api/quotation', () => {
  it('400 kalau items kosong', async () => {
    const res = await request(app).post('/api/quotation').set(auth()).send({
      customer_name: 'Test Co',
      quote_date: '2026-05-01',
      items: [],
    });
    expect(res.status).toBe(400);
  });

  it('201 buat quotation, hitung subtotal + tax', async () => {
    const res = await request(app)
      .post('/api/quotation')
      .set(auth())
      .send({
        customer_id: customerId,
        customer_name: 'PT B2B',
        quote_date: '2026-05-01',
        valid_until: '2026-05-31',
        tax_percent: 11,
        items: [
          { product_id: productAId, product_name: 'Office Chair', qty: 2, unit_price: 500000 },
          { product_id: productBId, product_name: 'Office Desk', qty: 1, unit_price: 1500000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^QT-\d{6}-\d{4}$/);
    expect(res.body.subtotal).toBe(2500000);
    expect(res.body.tax_amount).toBe(275000);
    expect(res.body.total).toBe(2775000);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.status).toBe('DRAFT');
  });
});

describe('Quotation lifecycle', () => {
  let qid;

  it('seed quotation', async () => {
    const res = await request(app)
      .post('/api/quotation')
      .set(auth())
      .send({
        customer_id: customerId,
        customer_name: 'PT B2B',
        quote_date: '2026-05-01',
        items: [
          { product_id: productAId, product_name: 'Office Chair', qty: 5, unit_price: 500000 },
        ],
      });
    qid = res.body.id;
  });

  it('PUT update status to SENT', async () => {
    const res = await request(app)
      .put(`/api/quotation/${qid}`)
      .set(auth())
      .send({ status: 'SENT' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SENT');
  });

  it('POST convert-to-so creates sales order', async () => {
    const res = await request(app).post(`/api/quotation/${qid}/convert-to-so`).set(auth()).send({});
    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^SO-/);
    expect(res.body.quotation_id).toBe(qid);
    expect(res.body.items).toHaveLength(1);
    // Quotation should now be ACCEPTED
    const q = await request(app).get(`/api/quotation/${qid}`).set(auth());
    expect(q.body.status).toBe('ACCEPTED');
    expect(q.body.converted_so_id).toBe(res.body.id);
  });

  it('POST convert-to-so kedua kali → 400', async () => {
    const res = await request(app).post(`/api/quotation/${qid}/convert-to-so`).set(auth()).send({});
    expect(res.status).toBe(400);
  });
});

describe('Sales Order CRUD', () => {
  let soid;

  it('201 buat SO langsung (tanpa quote)', async () => {
    const res = await request(app)
      .post('/api/sales-order')
      .set(auth())
      .send({
        customer_id: customerId,
        customer_name: 'PT B2B',
        order_date: '2026-05-02',
        expected_delivery: '2026-05-10',
        items: [
          { product_id: productAId, product_name: 'Office Chair', qty: 4, unit_price: 500000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^SO-/);
    expect(res.body.status).toBe('NEW');
    soid = res.body.id;
  });

  it('GET list filter by status', async () => {
    const res = await request(app).get('/api/sales-order?status=NEW').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.every((s) => s.status === 'NEW')).toBe(true);
  });

  it('GET single returns items', async () => {
    const res = await request(app).get(`/api/sales-order/${soid}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});

describe('Delivery Order flow + stock posting', () => {
  let soid;
  let soItemId;
  let initialStock;

  it('seed SO dengan 10 items', async () => {
    initialStock = (await request(app).get(`/api/products/${productAId}`).set(auth())).body.stock;
    const res = await request(app)
      .post('/api/sales-order')
      .set(auth())
      .send({
        customer_id: customerId,
        customer_name: 'PT B2B',
        order_date: '2026-05-03',
        items: [
          { product_id: productAId, product_name: 'Office Chair', qty: 10, unit_price: 500000 },
        ],
      });
    soid = res.body.id;
    soItemId = res.body.items[0].id;
  });

  it('201 buat DO partial 4 dari 10, status PREPARING (stock belum dikurangi)', async () => {
    const res = await request(app)
      .post('/api/delivery-order')
      .set(auth())
      .send({
        sales_order_id: soid,
        delivery_date: '2026-05-04',
        items: [
          {
            sales_order_item_id: soItemId,
            product_id: productAId,
            product_name: 'Office Chair',
            qty: 4,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PREPARING');
    expect(res.body.stock_posted).toBe(0);

    // Stock belum berubah
    const prod = await request(app).get(`/api/products/${productAId}`).set(auth());
    expect(prod.body.stock).toBe(initialStock);

    // SO sudah PARTIAL karena ada qty_delivered
    const so = await request(app).get(`/api/sales-order/${soid}`).set(auth());
    expect(so.body.status).toBe('PARTIAL');
    expect(Number(so.body.items[0].qty_delivered)).toBe(4);
  });

  it('PUT DO ke DELIVERED → stock berkurang & stock_posted = 1', async () => {
    const list = await request(app).get(`/api/delivery-order?sales_order_id=${soid}`).set(auth());
    const doid = list.body[0].id;
    const res = await request(app)
      .put(`/api/delivery-order/${doid}`)
      .set(auth())
      .send({ status: 'DELIVERED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DELIVERED');
    expect(res.body.stock_posted).toBe(1);

    const prod = await request(app).get(`/api/products/${productAId}`).set(auth());
    expect(prod.body.stock).toBe(initialStock - 4);
  });

  it('POST DO sisa 6 dengan status DELIVERED langsung → SO FULFILLED', async () => {
    const res = await request(app)
      .post('/api/delivery-order')
      .set(auth())
      .send({
        sales_order_id: soid,
        delivery_date: '2026-05-05',
        status: 'DELIVERED',
        items: [
          {
            sales_order_item_id: soItemId,
            product_id: productAId,
            product_name: 'Office Chair',
            qty: 6,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DELIVERED');

    const so = await request(app).get(`/api/sales-order/${soid}`).set(auth());
    expect(so.body.status).toBe('FULFILLED');
    expect(Number(so.body.items[0].qty_delivered)).toBe(10);
  });
});

describe('Invoice + Receipt flow', () => {
  let invid;

  it('201 buat invoice dengan down_payment', async () => {
    const res = await request(app)
      .post('/api/invoice')
      .set(auth())
      .send({
        customer_id: customerId,
        customer_name: 'PT B2B',
        invoice_date: '2026-05-10',
        due_date: '2026-06-09',
        tax_percent: 11,
        down_payment: 500000,
        items: [
          { product_id: productAId, product_name: 'Office Chair', qty: 2, unit_price: 500000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^INV-/);
    expect(res.body.subtotal).toBe(1000000);
    expect(res.body.total).toBe(1110000);
    expect(res.body.outstanding).toBe(610000);
    expect(res.body.status).toBe('PARTIAL');
    invid = res.body.id;
  });

  it('POST receipt → reduces outstanding', async () => {
    const res = await request(app).post('/api/receipt').set(auth()).send({
      invoice_id: invid,
      payment_date: '2026-05-15',
      method: 'transfer',
      amount: 300000,
    });
    expect(res.status).toBe(201);
    expect(res.body.number).toMatch(/^RCP-/);

    const inv = await request(app).get(`/api/invoice/${invid}`).set(auth());
    expect(inv.body.paid_amount).toBe(800000);
    expect(inv.body.outstanding).toBe(310000);
    expect(inv.body.status).toBe('PARTIAL');
  });

  it('POST receipt sisa → invoice PAID', async () => {
    const res = await request(app).post('/api/receipt').set(auth()).send({
      invoice_id: invid,
      payment_date: '2026-05-20',
      method: 'cash',
      amount: 310000,
    });
    expect(res.status).toBe(201);

    const inv = await request(app).get(`/api/invoice/${invid}`).set(auth());
    expect(inv.body.outstanding).toBe(0);
    expect(inv.body.status).toBe('PAID');
  });

  it('DELETE invoice with receipts → soft-void', async () => {
    const res = await request(app).delete(`/api/invoice/${invid}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.voided).toBe(true);

    const inv = await request(app).get(`/api/invoice/${invid}`).set(auth());
    expect(inv.body.status).toBe('VOID');
  });

  it('POST receipt to VOID invoice → 400', async () => {
    const res = await request(app).post('/api/receipt').set(auth()).send({
      invoice_id: invid,
      payment_date: '2026-05-21',
      method: 'cash',
      amount: 1000,
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/aging-report', () => {
  it('200 returns rows + totals', async () => {
    // Seed an invoice with overdue date (past)
    await request(app)
      .post('/api/invoice')
      .set(auth())
      .send({
        customer_id: customerId,
        customer_name: 'PT B2B',
        invoice_date: '2025-01-01',
        due_date: '2025-01-31',
        items: [
          { product_id: productAId, product_name: 'Office Chair', qty: 1, unit_price: 100000 },
        ],
      });
    const res = await request(app).get('/api/aging-report').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.rows).toBeInstanceOf(Array);
    expect(res.body.totals).toBeDefined();
    expect(res.body.totals.total_outstanding).toBeGreaterThan(0);
    // Old invoice should be in 90+ bucket
    expect(res.body.totals.bucket_90_plus).toBeGreaterThan(0);
  });
});
