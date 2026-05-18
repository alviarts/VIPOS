// VIPOS — backend integration suite for the QRIS Dynamic endpoints
// (`apps/backend/src/routes/payment-qris.js`). Codifies the contract
// documented in `docs/v2/14_PAYMENT_METHODS.md` §6 against the
// `qris_dynamic_invocations` Postgres table as a CI guard against
// accidentally breaking the HTTP shape, the auto-expiry transition,
// the cross-tenant 404 isolation, the production backdoor lockout,
// or the AWAITING/PAID/EXPIRED state machine.
//
// Why integration-level: every behaviour codified here is observable
// at the HTTP layer and the only sane place to assert the
// `authenticateToken` + tenant-scoping contract is through a real
// supertest agent, since req.tenantId is set by the auth middleware
// at request time.
//
// Risk: green — HTTP-level test, runs against the test DB.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

function mint(body) {
  return request(app)
    .post('/api/v1/payment/qris/dynamic')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);
}

function poll(refId) {
  return request(app)
    .get(`/api/v1/payment/qris/${encodeURIComponent(refId)}/status`)
    .set('Authorization', `Bearer ${adminToken}`);
}

function markPaid(refId) {
  return request(app)
    .post(`/api/v1/payment/qris/${encodeURIComponent(refId)}/_test/mark-paid`)
    .set('Authorization', `Bearer ${adminToken}`);
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

beforeEach(async () => {
  // Reset DB table so each `it` starts from a clean slate.
  // The helper is exposed off the route module (see `_resetStoreForTests`).
  const { _resetStoreForTests } = require('../routes/payment-qris');
  await _resetStoreForTests();
});

describe('POST /api/v1/payment/qris/dynamic — mint stub QR', () => {
  it('returns 201 with the documented response shape', async () => {
    const res = await mint({ amount: 71000 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        ref_id: expect.stringMatching(/^QR-[0-9a-f-]{36}$/),
        qr_code_url: expect.stringMatching(/^https:\/\/stub\.qris\.local\/qr\//),
        polling_url: expect.stringMatching(/^\/api\/v1\/payment\/qris\/QR-[0-9a-f-]{36}\/status$/),
        status: 'AWAITING',
        amount: 71000,
        transaction_id: null,
        expires_at: expect.any(String),
      })
    );
    // expires_at must be ~5 minutes in the future per spec §6.7.
    const ttlSec = (new Date(res.body.expires_at).getTime() - Date.now()) / 1000;
    expect(ttlSec).toBeGreaterThan(60);
    expect(ttlSec).toBeLessThanOrEqual(5 * 60 + 1);
  });

  it('threads transaction_id through verbatim when supplied', async () => {
    const res = await mint({ amount: 50000, transaction_id: 12345 });
    expect(res.status).toBe(201);
    expect(res.body.transaction_id).toBe(12345);
  });

  it('rejects non-number amount with 400', async () => {
    const res = await mint({ amount: '71000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/i);
  });

  it('rejects zero / negative amount with 400', async () => {
    for (const value of [0, -1, -1000]) {
      const res = await mint({ amount: value });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lebih besar dari 0|bilangan bulat/i);
    }
  });

  it('rejects non-integer amount with 400', async () => {
    const res = await mint({ amount: 71000.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bilangan bulat/i);
  });

  it('rejects non-positive-integer transaction_id with 400', async () => {
    for (const value of ['12345', 0, -1, 1.5]) {
      const res = await mint({ amount: 1000, transaction_id: value });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/transaction_id/);
    }
  });

  it('emits a fresh ref_id on every call (no aliasing)', async () => {
    const a = (await mint({ amount: 1000 })).body.ref_id;
    const b = (await mint({ amount: 1000 })).body.ref_id;
    expect(a).not.toBe(b);
  });

  it('requires authentication (401 without bearer token)', async () => {
    const res = await request(app).post('/api/v1/payment/qris/dynamic').send({ amount: 1000 });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/payment/qris/:ref_id/status — poll stub QR', () => {
  it('returns 200 + AWAITING immediately after mint', async () => {
    const minted = (await mint({ amount: 71000 })).body;
    const res = await poll(minted.ref_id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ref_id: minted.ref_id,
      status: 'AWAITING',
      paid_at: null,
      expires_at: minted.expires_at,
      amount: 71000,
      transaction_id: null,
    });
  });

  it('returns 404 for unknown ref_id', async () => {
    const res = await poll('QR-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QRIS ref_id tidak ditemukan');
  });

  it('flips AWAITING → EXPIRED lazily once past expires_at', async () => {
    const minted = (await mint({ amount: 1000 })).body;
    // Reach into the store and rewind expires_at to the past so the
    // next poll trips the lazy-expiry branch.
    const route = require('../routes/payment-qris');
    // The store isn't exposed; instead we monkey-patch the record
    // directly via the helper's side-effect: re-mint after _reset and
    // then mutate via Date.now stub. Simpler approach: poll twice
    // with a forced setTimeout would race CI. We instead re-invoke
    // mint with a fresh ref_id and patch the record's expires_at to
    // the past via a back door — done by exposing _storeForTests.
    //
    // The route module ships a _resetStoreForTests but no get/set
    // hooks. To keep the test surface minimal, we override Date.now
    // for the duration of the second poll so `_isExpired` returns
    // true without sleeping.
    const realNow = Date.now.bind(Date);
    const expiresAtMs = new Date(minted.expires_at).getTime();
    Date.now = () => expiresAtMs + 1; // 1 ms past expiry
    try {
      const res = await poll(minted.ref_id);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXPIRED');
    } finally {
      Date.now = realNow;
    }
    // A subsequent poll WITHOUT the time-warp should still see EXPIRED
    // (terminal state) rather than flipping back to AWAITING.
    const res2 = await poll(minted.ref_id);
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('EXPIRED');
    // route module reference held to keep the require cache warm —
    // confirms we hit the same module (_store) the route uses.
    expect(typeof route._resetStoreForTests).toBe('function');
  });

  it('requires authentication (401 without bearer token)', async () => {
    const minted = (await mint({ amount: 1000 })).body;
    const res = await request(app).get(
      `/api/v1/payment/qris/${encodeURIComponent(minted.ref_id)}/status`
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/payment/qris/:ref_id/_test/mark-paid — test backdoor', () => {
  it('flips AWAITING → PAID and stamps paid_at', async () => {
    const minted = (await mint({ amount: 71000 })).body;
    const res = await markPaid(minted.ref_id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(typeof res.body.paid_at).toBe('string');
    expect(new Date(res.body.paid_at).getTime()).toBeGreaterThan(0);
    // Subsequent poll mirrors the PAID state.
    const polled = await poll(minted.ref_id);
    expect(polled.status).toBe(200);
    expect(polled.body.status).toBe('PAID');
    expect(polled.body.paid_at).toBe(res.body.paid_at);
  });

  it('is idempotent — second mark-paid keeps the original paid_at', async () => {
    const minted = (await mint({ amount: 71000 })).body;
    const first = await markPaid(minted.ref_id);
    const second = await markPaid(minted.ref_id);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.paid_at).toBe(first.body.paid_at);
  });

  it('returns 409 when the invocation has already EXPIRED', async () => {
    const minted = (await mint({ amount: 1000 })).body;
    const realNow = Date.now.bind(Date);
    const expiresAtMs = new Date(minted.expires_at).getTime();
    Date.now = () => expiresAtMs + 1;
    try {
      const res = await markPaid(minted.ref_id);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/kedaluwarsa/i);
      expect(res.body.status).toBe('EXPIRED');
    } finally {
      Date.now = realNow;
    }
  });

  it('returns 404 for unknown ref_id', async () => {
    const res = await markPaid('QR-no-such-thing');
    expect(res.status).toBe(404);
  });

  it('is locked out in production (NODE_ENV === production)', async () => {
    const minted = (await mint({ amount: 1000 })).body;
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await markPaid(minted.ref_id);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/test backdoor/i);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('requires authentication (401 without bearer token)', async () => {
    const minted = (await mint({ amount: 1000 })).body;
    const res = await request(app).post(
      `/api/v1/payment/qris/${encodeURIComponent(minted.ref_id)}/_test/mark-paid`
    );
    expect(res.status).toBe(401);
  });
});

describe('Cross-tenant isolation', () => {
  // We simulate a second tenant by issuing a JWT for a different
  // tenant_id. The admin login above is tenant_id=1 (per the seed data
  // applied by setup-test-db.mjs); we forge a parallel token with
  // tenant_id=999 to confirm cross-tenant lookups always 404.
  it('a foreign tenant cannot poll a ref_id minted by another tenant', async () => {
    const minted = (await mint({ amount: 1000 })).body;
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    // Mirror the seed admin's shape but flip tenant_id to a value the
    // mint above would never have used.
    const foreignToken = jwt.sign({ id: 999, role: 'admin', tenant_id: 999 }, JWT_SECRET, {
      expiresIn: '1h',
    });
    const res = await request(app)
      .get(`/api/v1/payment/qris/${encodeURIComponent(minted.ref_id)}/status`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QRIS ref_id tidak ditemukan');
  });
});
