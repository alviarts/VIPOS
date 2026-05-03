// P1-15: Keuangan — all router exports.
//
// Exports:
//   accountRouter       — /api/account
//   journalRouter       — /api/journal
//   cashTransferRouter  — /api/cash-transfer
//   incomeRouter        — /api/income
//   expenseRouter       — /api/expense
//   recurringBillRouter — /api/recurring-bill
//   vendorRouter        — /api/vendor
//   fixedAssetRouter    — /api/fixed-asset
//   reportRouter        — /api/financial-report

const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { postJournal, getAccountBalance } = require('../utils/journal');
const {
  GlAccountCreateSchema,
  GlAccountUpdateSchema,
  GlJournalCreateSchema,
  CashTransferCreateSchema,
  IncomeCreateSchema,
  ExpenseCreateSchema,
  RecurringBillCreateSchema,
  RecurringBillUpdateSchema,
  VendorCreateSchema,
  VendorUpdateSchema,
  FixedAssetCreateSchema,
  FixedAssetUpdateSchema,
  DepreciationRunSchema,
  FixedAssetDisposalSchema,
} = require('@vipos/shared');

// =============================================================
// Helpers
// =============================================================

function generateRefNo(db, table, prefix, dateField, dateValue) {
  const ym = (dateValue || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(0, 6);
  const fullPrefix = `${prefix}/${ym}/`;
  const last = db
    .prepare(`SELECT ref_no FROM ${table} WHERE ref_no LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`${fullPrefix}%`);
  const seq = last ? Number(last.ref_no.split('/')[2]) + 1 : 1;
  return `${fullPrefix}${String(seq).padStart(5, '0')}`;
}

function generateVendorCode(db) {
  const last = db
    .prepare(`SELECT code FROM gl_vendors WHERE code LIKE 'VND%' ORDER BY id DESC LIMIT 1`)
    .get();
  const seq = last ? Number(last.code.replace('VND', '')) + 1 : 1;
  return `VND${String(seq).padStart(4, '0')}`;
}

function generateAssetCode(db) {
  const last = db
    .prepare(`SELECT code FROM gl_fixed_assets WHERE code LIKE 'FA%' ORDER BY id DESC LIMIT 1`)
    .get();
  const seq = last ? Number(last.code.replace('FA', '')) + 1 : 1;
  return `FA${String(seq).padStart(4, '0')}`;
}

const NORMAL_BALANCE = {
  ASET: 'debit',
  KEWAJIBAN: 'credit',
  MODAL: 'credit',
  PENDAPATAN: 'credit',
  BEBAN: 'debit',
};

// =============================================================
// /api/account — Chart of Accounts
// =============================================================
const accountRouter = express.Router();

accountRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { type, is_active } = req.query;
  const conditions = [];
  const params = [];
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (is_active !== undefined) {
    conditions.push('is_active = ?');
    params.push(Number(is_active));
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM gl_accounts ${where} ORDER BY code ASC`).all(...params);
  res.json(rows);
});

accountRouter.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM gl_accounts WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Account not found' });
  const balance = getAccountBalance(db, row.id);
  res.json({ ...row, current_balance: balance });
});

