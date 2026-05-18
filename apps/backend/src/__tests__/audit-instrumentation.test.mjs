// P2-03 PR-B audit instrumentation tests.
//
// Verifies that each instrumented mutation endpoint actually writes an
// audit_logs row with the correct entity / action / before / after.
// Audit is fire-and-await but errors are swallowed (safeLogAudit), so we
// assert against the actual row in the DB rather than just the API response.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let queryFn;
let runAsSystem;
let adminToken;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  expect(res.status).toBe(200);
  return res.body.token;
}

async function latestAudit({ entity, entity_id, action }) {
  // Read with system bypass so RLS doesn't hide the row from us.
  const r = await runAsSystem(() =>
    queryFn(
      `SELECT entity, entity_id, action, before_json, after_json, user_id, tenant_id
         FROM audit_logs
        WHERE entity = $1
          AND ($2::text IS NULL OR entity_id = $2)
          AND ($3::text IS NULL OR action = $3)
        ORDER BY id DESC
        LIMIT 1`,
      [entity, entity_id != null ? String(entity_id) : null, action ?? null]
    )
  );
  return r.rows[0] || null;
}

async function countAudit({ entity, action }) {
  const r = await runAsSystem(() =>
    queryFn(`SELECT COUNT(*)::int AS c FROM audit_logs WHERE entity = $1 AND action = $2`, [
      entity,
      action,
    ])
  );
  return r.rows[0].c;
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  adminToken = await login();
});

afterAll(async () => {
  await teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });

