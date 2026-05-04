// /api/commission-assignment — tag karyawan ke transaksi & auto-compute komisi.
//
// POST: backend pilih semua group active yang qualifying untuk transaksi+employee,
// hitung basis_amount & computed_amount per group, insert satu row per group.
// TIERED: cumulative basis dalam periode (DAY/WEEK/MONTH) dipakai untuk pilih tier.
//
// GET: list assignments (filter employee, transaction, periode).
// DELETE /:id: untag.

const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CommissionAssignmentCreateSchema } = require('@vipos/shared');
const { rowToGroup } = require('./commission-group');

const router = express.Router();

function periodKey(date, calcPeriod) {
  // ISO date format keys: DAY=YYYY-MM-DD, WEEK=YYYY-Www, MONTH=YYYY-MM
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  if (calcPeriod === 'DAY') return `${yyyy}-${mm}-${dd}`;
  if (calcPeriod === 'WEEK') {
    // ISO week: based on UTC date
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = tmp.valueOf();
    tmp.setUTCMonth(0, 1);
    if (tmp.getUTCDay() !== 4) {
      tmp.setUTCMonth(0, 1 + ((4 - tmp.getUTCDay() + 7) % 7));
    }
    const week = 1 + Math.ceil((firstThursday - tmp.valueOf()) / 604800000);
    return `${yyyy}-W${String(week).padStart(2, '0')}`;
  }
  return `${yyyy}-${mm}`;
}

function pickTier(tiers, cumulativeBasis) {
  // Find first tier where cumulativeBasis falls inside [from, to). If `to` null/undefined → upper unbounded.
  const sorted = [...(tiers || [])].sort((a, b) => a.from - b.from);
  let chosen = null;
  for (const t of sorted) {
    const upper = t.to === null || t.to === undefined ? Infinity : t.to;
    if (cumulativeBasis >= t.from && cumulativeBasis < upper) {
      chosen = t;
      break;
    }
  }
  // If cumulative exceeds all tiers, take highest tier.
  if (!chosen && sorted.length) chosen = sorted[sorted.length - 1];
  return chosen;
}

function computeBasis(group, txn, items) {
  // Filter items by applies_to_products_scope.
  const productScope = group.applies_to_products_scope;
  const matchedItems = items.filter((it) => {
    if (productScope === 'all') return true;
    if (productScope === 'categories') {
      const cats = group.applies_to_category_ids || [];
      return cats.includes(it.category_id);
    }
    if (productScope === 'products') {
      const prods = group.applies_to_product_ids || [];
      return prods.includes(it.product_id);
    }
    return false;
  });
  const basis_amount = matchedItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
  const basis_qty = matchedItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  // For PER_TRANSACTION, basis_amount = total qualifying spend (or 0 if no items match).
  // For PER_ITEM, basis_qty drives the FIXED amount × qty.
  return { basis_amount, basis_qty, qualifying_items: matchedItems.length };
}

function employeeQualifies(group, employee) {
  if (group.applies_to_scope === 'all') return true;
  if (group.applies_to_scope === 'roles') {
    const roleKeys = (group.applies_to_role_keys || []).map((s) => String(s).toLowerCase());
    return roleKeys.includes(String(employee.role || '').toLowerCase());
  }
  if (group.applies_to_scope === 'employees') {
    const ids = (group.applies_to_employee_ids || []).map(Number);
    return ids.includes(Number(employee.id));
  }
  return false;
}