accountRouter.post(
  '/',
  authenticateToken,
  validate({ body: GlAccountCreateSchema }),
  (req, res) => {
    const db = getDb();
    const data = req.body;
    const exists = db.prepare(`SELECT id FROM gl_accounts WHERE code = ?`).get(data.code);
    if (exists) return res.status(409).json({ error: 'Account code already exists' });
    const result = db
      .prepare(
        `INSERT INTO gl_accounts (code, name, type, subtype, parent_id, normal_balance, opening_balance, is_active, description)
       VALUES (@code, @name, @type, @subtype, @parent_id, @nb, @opening_balance, @is_active, @description)`
      )
      .run({
        ...data,
        subtype: data.subtype || null,
        parent_id: data.parent_id || null,
        description: data.description || null,
        nb: NORMAL_BALANCE[data.type],
      });
    const row = db.prepare(`SELECT * FROM gl_accounts WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(row);
  }
);

accountRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: GlAccountUpdateSchema }),
  (req, res) => {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM gl_accounts WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Account not found' });
    const data = req.body;
    const merged = { ...existing, ...data };
    const nb = data.type ? NORMAL_BALANCE[data.type] : existing.normal_balance;
    db.prepare(
      `UPDATE gl_accounts SET
       code=@code, name=@name, type=@type, subtype=@subtype, parent_id=@parent_id,
       normal_balance=@nb, opening_balance=@opening_balance, is_active=@is_active,
       description=@description, updated_at=CURRENT_TIMESTAMP
     WHERE id=@id`
    ).run({
      ...merged,
      nb,
      subtype: merged.subtype || null,
      parent_id: merged.parent_id || null,
      description: merged.description || null,
      id: req.params.id,
    });
    res.json(db.prepare(`SELECT * FROM gl_accounts WHERE id = ?`).get(req.params.id));
  }
);

accountRouter.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const used = db
    .prepare(`SELECT 1 FROM gl_journal_lines WHERE account_id = ? LIMIT 1`)
    .get(req.params.id);
  if (used) {
    return res
      .status(400)
      .json({ error: 'Akun sudah terpakai di journal — tidak bisa dihapus, set is_active=0 saja' });
  }
  db.prepare(`DELETE FROM gl_accounts WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

accountRouter.get('/:id/ledger', authenticateToken, (req, res) => {
  const db = getDb();
  const acc = db.prepare(`SELECT * FROM gl_accounts WHERE id = ?`).get(req.params.id);
  if (!acc) return res.status(404).json({ error: 'Account not found' });
  const { from, to } = req.query;
  const conditions = ['jl.account_id = ?'];
  const params = [req.params.id];
  if (from) {
    conditions.push('j.journal_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('j.journal_date <= ?');
    params.push(to);
  }
  const lines = db
    .prepare(
      `SELECT jl.id, j.journal_no, j.journal_date, j.description AS journal_description,
              j.source_type, jl.debit, jl.credit, jl.description
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY j.journal_date ASC, jl.id ASC`
    )
    .all(...params);
  let runningBalance = Number(acc.opening_balance) || 0;
  const enriched = lines.map((l) => {
    if (acc.normal_balance === 'debit') {
      runningBalance += Number(l.debit) - Number(l.credit);
    } else {
      runningBalance += Number(l.credit) - Number(l.debit);
    }
    return { ...l, balance: runningBalance };
  });
  res.json({
    account: acc,
    opening_balance: Number(acc.opening_balance) || 0,
    lines: enriched,
    closing_balance: runningBalance,
  });
});

// =============================================================
// /api/journal — General Journal
// =============================================================
const journalRouter = express.Router();

journalRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { from, to, source_type, account_id } = req.query;
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push('j.journal_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('j.journal_date <= ?');
    params.push(to);
  }
  if (source_type) {
    conditions.push('j.source_type = ?');
    params.push(source_type);
  }
  if (account_id) {
    conditions.push(
      'EXISTS (SELECT 1 FROM gl_journal_lines jl WHERE jl.journal_id = j.id AND jl.account_id = ?)'
    );
    params.push(account_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT j.*, (SELECT COUNT(*) FROM gl_journal_lines WHERE journal_id = j.id) AS line_count
       FROM gl_journals j
       ${where}
       ORDER BY j.journal_date DESC, j.id DESC
       LIMIT 500`
    )
    .all(...params);
  res.json(rows);
});

journalRouter.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const journal = db.prepare(`SELECT * FROM gl_journals WHERE id = ?`).get(req.params.id);
  if (!journal) return res.status(404).json({ error: 'Journal not found' });
  const lines = db
    .prepare(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name
       FROM gl_journal_lines jl
       JOIN gl_accounts a ON a.id = jl.account_id
       WHERE jl.journal_id = ?
       ORDER BY jl.sort_order ASC, jl.id ASC`
    )
    .all(req.params.id);
  res.json({ ...journal, lines });
});

journalRouter.post(
  '/',
  authenticateToken,
  validate({ body: GlJournalCreateSchema }),
  (req, res) => {
    const db = getDb();
    const data = req.body;
    try {
      const id = db.transaction(() => {
        return postJournal(db, {
          journal_date: data.journal_date,
          description: data.description,
          source_type: data.source_type || 'manual',
          created_by: req.user?.id,
          lines: data.lines,
        });
      })();
      const journal = db.prepare(`SELECT * FROM gl_journals WHERE id = ?`).get(id);
      res.status(201).json(journal);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// =============================================================
// /api/cash-transfer — transfers between cash/bank accounts
// =============================================================
const cashTransferRouter = express.Router();

cashTransferRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT j.id AS journal_id, j.journal_no, j.journal_date, j.description, j.total_amount,
              j.source_id,
              (SELECT account_id FROM gl_journal_lines WHERE journal_id = j.id AND credit > 0 LIMIT 1) AS from_account_id,
              (SELECT account_id FROM gl_journal_lines WHERE journal_id = j.id AND debit > 0 ORDER BY id LIMIT 1) AS to_account_id
       FROM gl_journals j
       WHERE j.source_type = 'transfer'
       ORDER BY j.journal_date DESC, j.id DESC
       LIMIT 200`
    )
    .all();
  res.json(rows);
});

cashTransferRouter.post(
  '/',
  authenticateToken,
  validate({ body: CashTransferCreateSchema }),
  (req, res) => {
    const db = getDb();
    const data = req.body;
    try {
      const journalId = db.transaction(() => {
        const lines = [
          {
            account_id: data.to_account_id,
            debit: data.amount,
            credit: 0,
            description: 'Transfer in',
          },
          {
            account_id: data.from_account_id,
            debit: 0,
            credit: data.amount + (data.fee || 0),
            description: 'Transfer out',
          },
        ];
        if ((data.fee || 0) > 0 && data.fee_account_id) {
          lines.push({
            account_id: data.fee_account_id,
            debit: data.fee,
            credit: 0,
            description: 'Bank fee',
          });
        }
        return postJournal(db, {
          journal_date: data.transfer_date,
          description: data.description || 'Cash transfer',
          source_type: 'transfer',
          created_by: req.user?.id,
          lines,
        });
      })();
      res.status(201).json({
        journal_id: journalId,
        ...data,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// =============================================================
// /api/income — manual income (Penerimaan)
// =============================================================
const incomeRouter = express.Router();

incomeRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push('income_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('income_date <= ?');
    params.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT i.*,
              ca.code AS cash_account_code, ca.name AS cash_account_name,
              ra.code AS revenue_account_code, ra.name AS revenue_account_name
       FROM gl_incomes i
       LEFT JOIN gl_accounts ca ON ca.id = i.cash_account_id
       LEFT JOIN gl_accounts ra ON ra.id = i.revenue_account_id
       ${where}
       ORDER BY i.income_date DESC, i.id DESC`
    )
    .all(...params);
  res.json(rows);
});

incomeRouter.post('/', authenticateToken, validate({ body: IncomeCreateSchema }), (req, res) => {
  const db = getDb();
  const data = req.body;
  try {
    const id = db.transaction(() => {
      const refNo = generateRefNo(db, 'gl_incomes', 'INC', 'income_date', data.income_date);
      const journalId = postJournal(db, {
        journal_date: data.income_date,
        description: data.description || `Income ${refNo}`,
        source_type: 'income',
        created_by: req.user?.id,
        lines: [
          { account_id: data.cash_account_id, debit: data.amount, credit: 0 },
          { account_id: data.revenue_account_id, debit: 0, credit: data.amount },
        ],
      });
      const result = db
        .prepare(
          `INSERT INTO gl_incomes
             (ref_no, income_date, source_type, customer_id, source_other, category, amount,
              cash_account_id, revenue_account_id, tax_amount, description, attachment, journal_id, created_by)
           VALUES
             (@ref_no, @income_date, @source_type, @customer_id, @source_other, @category, @amount,
              @cash_account_id, @revenue_account_id, @tax_amount, @description, @attachment, @journal_id, @created_by)`
        )
        .run({
          ...data,
          ref_no: refNo,
          customer_id: data.customer_id || null,
          source_other: data.source_other || null,
          category: data.category || null,
          description: data.description || null,
          attachment: data.attachment || null,
          journal_id: journalId,
          created_by: req.user?.id || null,
        });
      // Update journal source_id once known.
      db.prepare(`UPDATE gl_journals SET source_id = ? WHERE id = ?`).run(
        result.lastInsertRowid,
        journalId
      );
      return result.lastInsertRowid;
    })();
    const row = db.prepare(`SELECT * FROM gl_incomes WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

incomeRouter.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM gl_incomes WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare(`DELETE FROM gl_incomes WHERE id = ?`).run(req.params.id);
    if (row.journal_id) {
      db.prepare(`DELETE FROM gl_journals WHERE id = ?`).run(row.journal_id);
    }
  })();
  res.json({ success: true });
});

// =============================================================
// /api/expense — manual expense (Pengeluaran)
// =============================================================
const expenseRouter = express.Router();

expenseRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { from, to, vendor_id } = req.query;
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push('e.expense_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('e.expense_date <= ?');
    params.push(to);
  }
  if (vendor_id) {
    conditions.push('e.vendor_id = ?');
    params.push(vendor_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT e.*, v.name AS vendor_name,
              ea.code AS expense_account_code, ea.name AS expense_account_name,
              pa.code AS payment_account_code, pa.name AS payment_account_name
       FROM gl_expenses e
       LEFT JOIN gl_vendors v ON v.id = e.vendor_id
       LEFT JOIN gl_accounts ea ON ea.id = e.expense_account_id
       LEFT JOIN gl_accounts pa ON pa.id = e.payment_account_id
       ${where}
       ORDER BY e.expense_date DESC, e.id DESC`
    )
    .all(...params);
  res.json(rows);
});

expenseRouter.post('/', authenticateToken, validate({ body: ExpenseCreateSchema }), (req, res) => {
  const db = getDb();
  const data = req.body;
  try {
    const id = db.transaction(() => {
      const refNo = generateRefNo(db, 'gl_expenses', 'EXP', 'expense_date', data.expense_date);
      const journalId = postJournal(db, {
        journal_date: data.expense_date,
        description: data.description || `Expense ${refNo}`,
        source_type: 'expense',
        created_by: req.user?.id,
        lines: [
          { account_id: data.expense_account_id, debit: data.amount, credit: 0 },
          { account_id: data.payment_account_id, debit: 0, credit: data.amount },
        ],
      });
      const result = db
        .prepare(
          `INSERT INTO gl_expenses
             (ref_no, expense_date, vendor_id, expense_account_id, payment_account_id,
              amount, tax_amount, description, attachment, is_recurring, journal_id, created_by)
           VALUES
             (@ref_no, @expense_date, @vendor_id, @expense_account_id, @payment_account_id,
              @amount, @tax_amount, @description, @attachment, @is_recurring, @journal_id, @created_by)`
        )
        .run({
          ...data,
          ref_no: refNo,
          vendor_id: data.vendor_id || null,
          description: data.description || null,
          attachment: data.attachment || null,
          journal_id: journalId,
          created_by: req.user?.id || null,
        });
      db.prepare(`UPDATE gl_journals SET source_id = ? WHERE id = ?`).run(
        result.lastInsertRowid,
        journalId
      );
      return result.lastInsertRowid;
    })();
    const row = db.prepare(`SELECT * FROM gl_expenses WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

expenseRouter.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM gl_expenses WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare(`DELETE FROM gl_expenses WHERE id = ?`).run(req.params.id);
    if (row.journal_id) {
      db.prepare(`DELETE FROM gl_journals WHERE id = ?`).run(row.journal_id);
    }
  })();
  res.json({ success: true });
});

// =============================================================
// /api/recurring-bill
// =============================================================
const recurringBillRouter = express.Router();

recurringBillRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT rb.*, v.name AS vendor_name,
              ea.code AS expense_account_code, ea.name AS expense_account_name
       FROM gl_recurring_bills rb
       LEFT JOIN gl_vendors v ON v.id = rb.vendor_id
       LEFT JOIN gl_accounts ea ON ea.id = rb.expense_account_id
       ORDER BY rb.id DESC`
    )
    .all();
  res.json(rows);
});

recurringBillRouter.post(
  '/',
  authenticateToken,
  validate({ body: RecurringBillCreateSchema }),
  (req, res) => {
    const db = getDb();
    const data = req.body;
    const result = db
      .prepare(
        `INSERT INTO gl_recurring_bills
           (name, vendor_id, expense_account_id, payment_account_id, amount, frequency, due_day, is_active)
         VALUES (@name, @vendor_id, @expense_account_id, @payment_account_id, @amount, @frequency, @due_day, @is_active)`
      )
      .run({
        ...data,
        vendor_id: data.vendor_id || null,
        payment_account_id: data.payment_account_id || null,
      });
    const row = db
      .prepare(`SELECT * FROM gl_recurring_bills WHERE id = ?`)
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  }
);

recurringBillRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: RecurringBillUpdateSchema }),
  (req, res) => {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM gl_recurring_bills WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = { ...existing, ...req.body };
    db.prepare(
      `UPDATE gl_recurring_bills SET
         name=@name, vendor_id=@vendor_id, expense_account_id=@expense_account_id,
         payment_account_id=@payment_account_id, amount=@amount, frequency=@frequency,
         due_day=@due_day, is_active=@is_active, updated_at=CURRENT_TIMESTAMP
       WHERE id=@id`
    ).run({ ...merged, id: req.params.id });
    res.json(db.prepare(`SELECT * FROM gl_recurring_bills WHERE id = ?`).get(req.params.id));
  }
);

recurringBillRouter.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM gl_recurring_bills WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// =============================================================
// /api/vendor — Daftar Mitra
// =============================================================
const vendorRouter = express.Router();

vendorRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM gl_vendors ORDER BY name ASC`).all();
  res.json(rows);
});

vendorRouter.post('/', authenticateToken, validate({ body: VendorCreateSchema }), (req, res) => {
  const db = getDb();
  const data = req.body;
  const code = data.code || generateVendorCode(db);
  try {
    const result = db
      .prepare(
        `INSERT INTO gl_vendors
           (code, name, npwp, address, phone, email, bank_name, bank_account_no, bank_account_holder,
            default_account_id, payment_terms_days, is_active, note)
         VALUES (@code, @name, @npwp, @address, @phone, @email, @bank_name, @bank_account_no, @bank_account_holder,
                 @default_account_id, @payment_terms_days, @is_active, @note)`
      )
      .run({
        ...data,
        code,
        npwp: data.npwp || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        bank_name: data.bank_name || null,
        bank_account_no: data.bank_account_no || null,
        bank_account_holder: data.bank_account_holder || null,
        default_account_id: data.default_account_id || null,
        note: data.note || null,
      });
    res
      .status(201)
      .json(db.prepare(`SELECT * FROM gl_vendors WHERE id = ?`).get(result.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Vendor code already exists' });
    }
    throw err;
  }
});

vendorRouter.put('/:id', authenticateToken, validate({ body: VendorUpdateSchema }), (req, res) => {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM gl_vendors WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE gl_vendors SET
       code=@code, name=@name, npwp=@npwp, address=@address, phone=@phone, email=@email,
       bank_name=@bank_name, bank_account_no=@bank_account_no, bank_account_holder=@bank_account_holder,
       default_account_id=@default_account_id, payment_terms_days=@payment_terms_days,
       is_active=@is_active, note=@note, updated_at=CURRENT_TIMESTAMP
     WHERE id=@id`
  ).run({ ...merged, id: req.params.id });
  res.json(db.prepare(`SELECT * FROM gl_vendors WHERE id = ?`).get(req.params.id));
});

