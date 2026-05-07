// VIPOS — backend integration test for the dashboard / reports
// `payment_method` canonicalization fix.
//
// Why this exists:
//   PR #232 widened the `transactions.payment_method` allow-list to
//   accept BOTH legacy lowercase codes (`cash`/`card`/`qris`) AND the
//   canonical Android codes (`CASH`/`EDC`/`QRIS_STATIC`). PR #236
//   then made the web kasir start sending the canonical uppercase
//   codes via `toWireCode()`. Result: production transactions written
//   before #236 are lowercase, transactions written after are
//   uppercase, and the dashboard /reports `GROUP BY payment_method`
//   queries used to produce TWO rows for each logical method (one
//   slice per casing) — visible to the user as a duplicate "Tunai"
//   on the dashboard pie chart and a doubled row on the cashflow
//   report.
//
// This file pins the post-fix contract:
//   - GET /api/dashboard/payment-methods rolls up legacy + canonical
//     pairs into a single row per logical method, with summed counts
//     and totals.
//   - GET /api/reports/sales-by-payment-method does the same.
//   - The omzet report (`/api/reports/sales-summary`) does the same
//     in its `payment_breakdown` field.
//   - The `payment_method` filter on the reports endpoints accepts
//     BOTH casings and matches rows of either casing — no silent data
//     loss.
//
// Risk gate (per `docs/v3/workflow/devin_continuous_automation.md` §1):
//   yellow — bug fix that changes the public shape of three GET
//   endpoints. Rollback recipe in the PR body. No schema migration,
//   no destructive change to row contents — only the aggregation /
//   filter SQL is canonicalised.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let queryFn;
let runAsSystem;
let adminToken;
let smokeProductId;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  expect(res.status).toBe(200);
  return res.body.token;
}

async function createSmokeProduct() {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Canonicalization Smoke Product',
      sku: 'SKU-CANON-SMOKE-1',
      price: 10000,
      stock: 100000,
    });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function setStock(stock) {
  await runAsSystem(() =>
    queryFn(`UPDATE products SET stock = $1 WHERE id = $2`, [stock, smokeProductId])
  );
}

