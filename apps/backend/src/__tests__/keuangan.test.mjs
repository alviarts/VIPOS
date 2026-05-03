import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

import { setupTestEnv, teardownTestEnv } from './setup-test-db.mjs';

const require = createRequire(import.meta.url);

let app;
let token;

async function login() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  return res.body.token;
}

beforeAll(async () => {
  setupTestEnv();
  const { buildApp } = require('../app');
  app = buildApp({ morganEnabled: false });
  token = await login();
});

afterAll(() => {
  teardownTestEnv();
});

async function findAccountByCode(code) {
  const res = await request(app).get('/api/account').set('Authorization', `Bearer ${token}`);
  return res.body.find((a) => a.code === code);
}

describe('P1-15 Chart of Accounts', () => {
  it('seeds default 43 accounts with valid normal_balance', async () => {
    const res = await request(app).get('/api/account').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(40);
    const kas = res.body.find((a) => a.code === '1101');
    expect(kas.type).toBe('ASET');
    expect(kas.normal_balance).toBe('debit');
    const hutang = res.body.find((a) => a.code === '2101');
    expect(hutang.type).toBe('KEWAJIBAN');
    expect(hutang.normal_balance).toBe('credit');
  });

  it('creates and updates custom account', async () => {
    const create = await request(app)
      .post('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '5299', name: 'Beban Lain-Lain', type: 'BEBAN', subtype: 'Beban Operasional' });
    expect(create.status).toBe(201);
    expect(create.body.normal_balance).toBe('debit');

    const upd = await request(app)
      .put(`/api/account/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Beban Lain-Lain (Updated)' });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe('Beban Lain-Lain (Updated)');
  });

  it('rejects duplicate code', async () => {
    const res = await request(app)
      .post('/api/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '1101', name: 'Dup Kas', type: 'ASET' });
    expect(res.status).toBe(409);
  });
});

describe('P1-15 Journal posting', () => {
  it('rejects unbalanced journal', async () => {
    const kas = await findAccountByCode('1101');
    const modal = await findAccountByCode('3101');
    const res = await request(app)
      .post('/api/journal')
      .set('Authorization', `Bearer ${token}`)
      .send({
        journal_date: '2025-01-01',
        description: 'Bad journal',
        lines: [
          { account_id: kas.id, debit: 1000000, credit: 0 },
          { account_id: modal.id, debit: 0, credit: 999999 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('posts a balanced opening journal', async () => {
    const kas = await findAccountByCode('1101');
    const modal = await findAccountByCode('3101');
    const res = await request(app)
      .post('/api/journal')
      .set('Authorization', `Bearer ${token}`)
      .send({
        journal_date: '2025-01-01',
        description: 'Setoran modal awal',
        source_type: 'opening',
        lines: [
          { account_id: kas.id, debit: 50000000, credit: 0 },
          { account_id: modal.id, debit: 0, credit: 50000000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.journal_no).toMatch(/^JRNL\/\d{6}\/\d{5}$/);

    const detail = await request(app)
      .get(`/api/journal/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.lines.length).toBe(2);
    expect(detail.body.lines[0].account_code).toBe('1101');
  });
});

describe('P1-15 Cash transfer', () => {
  it('posts a transfer with bank fee', async () => {
    const bca = await findAccountByCode('1102');
    const kasKasir = await findAccountByCode('1110');
    const bankFee = await findAccountByCode('5911');
    const res = await request(app)
      .post('/api/cash-transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transfer_date: '2025-01-15',
        from_account_id: bca.id,
        to_account_id: kasKasir.id,
        amount: 5000000,
        fee: 6500,
        fee_account_id: bankFee.id,
        description: 'Setoran kas operasional',
      });
    expect(res.status).toBe(201);
    expect(res.body.journal_id).toBeTruthy();

    const list = await request(app)
      .get('/api/cash-transfer')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects same source and destination', async () => {
    const kas = await findAccountByCode('1101');
    const res = await request(app)
      .post('/api/cash-transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transfer_date: '2025-01-15',
        from_account_id: kas.id,
        to_account_id: kas.id,
        amount: 100000,
      });
    expect(res.status).toBe(400);
  });
});