vendorRouter.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM gl_vendors WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// =============================================================
// /api/fixed-asset
// =============================================================
const fixedAssetRouter = express.Router();

fixedAssetRouter.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT fa.*, v.name AS vendor_name
       FROM gl_fixed_assets fa
       LEFT JOIN gl_vendors v ON v.id = fa.vendor_id
       ORDER BY fa.acquisition_date DESC, fa.id DESC`
    )
    .all();
  res.json(rows);
});

fixedAssetRouter.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM gl_fixed_assets WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const depreciations = db
    .prepare(
      `SELECT * FROM gl_fixed_asset_depreciations WHERE asset_id = ? ORDER BY period_year, period_month`
    )
    .all(req.params.id);
  const disposal = db
    .prepare(`SELECT * FROM gl_fixed_asset_disposals WHERE asset_id = ?`)
    .get(req.params.id);
  res.json({ ...row, depreciations, disposal });
});

fixedAssetRouter.post(
  '/',
  authenticateToken,
  validate({ body: FixedAssetCreateSchema }),
  (req, res) => {
    const db = getDb();
    const data = req.body;
    try {
      const id = db.transaction(() => {
        const code = generateAssetCode(db);
        let acquisitionJournalId = null;
        if (data.payment_account_id) {
          acquisitionJournalId = postJournal(db, {
            journal_date: data.acquisition_date,
            description: `Akuisisi ${code} ${data.name}`,
            source_type: 'manual',
            created_by: req.user?.id,
            lines: [
              { account_id: data.asset_account_id, debit: data.cost, credit: 0 },
              { account_id: data.payment_account_id, debit: 0, credit: data.cost },
            ],
          });
        }
        const result = db
          .prepare(
            `INSERT INTO gl_fixed_assets
               (code, name, category, acquisition_date, cost, useful_life_years, salvage_value,
                depreciation_method, location, vendor_id, photo_url,
                asset_account_id, accum_dep_account_id, dep_expense_account_id, payment_account_id,
                acquisition_journal_id)
             VALUES
               (@code, @name, @category, @acquisition_date, @cost, @useful_life_years, @salvage_value,
                @depreciation_method, @location, @vendor_id, @photo_url,
                @asset_account_id, @accum_dep_account_id, @dep_expense_account_id, @payment_account_id,
                @acquisition_journal_id)`
          )
          .run({
            ...data,
            code,
            category: data.category || null,
            location: data.location || null,
            vendor_id: data.vendor_id || null,
            photo_url: data.photo_url || null,
            payment_account_id: data.payment_account_id || null,
            acquisition_journal_id: acquisitionJournalId,
          });
        if (acquisitionJournalId) {
          db.prepare(`UPDATE gl_journals SET source_id = ? WHERE id = ?`).run(
            result.lastInsertRowid,
            acquisitionJournalId
          );
        }
        return result.lastInsertRowid;
      })();
      res.status(201).json(db.prepare(`SELECT * FROM gl_fixed_assets WHERE id = ?`).get(id));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

fixedAssetRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: FixedAssetUpdateSchema }),
  (req, res) => {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM gl_fixed_assets WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status === 'disposed') {
      return res.status(400).json({ error: 'Cannot edit disposed asset' });
    }
    const merged = { ...existing, ...req.body };
    db.prepare(
      `UPDATE gl_fixed_assets SET
         name=@name, category=@category, useful_life_years=@useful_life_years,
         salvage_value=@salvage_value, depreciation_method=@depreciation_method,
         location=@location, vendor_id=@vendor_id, photo_url=@photo_url,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=@id`
    ).run({
      ...merged,
      category: merged.category || null,
      location: merged.location || null,
      vendor_id: merged.vendor_id || null,
      photo_url: merged.photo_url || null,
      id: req.params.id,
    });
    res.json(db.prepare(`SELECT * FROM gl_fixed_assets WHERE id = ?`).get(req.params.id));
  }
);

fixedAssetRouter.delete('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const used = db
    .prepare(`SELECT 1 FROM gl_fixed_asset_depreciations WHERE asset_id = ? LIMIT 1`)
    .get(req.params.id);
  if (used) {
    return res.status(400).json({ error: 'Asset sudah punya depresiasi — gunakan disposal' });
  }
  db.prepare(`DELETE FROM gl_fixed_assets WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// Calculate monthly depreciation for an asset (returns the amount but doesn't post).
