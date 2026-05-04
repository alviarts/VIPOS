// /api/commission-report — aggregate komisi per karyawan per periode.
//
// P2-01b cutover: async query layer. SQL still uses strftime() — needs
// portable rewrite (to_char / date_trunc) before flipping to Postgres
// driver in P2-01b finalstep.

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = [];
    const params = [];
    let p = 1;
    if (req.query.employee_id) {
      where.push(`a.employee_id = $${p++}`);
      params.push(Number(req.query.employee_id));
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

    // Group by employee + period_key. period_key sudah pre-computed di assignment.
    // Optional override: kalau client kirim group_by, re-derive period_key
    // dari created_at dengan format yang requested.
    const groupBy = req.query.group_by;
    const periodExpr = (() => {
      if (groupBy === 'DAY') return "to_char(a.created_at, 'YYYY-MM-DD')";
      if (groupBy === 'WEEK') return 'to_char(a.created_at, \'IYYY-"W"IW\')';
      if (groupBy === 'MONTH') return "to_char(a.created_at, 'YYYY-MM')";
      return 'a.period_key';
    })();

    const r = await query(
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
        ORDER BY period_key DESC, total_commission DESC`,
      params
    );

    const totalCommission = r.rows.reduce((acc, row) => acc + Number(row.total_commission || 0), 0);
    res.json({ rows: r.rows, total_commission: totalCommission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
