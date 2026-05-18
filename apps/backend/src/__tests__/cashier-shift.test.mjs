// Integration tests for cashier shift endpoints (P3-14).
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

beforeAll(async () => {
  await setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  adminToken = await login();
});

afterAll(async () => {
  await teardownTestEnv();
});

async function closeAnyOpenShift() {
  // Close any existing open shift so the next open succeeds.
  await request(app)
    .get('/api/v1/cashier-shift/active')
    .set('Authorization', `Bearer ${adminToken}`)
    .then(async (res) => {
      if (res.body.shift) {
        await request(app)
          .post(`/api/v1/cashier-shift/${res.body.shift.id}/close`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ closing_cash_counted: 0 });
      }
    });
}

describe('GET /api/v1/cashier-shift/active', () => {
  it('returns null when no shift is open', async () => {
    const res = await request(app)
      .get('/api/v1/cashier-shift/active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.shift).toBeNull();
  });
});

describe('POST /api/v1/cashier-shift/open', () => {
  it('201 opens a new shift', async () => {
    const res = await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 500000 });
    expect(res.status).toBe(201);
    expect(res.body.shift).toBeDefined();
    expect(res.body.shift.opening_cash).toBe(500000);
    expect(res.body.shift.status).toBe('open');
  });

  it('409 when shift already open', async () => {
    await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 500000 });

    const res = await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 300000 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHIFT_ALREADY_OPEN');
  });

  it('active returns the open shift', async () => {
    await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 500000 });

    const res = await request(app)
      .get('/api/v1/cashier-shift/active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.shift).not.toBeNull();
    expect(res.body.shift.opening_cash).toBe(500000);
  });
});

describe('POST /api/v1/cashier-shift/:id/close', () => {
  it('closes an open shift with reconciliation', async () => {
    await closeAnyOpenShift();
    const openRes = await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 500000 });
    expect(openRes.status).toBe(201);
    const shiftId = openRes.body.shift.id;

    const closeRes = await request(app)
      .post(`/api/v1/cashier-shift/${shiftId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ closing_cash_counted: 520000 });
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.shift.status).toBe('closed');
    expect(closeRes.body.shift.closing_cash_counted).toBe(520000);
    expect(closeRes.body.shift.variance).toBeDefined();
  });

  it('409 when shift already closed', async () => {
    await closeAnyOpenShift();
    const openRes = await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 500000 });
    expect(openRes.status).toBe(201);
    const shiftId = openRes.body.shift.id;

    await request(app)
      .post(`/api/v1/cashier-shift/${shiftId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ closing_cash_counted: 500000 });

    const res = await request(app)
      .post(`/api/v1/cashier-shift/${shiftId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ closing_cash_counted: 500000 });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/cashier-shift/:id/summary', () => {
  it('returns shift summary', async () => {
    await closeAnyOpenShift();
    const openRes = await request(app)
      .post('/api/v1/cashier-shift/open')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ opening_cash: 500000 });
    expect(openRes.status).toBe(201);
    const shiftId = openRes.body.shift.id;

    const res = await request(app)
      .get(`/api/v1/cashier-shift/${shiftId}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.opening_cash).toBe(500000);
    expect(res.body.expected_cash).toBeDefined();
    expect(res.body.payment_breakdown).toBeDefined();
  });
});
