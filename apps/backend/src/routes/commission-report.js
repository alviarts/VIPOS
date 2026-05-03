// /api/commission-report — aggregate komisi per karyawan per periode.

const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const where = [];
    const params = [];
    if (req.query.employee_id) {
      where.push('a.employee_id = ?');
      params.push(Number(req.query.employee_id));
    }
    if (req.query.from) {
      where.push('a.created_at >= ?');
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push('a.created_at <= ?');
      params.push(req.query.to);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Group by employee + period_key. period_key sudah pre-computed di assignment.
    // Optional override: kalau client kirim group_by, kita re-derive period_key
    // dari created_at dengan format yang requested.
    const groupBy = req.query.group_by;
    const periodExpr = (() => {
      if (groupBy === 'DAY') return "strftime('%Y-%m-%d', a.created_at)";
      if (groupBy === 'WEEK') return "strftime('%Y-W%W', a.created_at)";
      if (groupBy === 'MONTH') return "strftime('%Y-%m', a.created_at)";
      // default: pakai period_key langsung (yang ditentukan saat assignment dibuat)
      return 'a.period_key';
    })();

    const rows = db
      .prepare(
        `SELECT a.employee_id,
                u.name AS employee_name,
                ${periodExpr} AS period_key,
                COUNT(DISTINCT a.transaction_id) AS transaction_count,
                COALESCE(SUM(a.basis_amount), 0) AS total_basis,
                COALESCE(SUM(a.computed_amount), 0) AS total_commission
           FROM commission_assignments a
           JOIN users u ON u.id = a.employee_id
           ${whereClause}
          GROUP BY a.employee_id, period_key
          ORDER BY period_key DESC, total_commission DESC`
      )
      .all(...params);

    const totalCommission = rows.reduce((acc, r) => acc + Number(r.total_commission || 0), 0);
    res.json({ rows, total_commission: totalCommission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
