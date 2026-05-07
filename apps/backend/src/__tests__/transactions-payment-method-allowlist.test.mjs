// VIPOS — backend integration test for the `transactions.payment_method`
// enum allow-list (PR #232). Codifies the 27-case smoke matrix from
// docs/handoff/2026-05-07 into a permanent CI guardrail so the legacy
// lowercase + canonical Android union, the missing-key default, the
// strict `typeof === 'string'` guard, the strict-no-toLowerCase
// behaviour, the short-circuit before tx(...) opens, and the items /
// stock pre-existing paths can never silently regress.
//
// Why integration-level (not unit-level): the allow-list lib already
// has a vitest unit suite, but #232's contract is observable at the
// HTTP layer (POST /api/transactions). A regression in routing /
// middleware ordering — e.g. a future audit-log refactor that opens
// `tx(...)` before the allow-list check — would slip past the lib
// unit suite. This file pins the route-level contract.
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

// Mirror of `apps/backend/src/lib/payment-methods.js` exports — pinned
// here verbatim so a future enum change has to be made in BOTH places
// (this assertion AND the lib), making the contract impossible to
// forget mid-PR.
const EXPECTED_ALLOWED = Object.freeze([
  'cash',
  'card',
  'qris',
  'CASH',
  'EDC',
  'QRIS_STATIC',
  'QRIS_DYNAMIC',
  'GOPAY',
  'OVO',
  'DANA',
  'SHOPEEPAY',
  'LINKAJA',
  'BANK_TRANSFER',
  'CREDIT',
  'DEPOSIT',
  'VOUCHER',
  'LOYALTY_POINT',
  'OTHER',
]);

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
      name: 'Allow-list Smoke Product',
      sku: 'SKU-ALLOWLIST-SMOKE-1',
      price: 10000,
      stock: 1000,
    });
  expect(res.status).toBe(201);
  return res.body.id;
}

async function setStock(productId, stock) {
  // Use raw SQL with system bypass so RLS and other middleware doesn't
  // get in the way of test-only state shifts.
  await runAsSystem(() =>
    queryFn(`UPDATE products SET stock = $1 WHERE id = $2`, [stock, productId])
  );
}

async function countTransactions() {
  const r = await runAsSystem(() => queryFn(`SELECT COUNT(*)::int AS c FROM transactions`));
  return r.rows[0].c;
}

function postTransaction(body) {
  return request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
}

