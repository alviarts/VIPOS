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
const { query, tx } = require('../db');
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

async function generateRefNo(q, table, prefix, dateValue) {
  const ym = (dateValue || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(0, 6);
  const fullPrefix = `${prefix}/${ym}/`;
  const last = (
    await q(`SELECT ref_no FROM ${table} WHERE ref_no LIKE $1 ORDER BY id DESC LIMIT 1`, [
      `${fullPrefix}%`,
    ])
  ).rows[0];
  const seq = last ? Number(last.ref_no.split('/')[2]) + 1 : 1;
  return `${fullPrefix}${String(seq).padStart(5, '0')}`;
}

async function generateVendorCode(q) {
  const last = (
    await q(`SELECT code FROM gl_vendors WHERE code LIKE 'VND%' ORDER BY id DESC LIMIT 1`)
  ).rows[0];
  const seq = last ? Number(last.code.replace('VND', '')) + 1 : 1;
  return `VND${String(seq).padStart(4, '0')}`;
}

async function generateAssetCode(q) {
  const last = (
    await q(`SELECT code FROM gl_fixed_assets WHERE code LIKE 'FA%' ORDER BY id DESC LIMIT 1`)
  ).rows[0];
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

accountRouter.get('/', authenticateToken, async (req, res) => {
  const { type, is_active } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;
  if (type) {
    conditions.push(`type = $${p++}`);
    params.push(type);
  }
  if (is_active !== undefined) {
    conditions.push(`is_active = $${p++}`);
    params.push(Number(is_active));
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = (await query(`SELECT * FROM gl_accounts ${where} ORDER BY code ASC`, params)).rows;
  res.json(rows);
});

accountRouter.get('/:id', authenticateToken, async (req, res) => {
  const row = (await query(`SELECT * FROM gl_accounts WHERE id = $1`, [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Account not found' });
  const balance = await getAccountBalance(query, row.id);
  res.json({ ...row, current_balance: balance });
});

accountRouter.post(
  '/',
  authenticateToken,
  validate({ body: GlAccountCreateSchema }),
  async (req, res) => {
    const data = req.body;
    const exists = (await query(`SELECT id FROM gl_accounts WHERE code = $1`, [data.code])).rows[0];
    if (exists) return res.status(409).json({ error: 'Account code already exists' });
    const ins = await query(
      `INSERT INTO gl_accounts (code, name, type, subtype, parent_id, normal_balance, opening_balance, is_active, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        data.code,
        data.name,
        data.type,
        data.subtype || null,
        data.parent_id || null,
        NORMAL_BALANCE[data.type],
        data.opening_balance,
        data.is_active,
        data.description || null,
      ]
    );
    const row = (await query(`SELECT * FROM gl_accounts WHERE id = $1`, [ins.rows[0].id])).rows[0];
    res.status(201).json(row);
  }
);

accountRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: GlAccountUpdateSchema }),
  async (req, res) => {
    const existing = (await query(`SELECT * FROM gl_accounts WHERE id = $1`, [req.params.id]))
      .rows[0];
    if (!existing) return res.status(404).json({ error: 'Account not found' });
    const data = req.body;
    const merged = { ...existing, ...data };
    const nb = data.type ? NORMAL_BALANCE[data.type] : existing.normal_balance;
    await query(
      `UPDATE gl_accounts SET
         code=$1, name=$2, type=$3, subtype=$4, parent_id=$5,
         normal_balance=$6, opening_balance=$7, is_active=$8,
         description=$9, updated_at=CURRENT_TIMESTAMP
       WHERE id=$10`,
      [
        merged.code,
        merged.name,
        merged.type,
        merged.subtype || null,
        merged.parent_id || null,
        nb,
        merged.opening_balance,
        merged.is_active,
        merged.description || null,
        req.params.id,
      ]
    );
    const row = (await query(`SELECT * FROM gl_accounts WHERE id = $1`, [req.params.id])).rows[0];
    res.json(row);
  }
);

accountRouter.delete('/:id', authenticateToken, async (req, res) => {
  const used = (
    await query(`SELECT 1 AS x FROM gl_journal_lines WHERE account_id = $1 LIMIT 1`, [
      req.params.id,
    ])
  ).rows[0];
  if (used) {
    return res
      .status(400)
      .json({ error: 'Akun sudah terpakai di journal — tidak bisa dihapus, set is_active=0 saja' });
  }
  await query(`DELETE FROM gl_accounts WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

accountRouter.get('/:id/ledger', authenticateToken, async (req, res) => {
  const acc = (await query(`SELECT * FROM gl_accounts WHERE id = $1`, [req.params.id])).rows[0];
  if (!acc) return res.status(404).json({ error: 'Account not found' });
  const { from, to } = req.query;
  const conditions = [`jl.account_id = $1`];
  const params = [req.params.id];
  let p = 2;
  if (from) {
    conditions.push(`j.journal_date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`j.journal_date <= $${p++}`);
    params.push(to);
  }
  const lines = (
    await query(
      `SELECT jl.id, j.journal_no, j.journal_date, j.description AS journal_description,
              j.source_type, jl.debit, jl.credit, jl.description
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY j.journal_date ASC, jl.id ASC`,
      params
    )
  ).rows;
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

journalRouter.get('/', authenticateToken, async (req, res) => {
  const { from, to, source_type, account_id } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;
  if (from) {
    conditions.push(`j.journal_date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`j.journal_date <= $${p++}`);
    params.push(to);
  }
  if (source_type) {
    conditions.push(`j.source_type = $${p++}`);
    params.push(source_type);
  }
  if (account_id) {
    conditions.push(
      `EXISTS (SELECT 1 FROM gl_journal_lines jl WHERE jl.journal_id = j.id AND jl.account_id = $${p++})`
    );
    params.push(account_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = (
    await query(
      `SELECT j.*, (SELECT COUNT(*) FROM gl_journal_lines WHERE journal_id = j.id) AS line_count
       FROM gl_journals j
       ${where}
       ORDER BY j.journal_date DESC, j.id DESC
       LIMIT 500`,
      params
    )
  ).rows;
  res.json(rows);
});

journalRouter.get('/:id', authenticateToken, async (req, res) => {
  const journal = (await query(`SELECT * FROM gl_journals WHERE id = $1`, [req.params.id])).rows[0];
  if (!journal) return res.status(404).json({ error: 'Journal not found' });
  const lines = (
    await query(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name
       FROM gl_journal_lines jl
       JOIN gl_accounts a ON a.id = jl.account_id
       WHERE jl.journal_id = $1
       ORDER BY jl.sort_order ASC, jl.id ASC`,
      [req.params.id]
    )
  ).rows;
  res.json({ ...journal, lines });
});

journalRouter.post(
  '/',
  authenticateToken,
  validate({ body: GlJournalCreateSchema }),
  async (req, res) => {
    const data = req.body;
    try {
      const id = await tx(async (txQuery) => {
        return postJournal(txQuery, {
          journal_date: data.journal_date,
          description: data.description,
          source_type: data.source_type || 'manual',
          created_by: req.user?.id,
          lines: data.lines,
        });
      });
      const journal = (await query(`SELECT * FROM gl_journals WHERE id = $1`, [id])).rows[0];
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

cashTransferRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT j.id AS journal_id, j.journal_no, j.journal_date, j.description, j.total_amount,
              j.source_id,
              (SELECT account_id FROM gl_journal_lines WHERE journal_id = j.id AND credit > 0 LIMIT 1) AS from_account_id,
              (SELECT account_id FROM gl_journal_lines WHERE journal_id = j.id AND debit > 0 ORDER BY id LIMIT 1) AS to_account_id
       FROM gl_journals j
       WHERE j.source_type = 'transfer'
       ORDER BY j.journal_date DESC, j.id DESC
       LIMIT 200`
    )
  ).rows;
  res.json(rows);
});

cashTransferRouter.post(
  '/',
  authenticateToken,
  validate({ body: CashTransferCreateSchema }),
  async (req, res) => {
    const data = req.body;
    try {
      const journalId = await tx(async (txQuery) => {
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
        return postJournal(txQuery, {
          journal_date: data.transfer_date,
          description: data.description || 'Cash transfer',
          source_type: 'transfer',
          created_by: req.user?.id,
          lines,
        });
      });
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

incomeRouter.get('/', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;
  if (from) {
    conditions.push(`income_date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`income_date <= $${p++}`);
    params.push(to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = (
    await query(
      `SELECT i.*,
              ca.code AS cash_account_code, ca.name AS cash_account_name,
              ra.code AS revenue_account_code, ra.name AS revenue_account_name
       FROM gl_incomes i
       LEFT JOIN gl_accounts ca ON ca.id = i.cash_account_id
       LEFT JOIN gl_accounts ra ON ra.id = i.revenue_account_id
       ${where}
       ORDER BY i.income_date DESC, i.id DESC`,
      params
    )
  ).rows;
  res.json(rows);
});

incomeRouter.post(
  '/',
  authenticateToken,
  validate({ body: IncomeCreateSchema }),
  async (req, res) => {
    const data = req.body;
    try {
      const id = await tx(async (txQuery) => {
        const refNo = await generateRefNo(txQuery, 'gl_incomes', 'INC', data.income_date);
        const journalId = await postJournal(txQuery, {
          journal_date: data.income_date,
          description: data.description || `Income ${refNo}`,
          source_type: 'income',
          created_by: req.user?.id,
          lines: [
            { account_id: data.cash_account_id, debit: data.amount, credit: 0 },
            { account_id: data.revenue_account_id, debit: 0, credit: data.amount },
          ],
        });
        const ins = await txQuery(
          `INSERT INTO gl_incomes
             (ref_no, income_date, source_type, customer_id, source_other, category, amount,
              cash_account_id, revenue_account_id, tax_amount, description, attachment, journal_id, created_by)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
          [
            refNo,
            data.income_date,
            data.source_type,
            data.customer_id || null,
            data.source_other || null,
            data.category || null,
            data.amount,
            data.cash_account_id,
            data.revenue_account_id,
            data.tax_amount,
            data.description || null,
            data.attachment || null,
            journalId,
            req.user?.id || null,
          ]
        );
        const newId = ins.rows[0].id;
        await txQuery(`UPDATE gl_journals SET source_id = $1 WHERE id = $2`, [newId, journalId]);
        return newId;
      });
      const row = (await query(`SELECT * FROM gl_incomes WHERE id = $1`, [id])).rows[0];
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

incomeRouter.delete('/:id', authenticateToken, async (req, res) => {
  const row = (await query(`SELECT * FROM gl_incomes WHERE id = $1`, [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  await tx(async (txQuery) => {
    await txQuery(`DELETE FROM gl_incomes WHERE id = $1`, [req.params.id]);
    if (row.journal_id) {
      await txQuery(`DELETE FROM gl_journals WHERE id = $1`, [row.journal_id]);
    }
  });
  res.json({ success: true });
});

// =============================================================
// /api/expense — manual expense (Pengeluaran)
// =============================================================
const expenseRouter = express.Router();

expenseRouter.get('/', authenticateToken, async (req, res) => {
  const { from, to, vendor_id } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;
  if (from) {
    conditions.push(`e.expense_date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`e.expense_date <= $${p++}`);
    params.push(to);
  }
  if (vendor_id) {
    conditions.push(`e.vendor_id = $${p++}`);
    params.push(vendor_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = (
    await query(
      `SELECT e.*, v.name AS vendor_name,
              ea.code AS expense_account_code, ea.name AS expense_account_name,
              pa.code AS payment_account_code, pa.name AS payment_account_name
       FROM gl_expenses e
       LEFT JOIN gl_vendors v ON v.id = e.vendor_id
       LEFT JOIN gl_accounts ea ON ea.id = e.expense_account_id
       LEFT JOIN gl_accounts pa ON pa.id = e.payment_account_id
       ${where}
       ORDER BY e.expense_date DESC, e.id DESC`,
      params
    )
  ).rows;
  res.json(rows);
});

expenseRouter.post(
  '/',
  authenticateToken,
  validate({ body: ExpenseCreateSchema }),
  async (req, res) => {
    const data = req.body;
    try {
      const id = await tx(async (txQuery) => {
        const refNo = await generateRefNo(txQuery, 'gl_expenses', 'EXP', data.expense_date);
        const journalId = await postJournal(txQuery, {
          journal_date: data.expense_date,
          description: data.description || `Expense ${refNo}`,
          source_type: 'expense',
          created_by: req.user?.id,
          lines: [
            { account_id: data.expense_account_id, debit: data.amount, credit: 0 },
            { account_id: data.payment_account_id, debit: 0, credit: data.amount },
          ],
        });
        const ins = await txQuery(
          `INSERT INTO gl_expenses
             (ref_no, expense_date, vendor_id, expense_account_id, payment_account_id,
              amount, tax_amount, description, attachment, is_recurring, journal_id, created_by)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
          [
            refNo,
            data.expense_date,
            data.vendor_id || null,
            data.expense_account_id,
            data.payment_account_id,
            data.amount,
            data.tax_amount,
            data.description || null,
            data.attachment || null,
            data.is_recurring,
            journalId,
            req.user?.id || null,
          ]
        );
        const newId = ins.rows[0].id;
        await txQuery(`UPDATE gl_journals SET source_id = $1 WHERE id = $2`, [newId, journalId]);
        return newId;
      });
      const row = (await query(`SELECT * FROM gl_expenses WHERE id = $1`, [id])).rows[0];
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

expenseRouter.delete('/:id', authenticateToken, async (req, res) => {
  const row = (await query(`SELECT * FROM gl_expenses WHERE id = $1`, [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  await tx(async (txQuery) => {
    await txQuery(`DELETE FROM gl_expenses WHERE id = $1`, [req.params.id]);
    if (row.journal_id) {
      await txQuery(`DELETE FROM gl_journals WHERE id = $1`, [row.journal_id]);
    }
  });
  res.json({ success: true });
});

// =============================================================
// /api/recurring-bill
// =============================================================
const recurringBillRouter = express.Router();

recurringBillRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT rb.*, v.name AS vendor_name,
              ea.code AS expense_account_code, ea.name AS expense_account_name
       FROM gl_recurring_bills rb
       LEFT JOIN gl_vendors v ON v.id = rb.vendor_id
       LEFT JOIN gl_accounts ea ON ea.id = rb.expense_account_id
       ORDER BY rb.id DESC`
    )
  ).rows;
  res.json(rows);
});

recurringBillRouter.post(
  '/',
  authenticateToken,
  validate({ body: RecurringBillCreateSchema }),
  async (req, res) => {
    const data = req.body;
    const ins = await query(
      `INSERT INTO gl_recurring_bills
         (name, vendor_id, expense_account_id, payment_account_id, amount, frequency, due_day, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        data.name,
        data.vendor_id || null,
        data.expense_account_id,
        data.payment_account_id || null,
        data.amount,
        data.frequency,
        data.due_day,
        data.is_active,
      ]
    );
    const row = (await query(`SELECT * FROM gl_recurring_bills WHERE id = $1`, [ins.rows[0].id]))
      .rows[0];
    res.status(201).json(row);
  }
);

recurringBillRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: RecurringBillUpdateSchema }),
  async (req, res) => {
    const existing = (
      await query(`SELECT * FROM gl_recurring_bills WHERE id = $1`, [req.params.id])
    ).rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = { ...existing, ...req.body };
    await query(
      `UPDATE gl_recurring_bills SET
         name=$1, vendor_id=$2, expense_account_id=$3,
         payment_account_id=$4, amount=$5, frequency=$6,
         due_day=$7, is_active=$8, updated_at=CURRENT_TIMESTAMP
       WHERE id=$9`,
      [
        merged.name,
        merged.vendor_id,
        merged.expense_account_id,
        merged.payment_account_id,
        merged.amount,
        merged.frequency,
        merged.due_day,
        merged.is_active,
        req.params.id,
      ]
    );
    const row = (await query(`SELECT * FROM gl_recurring_bills WHERE id = $1`, [req.params.id]))
      .rows[0];
    res.json(row);
  }
);

recurringBillRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM gl_recurring_bills WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

// =============================================================
// /api/vendor — Daftar Mitra
// =============================================================
const vendorRouter = express.Router();

vendorRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (await query(`SELECT * FROM gl_vendors ORDER BY name ASC`)).rows;
  res.json(rows);
});

vendorRouter.post(
  '/',
  authenticateToken,
  validate({ body: VendorCreateSchema }),
  async (req, res) => {
    const data = req.body;
    const code = data.code || (await generateVendorCode(query));
    try {
      const ins = await query(
        `INSERT INTO gl_vendors
           (code, name, npwp, address, phone, email, bank_name, bank_account_no, bank_account_holder,
            default_account_id, payment_terms_days, is_active, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [
          code,
          data.name,
          data.npwp || null,
          data.address || null,
          data.phone || null,
          data.email || null,
          data.bank_name || null,
          data.bank_account_no || null,
          data.bank_account_holder || null,
          data.default_account_id || null,
          data.payment_terms_days,
          data.is_active,
          data.note || null,
        ]
      );
      const row = (await query(`SELECT * FROM gl_vendors WHERE id = $1`, [ins.rows[0].id])).rows[0];
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Vendor code already exists' });
      }
      throw err;
    }
  }
);

vendorRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: VendorUpdateSchema }),
  async (req, res) => {
    const existing = (await query(`SELECT * FROM gl_vendors WHERE id = $1`, [req.params.id]))
      .rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = { ...existing, ...req.body };
    await query(
      `UPDATE gl_vendors SET
         code=$1, name=$2, npwp=$3, address=$4, phone=$5, email=$6,
         bank_name=$7, bank_account_no=$8, bank_account_holder=$9,
         default_account_id=$10, payment_terms_days=$11,
         is_active=$12, note=$13, updated_at=CURRENT_TIMESTAMP
       WHERE id=$14`,
      [
        merged.code,
        merged.name,
        merged.npwp,
        merged.address,
        merged.phone,
        merged.email,
        merged.bank_name,
        merged.bank_account_no,
        merged.bank_account_holder,
        merged.default_account_id,
        merged.payment_terms_days,
        merged.is_active,
        merged.note,
        req.params.id,
      ]
    );
    const row = (await query(`SELECT * FROM gl_vendors WHERE id = $1`, [req.params.id])).rows[0];
    res.json(row);
  }
);

vendorRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM gl_vendors WHERE id = $1`, [req.params.id]);
  res.json({ success: true });
});

// =============================================================
// /api/fixed-asset
// =============================================================
const fixedAssetRouter = express.Router();

fixedAssetRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT fa.*, v.name AS vendor_name
       FROM gl_fixed_assets fa
       LEFT JOIN gl_vendors v ON v.id = fa.vendor_id
       ORDER BY fa.acquisition_date DESC, fa.id DESC`
    )
  ).rows;
  res.json(rows);
});

fixedAssetRouter.get('/:id', authenticateToken, async (req, res) => {
  const row = (await query(`SELECT * FROM gl_fixed_assets WHERE id = $1`, [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  const depreciations = (
    await query(
      `SELECT * FROM gl_fixed_asset_depreciations WHERE asset_id = $1 ORDER BY period_year, period_month`,
      [req.params.id]
    )
  ).rows;
  const disposal = (
    await query(`SELECT * FROM gl_fixed_asset_disposals WHERE asset_id = $1`, [req.params.id])
  ).rows[0];
  res.json({ ...row, depreciations, disposal });
});

fixedAssetRouter.post(
  '/',
  authenticateToken,
  validate({ body: FixedAssetCreateSchema }),
  async (req, res) => {
    const data = req.body;
    try {
      const id = await tx(async (txQuery) => {
        const code = await generateAssetCode(txQuery);
        let acquisitionJournalId = null;
        if (data.payment_account_id) {
          acquisitionJournalId = await postJournal(txQuery, {
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
        const ins = await txQuery(
          `INSERT INTO gl_fixed_assets
             (code, name, category, acquisition_date, cost, useful_life_years, salvage_value,
              depreciation_method, location, vendor_id, photo_url,
              asset_account_id, accum_dep_account_id, dep_expense_account_id, payment_account_id,
              acquisition_journal_id)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
          [
            code,
            data.name,
            data.category || null,
            data.acquisition_date,
            data.cost,
            data.useful_life_years,
            data.salvage_value,
            data.depreciation_method,
            data.location || null,
            data.vendor_id || null,
            data.photo_url || null,
            data.asset_account_id,
            data.accum_dep_account_id,
            data.dep_expense_account_id,
            data.payment_account_id || null,
            acquisitionJournalId,
          ]
        );
        const newId = ins.rows[0].id;
        if (acquisitionJournalId) {
          await txQuery(`UPDATE gl_journals SET source_id = $1 WHERE id = $2`, [
            newId,
            acquisitionJournalId,
          ]);
        }
        return newId;
      });
      const row = (await query(`SELECT * FROM gl_fixed_assets WHERE id = $1`, [id])).rows[0];
      res.status(201).json(row);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

fixedAssetRouter.put(
  '/:id',
  authenticateToken,
  validate({ body: FixedAssetUpdateSchema }),
  async (req, res) => {
    const existing = (await query(`SELECT * FROM gl_fixed_assets WHERE id = $1`, [req.params.id]))
      .rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status === 'disposed') {
      return res.status(400).json({ error: 'Cannot edit disposed asset' });
    }
    const merged = { ...existing, ...req.body };
    await query(
      `UPDATE gl_fixed_assets SET
         name=$1, category=$2, useful_life_years=$3,
         salvage_value=$4, depreciation_method=$5,
         location=$6, vendor_id=$7, photo_url=$8,
         updated_at=CURRENT_TIMESTAMP
       WHERE id=$9`,
      [
        merged.name,
        merged.category || null,
        merged.useful_life_years,
        merged.salvage_value,
        merged.depreciation_method,
        merged.location || null,
        merged.vendor_id || null,
        merged.photo_url || null,
        req.params.id,
      ]
    );
    const row = (await query(`SELECT * FROM gl_fixed_assets WHERE id = $1`, [req.params.id]))
      .rows[0];
    res.json(row);
  }
);

fixedAssetRouter.delete('/:id', authenticateToken, async (req, res) => {
  const used = (
    await query(`SELECT 1 AS x FROM gl_fixed_asset_depreciations WHERE asset_id = $1 LIMIT 1`, [
      req.params.id,
    ])
  ).rows[0];
  if (used) {
    return res.status(400).json({ error: 'Asset sudah punya depresiasi — gunakan disposal' });
  }
  await query(`DELETE FROM gl_fixed_assets WHERE id = $1`, [req.params.id]);
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
  async (req, res) => {
    const { year, month, asset_ids } = req.body;
    const periodEndDate = new Date(year, month, 0).toISOString().slice(0, 10);
    let assetSql = `SELECT * FROM gl_fixed_assets WHERE status = 'active'`;
    const assetParams = [];
    if (asset_ids && asset_ids.length) {
      const placeholders = asset_ids.map((_, i) => `$${i + 1}`).join(',');
      assetSql += ` AND id IN (${placeholders})`;
      assetParams.push(...asset_ids);
    }
    const assets = (await query(assetSql, assetParams)).rows;

    const results = [];
    await tx(async (txQuery) => {
      for (const asset of assets) {
        const exists = (
          await txQuery(
            `SELECT 1 AS x FROM gl_fixed_asset_depreciations WHERE asset_id = $1 AND period_year = $2 AND period_month = $3`,
            [asset.id, year, month]
          )
        ).rows[0];
        if (exists) continue;
        const amount = calcMonthlyDepreciation(asset);
        if (amount <= 0) continue;
        const journalId = await postJournal(txQuery, {
          journal_date: periodEndDate,
          description: `Penyusutan ${asset.code} ${asset.name} ${year}-${String(month).padStart(2, '0')}`,
          source_type: 'depreciation',
          created_by: req.user?.id,
          lines: [
            { account_id: asset.dep_expense_account_id, debit: amount, credit: 0 },
            { account_id: asset.accum_dep_account_id, debit: 0, credit: amount },
          ],
        });
        const ins = await txQuery(
          `INSERT INTO gl_fixed_asset_depreciations (asset_id, period_year, period_month, amount, journal_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [asset.id, year, month, amount, journalId]
        );
        await txQuery(
          `UPDATE gl_fixed_assets SET accumulated_depreciation = accumulated_depreciation + $1 WHERE id = $2`,
          [amount, asset.id]
        );
        await txQuery(`UPDATE gl_journals SET source_id = $1 WHERE id = $2`, [
          ins.rows[0].id,
          journalId,
        ]);
        results.push({
          asset_id: asset.id,
          asset_code: asset.code,
          amount,
          journal_id: journalId,
        });
      }
    });
    res.json({ year, month, count: results.length, items: results });
  }
);

fixedAssetRouter.post(
  '/:id/dispose',
  authenticateToken,
  validate({ body: FixedAssetDisposalSchema }),
  async (req, res) => {
    const asset = (await query(`SELECT * FROM gl_fixed_assets WHERE id = $1`, [req.params.id]))
      .rows[0];
    if (!asset) return res.status(404).json({ error: 'Not found' });
    if (asset.status === 'disposed') {
      return res.status(400).json({ error: 'Asset sudah disposed' });
    }
    const data = req.body;
    try {
      await tx(async (txQuery) => {
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
          const gainAcc = (await txQuery(`SELECT id FROM gl_accounts WHERE code = '4910'`)).rows[0];
          if (gainAcc) {
            lines.push({
              account_id: gainAcc.id,
              debit: 0,
              credit: gainLoss,
              description: 'Laba disposal',
            });
          }
        } else if (gainLoss < 0) {
          const lossAcc = (await txQuery(`SELECT id FROM gl_accounts WHERE code = '5910'`)).rows[0];
          if (lossAcc) {
            lines.push({
              account_id: lossAcc.id,
              debit: -gainLoss,
              credit: 0,
              description: 'Rugi disposal',
            });
          }
        }
        const journalId = await postJournal(txQuery, {
          journal_date: data.disposal_date,
          description: `Disposal ${asset.code} ${asset.name} (${data.disposal_type})`,
          source_type: 'disposal',
          source_id: asset.id,
          created_by: req.user?.id,
          lines,
        });
        await txQuery(
          `INSERT INTO gl_fixed_asset_disposals
             (asset_id, disposal_date, disposal_type, proceeds, buyer, gain_loss, proceeds_account_id, journal_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            asset.id,
            data.disposal_date,
            data.disposal_type,
            proceeds,
            data.buyer || null,
            gainLoss,
            data.proceeds_account_id || null,
            journalId,
          ]
        );
        await txQuery(`UPDATE gl_fixed_assets SET status = 'disposed' WHERE id = $1`, [asset.id]);
      });
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

reportRouter.get('/journal', authenticateToken, async (req, res) => {
  const { from, to, account_id } = req.query;
  const conditions = [];
  const params = [];
  let p = 1;
  if (from) {
    conditions.push(`j.journal_date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`j.journal_date <= $${p++}`);
    params.push(to);
  }
  if (account_id) {
    conditions.push(`jl.account_id = $${p++}`);
    params.push(account_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = (
    await query(
      `SELECT j.id, j.journal_no, j.journal_date, j.description, j.source_type,
              jl.id AS line_id, jl.debit, jl.credit, jl.description AS line_description,
              a.code AS account_code, a.name AS account_name
       FROM gl_journals j
       JOIN gl_journal_lines jl ON jl.journal_id = j.id
       JOIN gl_accounts a ON a.id = jl.account_id
       ${where}
       ORDER BY j.journal_date ASC, j.id ASC, jl.sort_order ASC`,
      params
    )
  ).rows;
  res.json(rows);
});

reportRouter.get('/general-ledger', authenticateToken, async (req, res) => {
  const { account_id, from, to } = req.query;
  if (!account_id) return res.status(400).json({ error: 'account_id required' });
  const acc = (await query(`SELECT * FROM gl_accounts WHERE id = $1`, [account_id])).rows[0];
  if (!acc) return res.status(404).json({ error: 'Account not found' });
  const conditions = [`jl.account_id = $1`];
  const params = [account_id];
  let p = 2;
  if (from) {
    conditions.push(`j.journal_date >= $${p++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`j.journal_date <= $${p++}`);
    params.push(to);
  }
  const lines = (
    await query(
      `SELECT jl.id, j.journal_no, j.journal_date, j.description AS journal_description,
              j.source_type, jl.debit, jl.credit, jl.description
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY j.journal_date ASC, jl.id ASC`,
      params
    )
  ).rows;
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

reportRouter.get('/balance-sheet', authenticateToken, async (req, res) => {
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
  const accounts = (await query(`SELECT * FROM gl_accounts WHERE is_active = 1 ORDER BY code ASC`))
    .rows;
  const sections = { ASET: [], KEWAJIBAN: [], MODAL: [] };
  let totalAset = 0,
    totalKewajiban = 0,
    totalModal = 0;
  for (const acc of accounts) {
    if (!['ASET', 'KEWAJIBAN', 'MODAL'].includes(acc.type)) continue;
    if (acc.subtype === 'header') continue;
    const balance = await getAccountBalance(query, acc.id, asOf);
    if (balance === 0 && Number(acc.opening_balance) === 0) continue;
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
  const periodPnL = await computePeriodPnL(query, '0001-01-01', asOf);
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

async function computePeriodPnL(q, from, to) {
  const accounts = (
    await q(`SELECT * FROM gl_accounts WHERE type IN ('PENDAPATAN','BEBAN') ORDER BY code`)
  ).rows;
  const pendapatan = [];
  const beban = [];
  let totalPendapatan = 0,
    totalBeban = 0;
  for (const acc of accounts) {
    if (acc.subtype === 'header') continue;
    const row = (
      await q(
        `SELECT COALESCE(SUM(jl.debit),0) AS d, COALESCE(SUM(jl.credit),0) AS c
         FROM gl_journal_lines jl
         JOIN gl_journals j ON j.id = jl.journal_id
         WHERE jl.account_id = $1 AND j.journal_date BETWEEN $2 AND $3`,
        [acc.id, from, to]
      )
    ).rows[0];
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

reportRouter.get('/income-statement', authenticateToken, async (req, res) => {
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const result = await computePeriodPnL(query, from, to);
  res.json({ from, to, ...result });
});

reportRouter.get('/cash-flow', authenticateToken, async (req, res) => {
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const cashAccs = (
    await query(`SELECT id FROM gl_accounts WHERE type='ASET' AND subtype='Kas & Bank'`)
  ).rows;
  if (cashAccs.length === 0) {
    return res.json({ from, to, sections: [], net_change: 0, opening: 0, closing: 0 });
  }
  const cashIds = cashAccs.map((a) => a.id);
  const idPlaceholders = cashIds.map((_, i) => `$${i + 1}`).join(',');
  const sources = ['sale', 'income', 'expense', 'transfer', 'payroll', 'manual'];
  const sections = [];
  for (const src of sources) {
    const params = [...cashIds, src, from, to];
    const row = (
      await query(
        `SELECT COALESCE(SUM(jl.debit),0) AS inflow, COALESCE(SUM(jl.credit),0) AS outflow
         FROM gl_journal_lines jl
         JOIN gl_journals j ON j.id = jl.journal_id
         WHERE jl.account_id IN (${idPlaceholders})
           AND j.source_type = $${cashIds.length + 1}
           AND j.journal_date BETWEEN $${cashIds.length + 2} AND $${cashIds.length + 3}`,
        params
      )
    ).rows[0];
    sections.push({
      source_type: src,
      inflow: Number(row.inflow) || 0,
      outflow: Number(row.outflow) || 0,
      net: (Number(row.inflow) || 0) - (Number(row.outflow) || 0),
    });
  }
  const netChange = sections.reduce((s, x) => s + x.net, 0);
  let opening = 0;
  for (const a of cashAccs) {
    const dayBefore = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
    opening += await getAccountBalance(query, a.id, dayBefore);
  }
  res.json({
    from,
    to,
    sections,
    net_change: netChange,
    opening,
    closing: opening + netChange,
  });
});

reportRouter.get('/ap', authenticateToken, async (req, res) => {
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
  const apAccount = (await query(`SELECT id FROM gl_accounts WHERE code = '2101'`)).rows[0];
  if (!apAccount) return res.json({ as_of: asOf, items: [], total: 0 });
  const balance = await getAccountBalance(query, apAccount.id, asOf);
  const recentLines = (
    await query(
      `SELECT j.journal_no, j.journal_date, j.description, jl.debit, jl.credit
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE jl.account_id = $1 AND j.journal_date <= $2
       ORDER BY j.journal_date DESC LIMIT 100`,
      [apAccount.id, asOf]
    )
  ).rows;
  res.json({ as_of: asOf, account: apAccount, balance, recent_lines: recentLines });
});

reportRouter.get('/ar', authenticateToken, async (req, res) => {
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);
  const arAccount = (await query(`SELECT id FROM gl_accounts WHERE code = '1201'`)).rows[0];
  if (!arAccount) return res.json({ as_of: asOf, items: [], total: 0 });
  const balance = await getAccountBalance(query, arAccount.id, asOf);
  const recentLines = (
    await query(
      `SELECT j.journal_no, j.journal_date, j.description, jl.debit, jl.credit
       FROM gl_journal_lines jl
       JOIN gl_journals j ON j.id = jl.journal_id
       WHERE jl.account_id = $1 AND j.journal_date <= $2
       ORDER BY j.journal_date DESC LIMIT 100`,
      [arAccount.id, asOf]
    )
  ).rows;
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