async function cumulativePriorBasis(q, employeeId, groupId, periodKeyValue) {
  const row = (
    await q(
      `SELECT COALESCE(SUM(basis_amount), 0) AS sum_basis
         FROM commission_assignments
        WHERE employee_id = $1 AND commission_group_id = $2 AND period_key = $3`,
      [employeeId, groupId, periodKeyValue]
    )
  ).rows[0];
  return Number(row?.sum_basis || 0);
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = [];
    const params = [];
    let p = 1;
    if (req.query.employee_id) {
      where.push(`a.employee_id = $${p++}`);
      params.push(Number(req.query.employee_id));
    }
    if (req.query.transaction_id) {
      where.push(`a.transaction_id = $${p++}`);
      params.push(Number(req.query.transaction_id));
    }
    if (req.query.from) {
      where.push(`a.created_at >= $${p++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push(`a.created_at <= $${p++}`);
      params.push(req.query.to);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const offset = Number(req.query.offset) || 0;
    const listParams = [...params, limit, offset];
    const rows = (
      await query(
        `SELECT a.*, u.name AS employee_name, g.name AS commission_group_name,
                t.invoice_number, t.total_amount AS transaction_total
           FROM commission_assignments a
           JOIN users u ON u.id = a.employee_id
           JOIN commission_groups g ON g.id = a.commission_group_id
           JOIN transactions t ON t.id = a.transaction_id
           ${whereClause}
          ORDER BY a.created_at DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        listParams
      )
    ).rows;
    const total = (
      await query(`SELECT COUNT(*) AS c FROM commission_assignments a ${whereClause}`, params)
    ).rows[0].c;
    res.json({ items: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: CommissionAssignmentCreateSchema }),
  async (req, res) => {
    try {
      const { transaction_id, employee_id, commission_group_ids, notes } = req.body;

      const txn = (await query('SELECT * FROM transactions WHERE id = $1', [transaction_id]))
        .rows[0];
      if (!txn) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      const employee = (
        await query('SELECT id, role, name FROM users WHERE id = $1', [employee_id])
      ).rows[0];
      if (!employee) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });

      const items = (
        await query(
          `SELECT ti.*, p.category_id
             FROM transaction_items ti
             LEFT JOIN products p ON p.id = ti.product_id
            WHERE ti.transaction_id = $1`,
          [transaction_id]
        )
      ).rows;

      const allGroupRows = (await query('SELECT * FROM commission_groups WHERE is_active = 1'))
        .rows;
      const allGroups = allGroupRows.map(rowToGroup);
      const groups =
        commission_group_ids && commission_group_ids.length
          ? allGroups.filter((g) => commission_group_ids.includes(g.id))
          : allGroups;

      const insertedRows = await tx(async (txQuery) => {
        const out = [];
        for (const g of groups) {
          if (!employeeQualifies(g, employee)) continue;
          const { basis_amount, basis_qty, qualifying_items } = computeBasis(g, txn, items);
          if (qualifying_items === 0 && g.applies_to_products_scope !== 'all') continue;
          let computed = 0;
          let tier_percentage = null;
          if (g.type === 'FIXED') {
            if (g.amount_basis === 'PER_ITEM') {
              computed = Number(g.amount || 0) * basis_qty;
            } else {
              computed = Number(g.amount || 0);
            }
          } else if (g.type === 'TIERED') {
            const pkey = periodKey(txn.created_at || new Date().toISOString(), g.calc_period);
            const cumulative = await cumulativePriorBasis(txQuery, employee_id, g.id, pkey);
            const newCumulative = cumulative + basis_amount;
            const tier = pickTier(g.tiers, newCumulative);
            if (tier) {
              tier_percentage = tier.percentage;
              computed = (basis_amount * tier.percentage) / 100;
            }
          }
          if (computed <= 0 && basis_qty === 0) continue;
          const pkey = periodKey(txn.created_at || new Date().toISOString(), g.calc_period);
          const ins = await txQuery(
            `INSERT INTO commission_assignments (
                transaction_id, employee_id, commission_group_id,
                basis_amount, basis_qty, computed_amount,
                tier_percentage, period_key, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
              transaction_id,
              employee_id,
              g.id,
              basis_amount,
              basis_qty,
              computed,
              tier_percentage,
              pkey,
              notes || null,
            ]
          );
          const inserted = (
            await txQuery(
              `SELECT a.*, u.name AS employee_name, g.name AS commission_group_name,
                      t.invoice_number, t.total_amount AS transaction_total
                 FROM commission_assignments a
                 JOIN users u ON u.id = a.employee_id
                 JOIN commission_groups g ON g.id = a.commission_group_id
                 JOIN transactions t ON t.id = a.transaction_id
                WHERE a.id = $1`,
              [ins.rows[0].id]
            )
          ).rows[0];
          out.push(inserted);
        }
        return out;
      });

      const totalCommission = insertedRows.reduce(
        (acc, r) => acc + Number(r.computed_amount || 0),
        0
      );
      res.status(201).json({ assignments: insertedRows, total_commission: totalCommission });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM commission_assignments WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Assignment tidak ditemukan' });
    res.json({ id: Number(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports._helpers = { periodKey, pickTier, computeBasis, employeeQualifies };