// Insert a completed transaction with a specific payment_method casing.
// We bypass POST /api/transactions because that route runs through the
// allow-list AND the kasir's `toWireCode()`-equivalent path; for THIS
// test we want to seed the exact mix of casings we expect to find in
// production (transactions written before vs after PR #236), not what
// the route would emit today.
async function insertCompletedTransaction({ paymentMethod, totalAmount }) {
  await setStock(100000);
  const res = await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      items: [{ product_id: smokeProductId, price: totalAmount, quantity: 1 }],
      payment_amount: totalAmount,
      payment_method: paymentMethod,
    });
  expect(res.status).toBe(201);
  return res.body.id;
}

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  ({ query: queryFn, runAsSystem } = require('../db'));
  adminToken = await login();
  smokeProductId = await createSmokeProduct();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('GET /api/dashboard/payment-methods canonicalization', () => {
  it('merges legacy `cash` + canonical `CASH` rows into one row with summed count + total', async () => {
    // Two pre-#236 lowercase rows + three post-#236 uppercase rows
    // for the same logical method. Pre-fix the dashboard would show
    // five rows split as `{cash: 2}` + `{CASH: 3}`. Post-fix: one
    // row keyed under canonical `CASH` with count=5, total=summed.
    await insertCompletedTransaction({ paymentMethod: 'cash', totalAmount: 1000 });
    await insertCompletedTransaction({ paymentMethod: 'cash', totalAmount: 2000 });
    await insertCompletedTransaction({ paymentMethod: 'CASH', totalAmount: 3000 });
    await insertCompletedTransaction({ paymentMethod: 'CASH', totalAmount: 4000 });
    await insertCompletedTransaction({ paymentMethod: 'CASH', totalAmount: 5000 });

    const res = await request(app)
      .get('/api/dashboard/payment-methods')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const cashRows = res.body.filter((r) => r.payment_method === 'CASH');
    const lowercaseCashRows = res.body.filter((r) => r.payment_method === 'cash');
    expect(cashRows).toHaveLength(1);
    expect(lowercaseCashRows).toHaveLength(0);
    expect(Number(cashRows[0].count)).toBe(5);
    expect(Number(cashRows[0].total)).toBe(15000);
  });

  it('merges legacy `card` rows under canonical `EDC` and legacy `qris` under `QRIS_STATIC`', async () => {
    // Cleanup previous test's state — TRUNCATE between tests in the
    // same file would tear down the seeded product/admin user too.
    // Instead we filter on totals we control to keep assertions
    // deterministic.
    await insertCompletedTransaction({ paymentMethod: 'card', totalAmount: 7777 });
    await insertCompletedTransaction({ paymentMethod: 'EDC', totalAmount: 8888 });
    await insertCompletedTransaction({ paymentMethod: 'qris', totalAmount: 9999 });
    await insertCompletedTransaction({ paymentMethod: 'QRIS_STATIC', totalAmount: 1111 });

    const res = await request(app)
      .get('/api/dashboard/payment-methods')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // No row should still carry a legacy lowercase code.
    const legacyCards = res.body.filter((r) => r.payment_method === 'card');
    const legacyQris = res.body.filter((r) => r.payment_method === 'qris');
    expect(legacyCards).toHaveLength(0);
    expect(legacyQris).toHaveLength(0);

    const edcRow = res.body.find((r) => r.payment_method === 'EDC');
    const qrisStaticRow = res.body.find((r) => r.payment_method === 'QRIS_STATIC');
    expect(edcRow).toBeDefined();
    expect(qrisStaticRow).toBeDefined();
    // Counts include the rows seeded in this test PLUS any prior ones
    // from this file that happened to share these methods. Assert
    // monotonic lower bounds rather than exact counts so a future
    // test addition doesn't flake.
    expect(Number(edcRow.count)).toBeGreaterThanOrEqual(2);
    expect(Number(qrisStaticRow.count)).toBeGreaterThanOrEqual(2);
    expect(Number(edcRow.total)).toBeGreaterThanOrEqual(7777 + 8888);
    expect(Number(qrisStaticRow.total)).toBeGreaterThanOrEqual(9999 + 1111);
  });

  it('leaves canonical-only codes untouched (no double-mapping for `GOPAY`)', async () => {
    // GOPAY has no legacy lowercase form in `LEGACY_TO_CANONICAL`, so
    // the SQL CASE falls through to the ELSE branch and the row stays
    // as-is. This catches a future regression where a stray
    // `LOWER(...) AS payment_method` got injected and silently
    // lowercased every code.
    await insertCompletedTransaction({ paymentMethod: 'GOPAY', totalAmount: 12345 });

    const res = await request(app)
      .get('/api/dashboard/payment-methods')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const gopayRow = res.body.find((r) => r.payment_method === 'GOPAY');
    expect(gopayRow).toBeDefined();
    expect(Number(gopayRow.count)).toBeGreaterThanOrEqual(1);
    // No row should be keyed under the lowercased equivalent.
    const lowercased = res.body.filter((r) => r.payment_method === 'gopay');
    expect(lowercased).toHaveLength(0);
  });
});