function bodyForCode(code, opts = {}) {
  const base = {
    items: [{ product_id: smokeProductId, price: 10000, quantity: 1 }],
    payment_amount: 10000,
  };
  if (opts.omitPaymentMethod !== true) base.payment_method = code;
  if (opts.emptyItems === true) base.items = [];
  return base;
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

describe('POST /api/transactions — payment_method allow-list (#232)', () => {
  describe('TC-1: legacy lowercase codes accepted (201)', () => {
    for (const code of ['cash', 'card', 'qris']) {
      it(`accepts "${code}" and persists verbatim`, async () => {
        await setStock(smokeProductId, 1000);
        const res = await postTransaction(bodyForCode(code));
        expect(res.status).toBe(201);
        expect(res.body.payment_method).toBe(code);
        const row = await runAsSystem(() =>
          queryFn(`SELECT payment_method FROM transactions WHERE id = $1`, [res.body.id])
        );
        expect(row.rows[0].payment_method).toBe(code);
      });
    }
  });

  describe('TC-2: canonical Android codes accepted (201)', () => {
    for (const code of [
      'CASH',
      'EDC',
      'QRIS_STATIC',
      'QRIS_DYNAMIC',
      'GOPAY',
      'OVO',
      'DANA',
      'SHOPEEPAY',
      'LINKAJA',
      'BANK_TRANSFER',
      'CREDIT',
      'DEPOSIT',
      'VOUCHER',
      'LOYALTY_POINT',
      'OTHER',
    ]) {
      it(`accepts "${code}" and persists verbatim (no case normalisation)`, async () => {
        await setStock(smokeProductId, 1000);
        const res = await postTransaction(bodyForCode(code));
        expect(res.status).toBe(201);
        expect(res.body.payment_method).toBe(code);
        const row = await runAsSystem(() =>
          queryFn(`SELECT payment_method FROM transactions WHERE id = $1`, [res.body.id])
        );
        expect(row.rows[0].payment_method).toBe(code);
      });
    }
  });

  describe('TC-3: missing payment_method key defaults to "cash" (201)', () => {
    it('omitting the field falls back to "cash" at routes/transactions.js:58', async () => {
      await setStock(smokeProductId, 1000);
      const res = await postTransaction(bodyForCode(undefined, { omitPaymentMethod: true }));
      expect(res.status).toBe(201);
      expect(res.body.payment_method).toBe('cash');
      const row = await runAsSystem(() =>
        queryFn(`SELECT payment_method FROM transactions WHERE id = $1`, [res.body.id])
      );
      expect(row.rows[0].payment_method).toBe('cash');
    });
  });

  describe('TC-4: invalid codes rejected (400) with exact shape + short-circuit', () => {
    const cases = [
      { label: 'unknown code "foo"', value: 'foo' },
      { label: 'pseudo-canonical "BITCOIN"', value: 'BITCOIN' },
      { label: 'empty string ""', value: '' },
      { label: 'mixed-case "Cash" (no toLowerCase regression)', value: 'Cash' },
      { label: 'numeric 42 (typeof string guard)', value: 42 },
    ];

    it.each(cases)('rejects $label with exact 400 shape', async ({ value }) => {
      await setStock(smokeProductId, 1000);
      const before = await countTransactions();
      const res = await postTransaction(bodyForCode(value));
      expect(res.status).toBe(400);
      // EXACT body shape — only two keys, exact error string, exact 18-element
      // ordered allow-list. A future regression that adds extra keys (e.g.
      // `code`, `details`) would fail this assertion.
      expect(Object.keys(res.body).sort()).toEqual(['allowed', 'error']);
      expect(res.body.error).toBe('Metode pembayaran tidak dikenali');
      expect(res.body.allowed).toEqual([...EXPECTED_ALLOWED]);
      // Short-circuit: no row inserted because the route must reject
      // BEFORE opening the tx(...) block.
      const after = await countTransactions();
      expect(after).toBe(before);
    });

    it('5 rejected POSTs in a row do not insert any transaction rows', async () => {
      await setStock(smokeProductId, 1000);
      const before = await countTransactions();
      for (const { value } of cases) {
        const res = await postTransaction(bodyForCode(value));
        expect(res.status).toBe(400);
      }
      const after = await countTransactions();
      expect(after).toBe(before);
    });
  });

  describe('TC-5: stock=0 with valid code → 500 stock error (not 400 allow-list)', () => {
    it('allow-list passes through, stock check rejects with the pre-existing message', async () => {
      await setStock(smokeProductId, 0);
      const res = await postTransaction(bodyForCode('QRIS_DYNAMIC'));
      // The pre-existing tx(...) callback throws on insufficient stock and
      // the route's catch maps it to 500 with the original Indonesian
      // message. The point of this case is that the allow-list does NOT
      // intercept valid codes — the existing business-logic path still
      // wins.
      expect(res.status).toBe(500);
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error).toMatch(/[Ss]tok.*tidak mencukupi/);
      // Reset for downstream tests in case other files share state.
      await setStock(smokeProductId, 1000);
    });
  });

  describe('TC-6: empty items array → 400 items error (not allow-list error)', () => {
    it('items check runs BEFORE allow-list so the message is "Minimal satu produk harus dipilih"', async () => {
      await setStock(smokeProductId, 1000);
      const res = await postTransaction(bodyForCode('cash', { emptyItems: true }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Minimal satu produk harus dipilih');
      // Critically: this is NOT the allow-list error shape — items check
      // must short-circuit BEFORE the allow-list check.
      expect(res.body.allowed).toBeUndefined();
    });
  });
});
