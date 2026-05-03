import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

beforeAll(async () => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
});

afterAll(() => {
  teardownTestEnv();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('POST /api/finance/accounts', () => {
  it('400 kalau kode/nama missing', async () => {
    const res = await request(app)
      .post('/api/finance/accounts')
      .set(auth())
      .send({ kode: '' });
    expect(res.status).toBe(400);
  });

  it('201 dengan saldo_awal coerce dari string', async () => {
    const res = await request(app)
      .post('/api/finance/accounts')
      .set(auth())
      .send({ kode: 'KAS-1', nama: 'Kas Utama', saldo_awal: '100000' });
    expect(res.status).toBe(201);
    expect(res.body.saldo_awal).toBe(100000);
    expect(res.body.saldo).toBe(100000);
  });
});

describe('POST /api/finance/transactions', () => {
  let accountAId;
  let accountBId;

  beforeAll(async () => {
    const a = await request(app)
      .post('/api/finance/accounts')
      .set(auth())
      .send({ kode: 'TX-A', nama: 'Acc A', saldo_awal: 1000 });
    accountAId = a.body.id;
    const b = await request(app)
      .post('/api/finance/accounts')
      .set(auth())
      .send({ kode: 'TX-B', nama: 'Acc B', saldo_awal: 0 });
    accountBId = b.body.id;
  });

  it('400 kalau jumlah <= 0', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .set(auth())
      .send({ tipe: 'pemasukan', account_id: accountAId, jumlah: 0 });
    expect(res.status).toBe(400);
  });

  it('400 kalau tipe=transfer tanpa account_to_id', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .set(auth())
      .send({ tipe: 'transfer', account_id: accountAId, jumlah: 100 });
    expect(res.status).toBe(400);
    const paths = res.body.details.map((d) => d.path);
    expect(paths).toContain('account_to_id');
  });

  it('201 transfer between accounts', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .set(auth())
      .send({
        tipe: 'transfer',
        account_id: accountAId,
        account_to_id: accountBId,
        jumlah: 250,
      });
    expect(res.status).toBe(201);
    expect(res.body.tipe).toBe('transfer');
    expect(res.body.jumlah).toBe(250);
  });
});
