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
let employeeUserId;
let transactionId;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

async function createCategory() {
  const res = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Spa Service' });
  return res.body.id;
}

async function createProduct(name, price, options = {}) {
  const sku = options.sku || `SKU-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      sku,
      price,
      stock: 100,
      category_id: options.category_id ?? categoryId,
    });
  if (!res.body.id) {
    throw new Error(`createProduct(${name}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id;
}

async function createEmployeeUser() {
  // Seed an employee user via direct DB insert for tests (no admin endpoint for users yet).
  const { query, runWithTenant } = require('../db');
  const bcrypt = require('bcryptjs');
  const hashed = bcrypt.hashSync('test123', 10);
  return runWithTenant(1, async () => {
    const r = await query(
      `INSERT INTO users (username, password, name, role, tenant_id)
       VALUES ($1, $2, $3, $4, 1) RETURNING id`,
      ['staff_test', hashed, 'Staff Test', 'cashier']
    );
    return r.rows[0].id;
  });
}

async function createTransaction(items) {
  // Insert transaction directly to control items. Direct query() in tests runs
  // outside a request scope so we explicitly bind the default tenant via
  // runWithTenant() — same context the authenticateToken middleware would set.
  const { query, runWithTenant } = require('../db');
  return runWithTenant(1, async () => {
    const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const txnRes = await query(
      `INSERT INTO transactions (invoice_number, user_id, total_amount, payment_amount, change_amount)
       VALUES ($1, 1, $2, $3, 0) RETURNING id`,
      [`TEST-${Date.now()}`, total, total]
    );
    const id = txnRes.rows[0].id;
    for (const item of items) {
      await query(
        `INSERT INTO transaction_items (transaction_id, product_id, product_name, price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          item.product_id,
          item.product_name,
          item.price,
          item.quantity,
          item.price * item.quantity,
        ]
      );
    }
    return id;
  });
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();
  categoryId = await createCategory();
  productAId = await createProduct('Massage 60min', 200000);
  productBId = await createProduct('Facial', 150000);
  employeeUserId = await createEmployeeUser();
  transactionId = await createTransaction([
    { product_id: productAId, product_name: 'Massage 60min', price: 200000, quantity: 2 },
    { product_id: productBId, product_name: 'Facial', price: 150000, quantity: 1 },
  ]);
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('POST /api/commission-group', () => {
  it('201 buat FIXED amount per transaksi', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bonus Booking',
        type: 'FIXED',
        amount: 5000,
        amount_basis: 'PER_TRANSACTION',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Bonus Booking',
      type: 'FIXED',
      amount: 5000,
      amount_basis: 'PER_TRANSACTION',
      applies_to_scope: 'all',
      applies_to_products_scope: 'all',
      calc_period: 'MONTH',
      is_active: true,
    });
  });

  it('201 buat FIXED amount per item', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Komisi Per Booking',
        type: 'FIXED',
        amount: 2500,
        amount_basis: 'PER_ITEM',
      });
    expect(res.status).toBe(201);
    expect(res.body.amount_basis).toBe('PER_ITEM');
  });

  it('201 buat TIERED dengan 3 tier', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Komisi Tiered',
        type: 'TIERED',
        tiers: [
          { from: 0, to: 1000000, percentage: 2 },
          { from: 1000000, to: 5000000, percentage: 3 },
          { from: 5000000, to: null, percentage: 5 },
        ],
        calc_period: 'MONTH',
      });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('TIERED');
    expect(res.body.tiers).toHaveLength(3);
    expect(res.body.tiers[2].percentage).toBe(5);
  });

  it('400 FIXED tanpa amount', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', type: 'FIXED', amount_basis: 'PER_TRANSACTION' });
    expect(res.status).toBe(400);
  });

  it('400 TIERED tanpa tier', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad', type: 'TIERED', tiers: [] });
    expect(res.status).toBe(400);
  });

  it('400 scope=roles tapi role_keys kosong', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad scope',
        type: 'FIXED',
        amount: 1000,
        applies_to_scope: 'roles',
      });
    expect(res.status).toBe(400);
  });

  it('201 scope=products dengan product ids', async () => {
    const res = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Spa Service Only',
        type: 'FIXED',
        amount: 10000,
        amount_basis: 'PER_ITEM',
        applies_to_products_scope: 'products',
        applies_to_product_ids: [productAId],
      });
    expect(res.status).toBe(201);
    expect(res.body.applies_to_product_ids).toEqual([productAId]);
  });
});

describe('GET /api/commission-group', () => {
  it('200 list dengan filter type=FIXED', async () => {
    const res = await request(app)
      .get('/api/commission-group?type=FIXED')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((g) => g.type === 'FIXED')).toBe(true);
  });
});

describe('PUT/DELETE /api/commission-group', () => {
  it('200 update name + nonaktifkan', async () => {
    const created = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Will Update', type: 'FIXED', amount: 1000 });
    const id = created.body.id;
    const res = await request(app)
      .put(`/api/commission-group/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name', is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.is_active).toBe(false);
  });

  it('404 update group tidak ada', async () => {
    const res = await request(app)
      .put('/api/commission-group/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('200 delete', async () => {
    const created = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'To Delete', type: 'FIXED', amount: 500 });
    const id = created.body.id;
    const res = await request(app)
      .delete(`/api/commission-group/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });
});

describe('POST /api/commission-assignment — auto-compute', () => {
  let fixedAllId;
  let tieredId;
  let perItemSpaId;

  it('seed groups untuk testing', async () => {
    // Reset: delete semua group existing supaya kalkulasi deterministic.
    const { query } = require('../db');
    await query('DELETE FROM commission_groups');

    const a = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bonus All', type: 'FIXED', amount: 5000, amount_basis: 'PER_TRANSACTION' });
    fixedAllId = a.body.id;

    const b = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Tiered All Months',
        type: 'TIERED',
        tiers: [
          { from: 0, to: 1000000, percentage: 2 },
          { from: 1000000, to: 5000000, percentage: 3 },
          { from: 5000000, to: null, percentage: 5 },
        ],
        calc_period: 'MONTH',
      });
    tieredId = b.body.id;

    const c = await request(app)
      .post('/api/commission-group')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Per Item Spa',
        type: 'FIXED',
        amount: 2500,
        amount_basis: 'PER_ITEM',
        applies_to_products_scope: 'products',
        applies_to_product_ids: [productAId],
      });
    perItemSpaId = c.body.id;
    expect(fixedAllId).toBeGreaterThan(0);
    expect(tieredId).toBeGreaterThan(0);
    expect(perItemSpaId).toBeGreaterThan(0);
  });

  it('201 auto-compute komisi untuk semua group qualifying', async () => {
    const res = await request(app)
      .post('/api/commission-assignment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ transaction_id: transactionId, employee_id: employeeUserId });
    expect(res.status).toBe(201);
    expect(res.body.assignments.length).toBeGreaterThanOrEqual(3);
    // FIXED PER_TRANSACTION = 5000
    const fixed = res.body.assignments.find((a) => a.commission_group_id === fixedAllId);
    expect(fixed.computed_amount).toBe(5000);
    // TIERED with basis 550000 (200k*2 + 150k*1) → tier 1 (2%) → 11000
    const tiered = res.body.assignments.find((a) => a.commission_group_id === tieredId);
    expect(tiered.basis_amount).toBe(550000);
    expect(tiered.tier_percentage).toBe(2);
    expect(tiered.computed_amount).toBe(11000);
    // PER_ITEM Spa: only Massage matches → qty=2 × 2500 = 5000
    const perItem = res.body.assignments.find((a) => a.commission_group_id === perItemSpaId);
    expect(perItem.basis_qty).toBe(2);
    expect(perItem.computed_amount).toBe(5000);
    expect(res.body.total_commission).toBe(21000);
  });

  it('404 transaction tidak ada', async () => {
    const res = await request(app)
      .post('/api/commission-assignment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ transaction_id: 999999, employee_id: employeeUserId });
    expect(res.status).toBe(404);
  });

  it('400 employee_id missing', async () => {
    const res = await request(app)
      .post('/api/commission-assignment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ transaction_id: transactionId });
    expect(res.status).toBe(400);
  });

  it('201 dengan commission_group_ids filter', async () => {
    const res = await request(app)
      .post('/api/commission-assignment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        transaction_id: transactionId,
        employee_id: employeeUserId,
        commission_group_ids: [fixedAllId],
      });
    expect(res.status).toBe(201);
    expect(res.body.assignments.length).toBe(1);
    expect(res.body.assignments[0].commission_group_id).toBe(fixedAllId);
  });
});

describe('GET /api/commission-assignment', () => {
  it('200 list filter by employee', async () => {
    const res = await request(app)
      .get(`/api/commission-assignment?employee_id=${employeeUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((a) => a.employee_id === employeeUserId)).toBe(true);
  });

  it('200 list filter by transaction', async () => {
    const res = await request(app)
      .get(`/api/commission-assignment?transaction_id=${transactionId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((a) => a.transaction_id === transactionId)).toBe(true);
  });
});

describe('DELETE /api/commission-assignment/:id', () => {
  it('200 untag', async () => {
    const list = await request(app)
      .get(`/api/commission-assignment?employee_id=${employeeUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const target = list.body.items[0];
    const res = await request(app)
      .delete(`/api/commission-assignment/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(target.id);
  });

  it('404 untag id tidak ada', async () => {
    const res = await request(app)
      .delete('/api/commission-assignment/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/commission-report', () => {
  it('200 aggregate per employee', async () => {
    const res = await request(app)
      .get('/api/commission-report')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rows');
    expect(res.body).toHaveProperty('total_commission');
    expect(res.body.rows.length).toBeGreaterThan(0);
    const row = res.body.rows[0];
    expect(row).toHaveProperty('employee_id');
    expect(row).toHaveProperty('total_commission');
    expect(row).toHaveProperty('transaction_count');
  });

  it('200 dengan group_by MONTH', async () => {
    const res = await request(app)
      .get('/api/commission-report?group_by=MONTH')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body.rows[0].period_key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('200 filter by employee_id', async () => {
    const res = await request(app)
      .get(`/api/commission-report?employee_id=${employeeUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.every((r) => r.employee_id === employeeUserId)).toBe(true);
  });
});