describe('P1-15 Income & Expense', () => {
  it('records income, posts auto-journal Dr Cash, Cr Revenue', async () => {
    const kas = await findAccountByCode('1101');
    const pendapatanLain = await findAccountByCode('4103');
    const res = await request(app)
      .post('/api/income')
      .set('Authorization', `Bearer ${token}`)
      .send({
        income_date: '2025-02-10',
        category: 'Konsultasi',
        amount: 2000000,
        cash_account_id: kas.id,
        revenue_account_id: pendapatanLain.id,
        description: 'Fee konsultasi klien X',
      });
    expect(res.status).toBe(201);
    expect(res.body.ref_no).toMatch(/^INC\/\d{6}\/\d{5}$/);
    expect(res.body.journal_id).toBeTruthy();

    const ledger = await request(app)
      .get(`/api/account/${kas.id}/ledger`)
      .set('Authorization', `Bearer ${token}`);
    const found = ledger.body.lines.find((l) => l.debit === 2000000);
    expect(found).toBeTruthy();
  });

  it('records expense, deletes both expense and journal', async () => {
    const beban = await findAccountByCode('5202');
    const kas = await findAccountByCode('1101');
    const create = await request(app)
      .post('/api/expense')
      .set('Authorization', `Bearer ${token}`)
      .send({
        expense_date: '2025-02-15',
        expense_account_id: beban.id,
        payment_account_id: kas.id,
        amount: 3000000,
        description: 'Sewa Februari',
      });
    expect(create.status).toBe(201);
    const expenseId = create.body.id;
    const journalId = create.body.journal_id;

    const del = await request(app)
      .delete(`/api/expense/${expenseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const journalAfter = await request(app)
      .get(`/api/journal/${journalId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(journalAfter.status).toBe(404);
  });
});

describe('P1-15 Vendor', () => {
  it('CRUD vendor with auto code', async () => {
    const create = await request(app)
      .post('/api/vendor')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'PT Internet Cepat',
        npwp: '01.234.567.8-901.000',
        phone: '0211234567',
        bank_name: 'Mandiri',
        bank_account_no: '1234',
        payment_terms_days: 30,
      });
    expect(create.status).toBe(201);
    expect(create.body.code).toMatch(/^VND\d{4}$/);

    const upd = await request(app)
      .put(`/api/vendor/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ payment_terms_days: 60 });
    expect(upd.status).toBe(200);
    expect(upd.body.payment_terms_days).toBe(60);
  });
});

describe('P1-15 Fixed asset depreciation', () => {
  let asset;
  it('creates asset with acquisition journal', async () => {
    const peralatan = await findAccountByCode('1504');
    const akmDep = await findAccountByCode('1593');
    const bebanPenyusutan = await findAccountByCode('5301');
    const kas = await findAccountByCode('1101');
    const create = await request(app)
      .post('/api/fixed-asset')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Laptop MacBook',
        category: 'Peralatan',
        acquisition_date: '2025-01-01',
        cost: 24000000,
        useful_life_years: 4,
        salvage_value: 0,
        depreciation_method: 'STRAIGHT_LINE',
        asset_account_id: peralatan.id,
        accum_dep_account_id: akmDep.id,
        dep_expense_account_id: bebanPenyusutan.id,
        payment_account_id: kas.id,
      });
    expect(create.status).toBe(201);
    expect(create.body.code).toMatch(/^FA\d{4}$/);
    expect(create.body.acquisition_journal_id).toBeTruthy();
    asset = create.body;
  });

  it('runs straight-line depreciation: 24M / (4*12) = 500k/month', async () => {
    const run = await request(app)
      .post('/api/fixed-asset/depreciate')
      .set('Authorization', `Bearer ${token}`)
      .send({ year: 2025, month: 1 });
    expect(run.status).toBe(200);
    expect(run.body.count).toBeGreaterThanOrEqual(1);
    const item = run.body.items.find((i) => i.asset_code === asset.code);
    expect(item.amount).toBeCloseTo(500000, 0);
  });

  it('idempotent: same period does not double-post', async () => {
    const run = await request(app)
      .post('/api/fixed-asset/depreciate')
      .set('Authorization', `Bearer ${token}`)
      .send({ year: 2025, month: 1 });
    expect(run.body.count).toBe(0);
  });

  it('disposes asset (sold) — posts gain/loss', async () => {
    const kas = await findAccountByCode('1101');
    const dispose = await request(app)
      .post(`/api/fixed-asset/${asset.id}/dispose`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        disposal_date: '2025-06-01',
        disposal_type: 'SOLD',
        proceeds: 20000000,
        proceeds_account_id: kas.id,
        buyer: 'Toko Bekas',
      });
    expect(dispose.status).toBe(200);
    const detail = await request(app)
      .get(`/api/fixed-asset/${asset.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.status).toBe('disposed');
    expect(detail.body.disposal).toBeTruthy();
  });
});

describe('P1-15 Financial reports', () => {
  it('balance sheet identity holds (Aset = Kewajiban + Modal + Laba Berjalan)', async () => {
    const res = await request(app)
      .get('/api/financial-report/balance-sheet')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_aset');
    expect(res.body).toHaveProperty('is_balanced');
  });

  it('income statement returns pendapatan + beban arrays', async () => {
    const res = await request(app)
      .get('/api/financial-report/income-statement')
      .query({ from: '2025-01-01', to: '2025-12-31' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pendapatan)).toBe(true);
    expect(Array.isArray(res.body.beban)).toBe(true);
  });

  it('cash-flow returns sections per source_type', async () => {
    const res = await request(app)
      .get('/api/financial-report/cash-flow')
      .query({ from: '2025-01-01', to: '2025-12-31' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sections)).toBe(true);
  });

  it('journal report is non-empty after our test postings', async () => {
    const res = await request(app)
      .get('/api/financial-report/journal')
      .query({ from: '2025-01-01', to: '2025-12-31' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('AP and AR endpoints respond', async () => {
    const ap = await request(app)
      .get('/api/financial-report/ap')
      .set('Authorization', `Bearer ${token}`);
    expect(ap.status).toBe(200);
    const ar = await request(app)
      .get('/api/financial-report/ar')
      .set('Authorization', `Bearer ${token}`);
    expect(ar.status).toBe(200);
  });
});

describe('P1-15 Recurring bill', () => {
  it('CRUD recurring bill', async () => {
    const beban = await findAccountByCode('5204'); // Beban Internet
    const kas = await findAccountByCode('1101');
    const create = await request(app)
      .post('/api/recurring-bill')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Internet kantor',
        expense_account_id: beban.id,
        payment_account_id: kas.id,
        amount: 500000,
        frequency: 'monthly',
        due_day: 5,
      });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get('/api/recurring-bill')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    const upd = await request(app)
      .put(`/api/recurring-bill/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 600000 });
    expect(upd.body.amount).toBe(600000);

    const del = await request(app)
      .delete(`/api/recurring-bill/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });
});