function calcMonthlyDepreciation(asset) {
  const depreciableBase = Number(asset.cost) - Number(asset.salvage_value);
  if (asset.depreciation_method === 'STRAIGHT_LINE') {
    const months = Number(asset.useful_life_years) * 12;
    return Math.max(0, depreciableBase / months);
  }
  // DOUBLE_DECLINING — naive monthly approximation against current NBV.
  const annualRate = 2 / Number(asset.useful_life_years);
  const nbv = Number(asset.cost) - Number(asset.accumulated_depreciation);
  const annualDep = nbv * annualRate;
  return Math.max(0, annualDep / 12);
}

fixedAssetRouter.post(
  '/depreciate',
  authenticateToken,
  validate({ body: DepreciationRunSchema }),
  (req, res) => {
    const db = getDb();
    const { year, month, asset_ids } = req.body;
    const periodEndDate = new Date(year, month, 0).toISOString().slice(0, 10);
    const eligibleQuery =
      `SELECT * FROM gl_fixed_assets WHERE status = 'active'` +
      (asset_ids && asset_ids.length ? ` AND id IN (${asset_ids.map(() => '?').join(',')})` : '');
    const assets = db.prepare(eligibleQuery).all(...(asset_ids || []));

    const results = [];
    db.transaction(() => {
      for (const asset of assets) {
        const exists = db
          .prepare(
            `SELECT 1 FROM gl_fixed_asset_depreciations WHERE asset_id = ? AND period_year = ? AND period_month = ?`
          )
          .get(asset.id, year, month);
        if (exists) continue;
        const amount = calcMonthlyDepreciation(asset);
        if (amount <= 0) continue;
        const journalId = postJournal(db, {
          journal_date: periodEndDate,
          description: `Penyusutan ${asset.code} ${asset.name} ${year}-${String(month).padStart(2, '0')}`,
          source_type: 'depreciation',
          created_by: req.user?.id,
          lines: [
            { account_id: asset.dep_expense_account_id, debit: amount, credit: 0 },
            { account_id: asset.accum_dep_account_id, debit: 0, credit: amount },
          ],
        });
        const insertResult = db
          .prepare(
            `INSERT INTO gl_fixed_asset_depreciations (asset_id, period_year, period_month, amount, journal_id)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(asset.id, year, month, amount, journalId);
        db.prepare(
          `UPDATE gl_fixed_assets SET accumulated_depreciation = accumulated_depreciation + ? WHERE id = ?`
        ).run(amount, asset.id);
        db.prepare(`UPDATE gl_journals SET source_id = ? WHERE id = ?`).run(
          insertResult.lastInsertRowid,
          journalId
        );
        results.push({
          asset_id: asset.id,
          asset_code: asset.code,
          amount,
          journal_id: journalId,
        });
      }
    })();
    res.json({ year, month, count: results.length, items: results });
  }
);

fixedAssetRouter.post(
  '/:id/dispose',
  authenticateToken,
  validate({ body: FixedAssetDisposalSchema }),
  (req, res) => {
    const db = getDb();
    const asset = db.prepare(`SELECT * FROM gl_fixed_assets WHERE id = ?`).get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Not found' });
    if (asset.status === 'disposed') {
      return res.status(400).json({ error: 'Asset sudah disposed' });
    }
    const data = req.body;
    try {
      db.transaction(() => {
        const nbv = Number(asset.cost) - Number(asset.accumulated_depreciation);
        const proceeds = Number(data.proceeds) || 0;
        const gainLoss = proceeds - nbv;
        const lines = [];
        if (proceeds > 0 && data.proceeds_account_id) {
          lines.push({
            account_id: data.proceeds_account_id,
            debit: proceeds,
            credit: 0,
            description: 'Proceeds disposal',
          });
        }
        // Hapus akumulasi penyusutan (debit ke akumulasi).
        if (asset.accumulated_depreciation > 0) {
          lines.push({
            account_id: asset.accum_dep_account_id,
            debit: Number(asset.accumulated_depreciation),
            credit: 0,
            description: 'Reverse accumulated depreciation',
          });
        }
        // Cr aset pada cost.
        lines.push({
          account_id: asset.asset_account_id,
          debit: 0,
          credit: Number(asset.cost),
          description: 'Hapus aset',
        });
        // Gain/loss balancer.
        if (gainLoss > 0) {
          // Gain: Cr Pendapatan Lain.
          const gainAcc = db.prepare(`SELECT id FROM gl_accounts WHERE code = '4910'`).get();
          if (gainAcc) {
            lines.push({
              account_id: gainAcc.id,
              debit: 0,
              credit: gainLoss,
              description: 'Laba disposal',
            });
          }
        } else if (gainLoss < 0) {
          const lossAcc = db.prepare(`SELECT id FROM gl_accounts WHERE code = '5910'`).get();
          if (lossAcc) {
            lines.push({
              account_id: lossAcc.id,
              debit: -gainLoss,
              credit: 0,
              description: 'Rugi disposal',
            });
          }
        }
        const journalId = postJournal(db, {
          journal_date: data.disposal_date,
          description: `Disposal ${asset.code} ${asset.name} (${data.disposal_type})`,
          source_type: 'disposal',
          source_id: asset.id,
          created_by: req.user?.id,
          lines,
        });
        db.prepare(
          `INSERT INTO gl_fixed_asset_disposals
             (asset_id, disposal_date, disposal_type, proceeds, buyer, gain_loss, proceeds_account_id, journal_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          asset.id,
          data.disposal_date,
          data.disposal_type,
          proceeds,
          data.buyer || null,
          gainLoss,
          data.proceeds_account_id || null,
          journalId
        );
        db.prepare(`UPDATE gl_fixed_assets SET status = 'disposed' WHERE id = ?`).run(asset.id);
      })();
      res.json({ success: true, asset_id: asset.id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// =============================================================
// /api/financial-report
// =============================================================
const reportRouter = express.Router();

reportRouter.get('/journal', authenticateToken, (req, res) => {
  const db = getDb();
  const { from, to, account_id } = req.query;
  const conditions = [];
  const params = [];
  if (from) {
    conditions.push('j.journal_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('j.journal_date <= ?');
    params.push(to);
  }
  if (account_id) {
    conditions.push('jl.account_id = ?');
    params.push(account_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT j.id, j.journal_no, j.journal_date, j.description, j.source_type,
              jl.id AS line_id, jl.debit, jl.credit, jl.description AS line_description,
              a.code AS account_code, a.name AS account_name
       FROM gl_journals j
       JOIN gl_journal_lines jl ON jl.journal_id = j.id
       JOIN gl_accounts a ON a.id = jl.account_id
       ${where}
       ORDER BY j.journal_date ASC, j.id ASC, jl.sort_order ASC`
    )
    .all(...params);
  res.json(rows);
});

reportRouter.get('/general-ledger', authenticateToken, (req, res) => {
  const db = getDb();
  const { account_id, from, to } = req.query;
  if (!account_id) return res.status(400).json({ error: 'account_id required' });
  const acc = db.prepare(`SELECT * FROM gl_accounts WHERE id = ?`).get(account_id);
  if (!acc) return res.status(404).json({ error: 'Account not found' });
  // Reuse account ledger logic.
  const conditions = ['jl.account_id = ?'];
  const params = [account_id];
  if (from) {
    conditions.push('j.journal_date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('j.journal_date <= ?');
    params.push(to);
  }
  const lines = db
    .prepare(
      `SELECT jl.id, j.journal_no, j.journal_date, j.description AS journal_description,
              j.source_type, jl.debit, jl.credit, jl.description
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY j.journal_date ASC, jl.id ASC`
    )
    .all(...params);
  let runningBalance = Number(acc.opening_balance) || 0;
  const enriched = lines.map((l) => {
    if (acc.normal_balance === 'debit') {
      runningBalance += Number(l.debit) - Number(l.credit);
    } else {
      runningBalance += Number(l.credit) - Number(l.debit);
    }
    return { ...l, balance: runningBalance };
  });
  res.json({
    account: acc,
    opening_balance: Number(acc.opening_balance) || 0,
    lines: enriched,
    closing_balance: runningBalance,
  });
});

reportRouter.get('/balance-sheet', authenticateToken, (req, res) => {
  const db = getDb();
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
  const accounts = db
    .prepare(`SELECT * FROM gl_accounts WHERE is_active = 1 ORDER BY code ASC`)
    .all();
  const sections = { ASET: [], KEWAJIBAN: [], MODAL: [] };
  let totalAset = 0,
    totalKewajiban = 0,
    totalModal = 0;
  for (const acc of accounts) {
    if (!['ASET', 'KEWAJIBAN', 'MODAL'].includes(acc.type)) continue;
    if (acc.subtype === 'header') continue;
    const balance = getAccountBalance(db, acc.id, asOf);
    if (balance === 0 && acc.opening_balance === 0) continue;
    sections[acc.type].push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      subtype: acc.subtype,
      balance,
    });
    if (acc.type === 'ASET') totalAset += balance;
    else if (acc.type === 'KEWAJIBAN') totalKewajiban += balance;
    else if (acc.type === 'MODAL') totalModal += balance;
  }
  // Sertakan laba berjalan (sum 4xxx - 5xxx s/d as_of).
  const periodPnL = computePeriodPnL(db, '0001-01-01', asOf);
  totalModal += periodPnL.net_income;
  res.json({
    as_of: asOf,
    aset: sections.ASET,
    kewajiban: sections.KEWAJIBAN,
    modal: sections.MODAL,
    total_aset: totalAset,
    total_kewajiban: totalKewajiban,
    total_modal: totalModal,
    laba_tahun_berjalan: periodPnL.net_income,
    is_balanced: Math.abs(totalAset - (totalKewajiban + totalModal)) < 0.01,
  });
});

function computePeriodPnL(db, from, to) {
  const accounts = db
    .prepare(`SELECT * FROM gl_accounts WHERE type IN ('PENDAPATAN','BEBAN') ORDER BY code`)
    .all();
  const pendapatan = [];
  const beban = [];
  let totalPendapatan = 0,
    totalBeban = 0;
  for (const acc of accounts) {
    if (acc.subtype === 'header') continue;
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(jl.debit),0) AS d, COALESCE(SUM(jl.credit),0) AS c
         FROM gl_journal_lines jl
         JOIN gl_journals j ON j.id = jl.journal_id
         WHERE jl.account_id = ? AND j.journal_date BETWEEN ? AND ?`
      )
      .get(acc.id, from, to);
    let bal;
    if (acc.normal_balance === 'credit') bal = Number(row.c) - Number(row.d);
    else bal = Number(row.d) - Number(row.c);
    if (bal === 0) continue;
    if (acc.type === 'PENDAPATAN') {
      pendapatan.push({ id: acc.id, code: acc.code, name: acc.name, balance: bal });
      totalPendapatan += bal;
    } else {
      beban.push({ id: acc.id, code: acc.code, name: acc.name, balance: bal });
      totalBeban += bal;
    }
  }
  return {
    pendapatan,
    beban,
    total_pendapatan: totalPendapatan,
    total_beban: totalBeban,
    net_income: totalPendapatan - totalBeban,
  };
}

reportRouter.get('/income-statement', authenticateToken, (req, res) => {
  const db = getDb();
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const result = computePeriodPnL(db, from, to);
  res.json({ from, to, ...result });
});

reportRouter.get('/cash-flow', authenticateToken, (req, res) => {
  // Direct method: sum cash/bank account journal lines per source_type.
  const db = getDb();
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  // Cash accounts = ASET + subtype 'Kas & Bank'
  const cashAccs = db
    .prepare(`SELECT id FROM gl_accounts WHERE type='ASET' AND subtype='Kas & Bank'`)
    .all();
  if (cashAccs.length === 0) {
    return res.json({ from, to, sections: [], net_change: 0, opening: 0, closing: 0 });
  }
  const placeholders = cashAccs.map(() => '?').join(',');
  const cashIds = cashAccs.map((a) => a.id);
  const sources = ['sale', 'income', 'expense', 'transfer', 'payroll', 'manual'];
  const sections = sources.map((src) => {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(jl.debit),0) AS inflow, COALESCE(SUM(jl.credit),0) AS outflow
         FROM gl_journal_lines jl
         JOIN gl_journals j ON j.id = jl.journal_id
         WHERE jl.account_id IN (${placeholders})
           AND j.source_type = ?
           AND j.journal_date BETWEEN ? AND ?`
      )
      .get(...cashIds, src, from, to);
    return {
      source_type: src,
      inflow: Number(row.inflow) || 0,
      outflow: Number(row.outflow) || 0,
      net: (Number(row.inflow) || 0) - (Number(row.outflow) || 0),
    };
  });
  const netChange = sections.reduce((s, x) => s + x.net, 0);
  const opening = cashAccs.reduce(
    (s, a) =>
      s +
      getAccountBalance(
        db,
        a.id,
        new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10)
      ),
    0
  );
  res.json({
    from,
    to,
    sections,
    net_change: netChange,
    opening,
    closing: opening + netChange,
  });
});

reportRouter.get('/ap', authenticateToken, (req, res) => {
  const db = getDb();
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
  const apAccount = db.prepare(`SELECT id FROM gl_accounts WHERE code = '2101'`).get();
  if (!apAccount) return res.json({ as_of: asOf, items: [], total: 0 });
  const balance = getAccountBalance(db, apAccount.id, asOf);
  const recentLines = db
    .prepare(
      `SELECT j.journal_no, j.journal_date, j.description, jl.debit, jl.credit
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE jl.account_id = ? AND j.journal_date <= ?
       ORDER BY j.journal_date DESC LIMIT 100`
    )
    .all(apAccount.id, asOf);
  res.json({ as_of: asOf, account: apAccount, balance, recent_lines: recentLines });
});

reportRouter.get('/ar', authenticateToken, (req, res) => {
  const db = getDb();
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
  const arAccount = db.prepare(`SELECT id FROM gl_accounts WHERE code = '1201'`).get();
  if (!arAccount) return res.json({ as_of: asOf, items: [], total: 0 });
  const balance = getAccountBalance(db, arAccount.id, asOf);
  const recentLines = db
    .prepare(
      `SELECT j.journal_no, j.journal_date, j.description, jl.debit, jl.credit
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE jl.account_id = ? AND j.journal_date <= ?
       ORDER BY j.journal_date DESC LIMIT 100`
    )
    .all(arAccount.id, asOf);
  res.json({ as_of: asOf, account: arAccount, balance, recent_lines: recentLines });
});

module.exports = {
  accountRouter,
  journalRouter,
  cashTransferRouter,
  incomeRouter,
  expenseRouter,
  recurringBillRouter,
  vendorRouter,
  fixedAssetRouter,
  reportRouter,
};