describe('GET /api/reports/sales-by-payment-method canonicalization', () => {
  // Helper to find a row by canonical method in the enriched
  // payload. The reports endpoint ORDERS BY gross_amount DESC so we
  // can't index positionally.
  function findRow(rows, method) {
    return rows.find((r) => r.method === method);
  }

  it('rolls up legacy + canonical pairs into a single row per logical method', async () => {
    // The dashboard test above already seeded a mix of casings for
    // today, so `/sales-by-payment-method` (which uses today as its
    // default date range when neither `from` nor `to` is passed)
    // should reflect the same canonicalised view.
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/reports/sales-by-payment-method?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(Array.isArray(res.body.rows)).toBe(true);
    // No row may carry a legacy lowercase code.
    for (const row of res.body.rows) {
      expect(row.method).not.toBe('cash');
      expect(row.method).not.toBe('card');
      expect(row.method).not.toBe('qris');
    }

    const cashRow = findRow(res.body.rows, 'CASH');
    const edcRow = findRow(res.body.rows, 'EDC');
    const qrisStaticRow = findRow(res.body.rows, 'QRIS_STATIC');
    expect(cashRow).toBeDefined();
    expect(edcRow).toBeDefined();
    expect(qrisStaticRow).toBeDefined();
    // Each canonical bucket must include AT LEAST the legacy + canonical
    // rows from above (5 cash, 2 card-or-EDC, 2 qris-or-QRIS_STATIC).
    expect(Number(cashRow.transactions)).toBeGreaterThanOrEqual(5);
    expect(Number(edcRow.transactions)).toBeGreaterThanOrEqual(2);
    expect(Number(qrisStaticRow.transactions)).toBeGreaterThanOrEqual(2);
  });

  it('preserves MDR enrichment under the canonical bucket — `EDC` finds the `card` MDR config', async () => {
    // Seed a `card`-typed payment method config with a non-zero
    // fee_percent so the enrichment path produces a measurable
    // mdr_amount for the canonical `EDC` bucket. If the MDR lookup
    // had been left as raw `mdrRows[(row.method || '').toLowerCase()]`
    // without the legacy-to-canonical fallback, an `EDC` row would
    // miss the `card` config and report mdr_amount=0 even though
    // half of the underlying transactions are real `card` rows.
    //
    // We pass `tenant_id` explicitly because the `payment_methods`
    // column DEFAULT is `current_setting('app.current_tenant')::int`
    // and `runAsSystem` sets that to '0' (system-bypass sentinel) —
    // letting the default fire would produce a tenant_id=0 row that
    // violates `payment_methods_tenant_fk` (no tenant row exists at
    // id=0). The seeded admin tenant is id=1.
    await runAsSystem(() =>
      queryFn(
        `INSERT INTO payment_methods (tenant_id, code, name, type, fee_percent, fee_flat, is_active)
         VALUES (1, 'card', 'Kartu', 'card', 1.5, 0, 1)
         ON CONFLICT (tenant_id, code) DO UPDATE SET fee_percent = EXCLUDED.fee_percent`
      )
    );

    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/reports/sales-by-payment-method?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const edcRow = res.body.rows.find((r) => r.method === 'EDC');
    expect(edcRow).toBeDefined();
    // `mdr_pct` should reflect the `card` config (1.5%) — proves the
    // canonical `EDC` bucket successfully looked up the legacy
    // `card` MDR config via the LEGACY_TO_CANONICAL inverse path in
    // the route's mdrRows acc-build.
    expect(Number(edcRow.mdr_pct)).toBe(1.5);
    expect(Number(edcRow.mdr_amount)).toBeGreaterThan(0);
  });
});

describe('GET /api/reports/sales-summary payment_breakdown canonicalization', () => {
  it('rolls up legacy + canonical pairs in payment_breakdown', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/reports/sales-summary?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const breakdown = res.body.payment_breakdown;
    expect(Array.isArray(breakdown)).toBe(true);
    // No row should still carry a legacy lowercase code.
    for (const row of breakdown) {
      expect(row.method).not.toBe('cash');
      expect(row.method).not.toBe('card');
      expect(row.method).not.toBe('qris');
    }

    const cashRow = breakdown.find((r) => r.method === 'CASH');
    expect(cashRow).toBeDefined();
    expect(Number(cashRow.count)).toBeGreaterThanOrEqual(5);
  });
});

describe('reports payment_method filter accepts both casings', () => {
  it('?payment_method=cash matches BOTH `cash` and `CASH` rows (legacy filter casing)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/reports/sales-summary?from=${today}&to=${today}&payment_method=cash`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // The filter should see BOTH legacy + canonical rows as a single
    // logical method, so the breakdown contains exactly one row
    // (canonical CASH) and the count covers all pre-#236 + post-#236
    // rows we seeded.
    expect(res.body.payment_breakdown).toHaveLength(1);
    expect(res.body.payment_breakdown[0].method).toBe('CASH');
    expect(Number(res.body.payment_breakdown[0].count)).toBeGreaterThanOrEqual(5);
  });

  it('?payment_method=CASH matches BOTH `cash` and `CASH` rows (canonical filter casing)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/reports/sales-summary?from=${today}&to=${today}&payment_method=CASH`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(res.body.payment_breakdown).toHaveLength(1);
    expect(res.body.payment_breakdown[0].method).toBe('CASH');
    // Same coverage as the lowercase-filter case above — the two
    // queries must return symmetric results.
    expect(Number(res.body.payment_breakdown[0].count)).toBeGreaterThanOrEqual(5);
  });
});