describe('products instrumentation', () => {
  let createdId;

  it('POST /api/products writes entity=product action=create with after', async () => {
    const res = await request(app).post('/api/products').set(auth()).send({
      name: 'Audit Test Coffee',
      sku: 'AUDIT-CFE-1',
      price: 25000,
      stock: 10,
    });
    expect(res.status).toBe(201);
    createdId = res.body.id;
    const row = await latestAudit({ entity: 'product', entity_id: createdId, action: 'create' });
    expect(row).toBeTruthy();
    expect(row.before_json).toBeNull();
    expect(row.after_json?.name).toBe('Audit Test Coffee');
    expect(row.after_json?.sku).toBe('AUDIT-CFE-1');
    expect(row.user_id).toBeTruthy();
  });

  it('PUT /api/products/:id writes entity=product action=update with before+after', async () => {
    const res = await request(app)
      .put(`/api/products/${createdId}`)
      .set(auth())
      .send({ name: 'Audit Test Coffee X', price: 30000 });
    expect(res.status).toBe(200);
    const row = await latestAudit({ entity: 'product', entity_id: createdId, action: 'update' });
    expect(row).toBeTruthy();
    expect(row.before_json?.name).toBe('Audit Test Coffee');
    expect(row.after_json?.name).toBe('Audit Test Coffee X');
    expect(Number(row.after_json?.price)).toBe(30000);
  });

  it('DELETE /api/products/:id (no transactions) writes action=delete with before only', async () => {
    // Fresh product with no transactions/movements -> hard delete path.
    const created = await request(app).post('/api/products').set(auth()).send({
      name: 'Disposable',
      sku: 'AUDIT-DISP-1',
      price: 1000,
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const res = await request(app).delete(`/api/products/${id}`).set(auth());
    expect(res.status).toBe(200);
    const row = await latestAudit({ entity: 'product', entity_id: id, action: 'delete' });
    expect(row).toBeTruthy();
    expect(row.before_json?.sku).toBe('AUDIT-DISP-1');
    expect(row.after_json).toBeNull();
  });
});

describe('customers instrumentation', () => {
  let id;

  it('POST /api/customers writes action=create', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set(auth())
      .send({ name: 'Pelanggan Audit', phone: '0811000111' });
    expect(res.status).toBe(201);
    id = res.body.id;
    const row = await latestAudit({ entity: 'customer', entity_id: id, action: 'create' });
    expect(row).toBeTruthy();
    expect(row.after_json?.name).toBe('Pelanggan Audit');
  });

  it('PUT /api/customers/:id writes action=update with before+after', async () => {
    const res = await request(app)
      .put(`/api/customers/${id}`)
      .set(auth())
      .send({ name: 'Pelanggan Audit Edited' });
    expect(res.status).toBe(200);
    const row = await latestAudit({ entity: 'customer', entity_id: id, action: 'update' });
    expect(row.before_json?.name).toBe('Pelanggan Audit');
    expect(row.after_json?.name).toBe('Pelanggan Audit Edited');
  });

  it('DELETE /api/customers/:id (no transactions) writes action=delete', async () => {
    const before = await countAudit({ entity: 'customer', action: 'delete' });
    const res = await request(app).delete(`/api/customers/${id}`).set(auth());
    expect(res.status).toBe(200);
    const after = await countAudit({ entity: 'customer', action: 'delete' });
    expect(after).toBe(before + 1);
    const row = await latestAudit({ entity: 'customer', entity_id: id, action: 'delete' });
    expect(row.before_json?.name).toBe('Pelanggan Audit Edited');
  });
});

describe('inventory instrumentation', () => {
  it('POST /api/inventory/movements writes action=create with before+after', async () => {
    const product = await request(app).post('/api/products').set(auth()).send({
      name: 'Stocked',
      sku: 'AUDIT-STOCK-1',
      price: 5000,
      stock: 5,
    });
    const productId = product.body.id;
    const res = await request(app)
      .post('/api/inventory/movements')
      .set(auth())
      .send({ product_id: productId, tipe: 'stok_in', qty: 3, keterangan: 'audit test' });
    expect(res.status).toBe(201);
    const row = await latestAudit({
      entity: 'inventory_movement',
      entity_id: res.body.id,
      action: 'create',
    });
    expect(row).toBeTruthy();
    expect(row.before_json?.stock).toBe(5);
    expect(row.after_json?.stock_after).toBe(8);
    expect(row.after_json?.tipe).toBe('stok_in');
  });
});

describe('transactions void instrumentation', () => {
  it('POST /api/transactions/:id/void writes action=void with before+after', async () => {
    const product = await request(app).post('/api/products').set(auth()).send({
      name: 'Void Item',
      sku: 'AUDIT-VOID-1',
      price: 10000,
      stock: 5,
    });
    const tx = await request(app)
      .post('/api/transactions')
      .set(auth())
      .send({
        items: [{ product_id: product.body.id, price: 10000, quantity: 1 }],
        payment_amount: 10000,
        payment_method: 'cash',
      });
    expect(tx.status).toBe(201);
    const txId = tx.body.id;
    const v = await request(app).post(`/api/transactions/${txId}/void`).set(auth());
    expect(v.status).toBe(200);
    const row = await latestAudit({ entity: 'transaction', entity_id: txId, action: 'void' });
    expect(row).toBeTruthy();
    expect(row.before_json?.status).toBe('completed');
    expect(row.after_json?.status).toBe('voided');
    expect(Array.isArray(row.before_json?.items)).toBe(true);
  });
});

describe('finance cash account / transaction instrumentation', () => {
  let accountId;
  it('POST /api/finance/accounts writes action=create', async () => {
    const res = await request(app)
      .post('/api/finance/accounts')
      .set(auth())
      .send({ kode: 'KAS-AUDIT', nama: 'Kas Audit', kategori: 'Kas & Bank', saldo_awal: 0 });
    expect(res.status).toBe(201);
    accountId = res.body.id;
    const row = await latestAudit({
      entity: 'cash_account',
      entity_id: accountId,
      action: 'create',
    });
    expect(row.after_json?.kode).toBe('KAS-AUDIT');
  });

  it('PUT /api/finance/accounts/:id writes action=update', async () => {
    const res = await request(app)
      .put(`/api/finance/accounts/${accountId}`)
      .set(auth())
      .send({ nama: 'Kas Audit Edited' });
    expect(res.status).toBe(200);
    const row = await latestAudit({
      entity: 'cash_account',
      entity_id: accountId,
      action: 'update',
    });
    expect(row.before_json?.nama).toBe('Kas Audit');
    expect(row.after_json?.nama).toBe('Kas Audit Edited');
  });

  it('POST /api/finance/transactions writes action=create', async () => {
    const res = await request(app).post('/api/finance/transactions').set(auth()).send({
      tipe: 'pemasukan',
      account_id: accountId,
      jumlah: 50000,
      keterangan: 'Audit pemasukan',
    });
    expect(res.status).toBe(201);
    const txId = res.body.id;
    const row = await latestAudit({
      entity: 'cash_transaction',
      entity_id: txId,
      action: 'create',
    });
    expect(row.after_json?.tipe).toBe('pemasukan');
    expect(Number(row.after_json?.jumlah)).toBe(50000);
  });

  it('DELETE /api/finance/accounts/:id (no transactions yet) writes action=delete or update', async () => {
    // We have a cash_transaction tied to accountId already, so this hits the
    // soft-delete branch (UPDATE is_active=0) and audits as update.
    const res = await request(app).delete(`/api/finance/accounts/${accountId}`).set(auth());
    expect(res.status).toBe(200);
    // Either action is acceptable depending on whether the account has
    // transactions; we asserted soft-delete here because we created one.
    const row = await latestAudit({
      entity: 'cash_account',
      entity_id: accountId,
      action: 'update',
    });
    expect(row.after_json?.is_active).toBe(0);
  });
});

describe('settings instrumentation', () => {
  it('POST /api/outlet writes action=create on outlet', async () => {
    const res = await request(app)
      .post('/api/outlet')
      .set(auth())
      .send({ name: 'Cabang Audit', code: 'OUT-AUDIT' });
    expect(res.status).toBe(201);
    const id = res.body.id;
    const row = await latestAudit({ entity: 'outlet', entity_id: id, action: 'create' });
    expect(row.after_json?.name).toBe('Cabang Audit');
  });

  it('POST /api/payment-method writes action=create', async () => {
    const res = await request(app)
      .post('/api/payment-method')
      .set(auth())
      .send({ name: 'QRIS Audit', type: 'qris' });
    expect(res.status).toBe(201);
    const id = res.body.id;
    const row = await latestAudit({ entity: 'payment_method', entity_id: id, action: 'create' });
    expect(row.after_json?.name).toBe('QRIS Audit');
    expect(row.after_json?.type).toBe('qris');
  });

  it('POST /api/tax-rate writes action=create', async () => {
    const res = await request(app)
      .post('/api/tax-rate')
      .set(auth())
      .send({ name: 'PPN 11 Audit', rate: 11, is_inclusive: false });
    expect(res.status).toBe(201);
    const id = res.body.id;
    const row = await latestAudit({ entity: 'tax_rate', entity_id: id, action: 'create' });
    expect(row.after_json?.name).toBe('PPN 11 Audit');
    expect(Number(row.after_json?.rate)).toBe(11);
  });
});

describe('employee + permissions instrumentation', () => {
  let empId;

  it('POST /api/employee writes action=create on employee', async () => {
    const res = await request(app)
      .post('/api/employee')
      .set(auth())
      .send({ name: 'Karyawan Audit', phone: '0811222333', position: 'kasir' });
    expect(res.status).toBe(201);
    empId = res.body.id;
    const row = await latestAudit({ entity: 'employee', entity_id: empId, action: 'create' });
    expect(row.after_json?.name).toBe('Karyawan Audit');
  });

  it('PUT /api/employee/:id writes action=update with before+after', async () => {
    const res = await request(app)
      .put(`/api/employee/${empId}`)
      .set(auth())
      .send({ name: 'Karyawan Audit Edited' });
    expect(res.status).toBe(200);
    const row = await latestAudit({ entity: 'employee', entity_id: empId, action: 'update' });
    expect(row.before_json?.name).toBe('Karyawan Audit');
    expect(row.after_json?.name).toBe('Karyawan Audit Edited');
  });

  it('PUT /api/employee/:id/permissions writes action=permission_change', async () => {
    const res = await request(app)
      .put(`/api/employee/${empId}/permissions`)
      .set(auth())
      .send({
        permissions: [
          { permission_key: 'pos.refund', granted: true },
          { permission_key: 'pos.discount', granted: false },
        ],
      });
    expect(res.status).toBe(200);
    const row = await latestAudit({
      entity: 'employee_permission',
      entity_id: empId,
      action: 'permission_change',
    });
    expect(row).toBeTruthy();
    expect(Array.isArray(row.before_json)).toBe(true);
    expect(Array.isArray(row.after_json)).toBe(true);
    expect(row.after_json.length).toBe(2);
  });

  it('DELETE /api/employee/:id (default soft) writes action=update', async () => {
    const res = await request(app).delete(`/api/employee/${empId}`).set(auth());
    expect(res.status).toBe(200);
    const row = await latestAudit({ entity: 'employee', entity_id: empId, action: 'update' });
    expect(row.after_json?.status).toBe('resigned');
  });
});
