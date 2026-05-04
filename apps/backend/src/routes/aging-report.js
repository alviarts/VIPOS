// /api/aging-report — A/R aging buckets (P2-01b cutover: async query layer).

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = (
      await query(
        `SELECT customer_id, customer_name, due_date, outstanding
           FROM b2b_invoices
          WHERE status IN ('ISSUED', 'PARTIAL', 'OVERDUE')
            AND outstanding > 0`
      )
    ).rows;

    const byCustomer = new Map();
    for (const r of rows) {
      const key = r.customer_id ?? `name:${r.customer_name}`;
      if (!byCustomer.has(key)) {
        byCustomer.set(key, {
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          bucket_0_30: 0,
          bucket_31_60: 0,
          bucket_61_90: 0,
          bucket_90_plus: 0,
          total_outstanding: 0,
        });
      }
      const bucket = byCustomer.get(key);
      let daysPastDue = 0;
      if (r.due_date) {
        const due = new Date(r.due_date);
        const t = new Date(today);
        daysPastDue = Math.floor((t - due) / (1000 * 60 * 60 * 24));
      }
      const amt = Number(r.outstanding) || 0;
      if (daysPastDue <= 30) bucket.bucket_0_30 += amt;
      else if (daysPastDue <= 60) bucket.bucket_31_60 += amt;
      else if (daysPastDue <= 90) bucket.bucket_61_90 += amt;
      else bucket.bucket_90_plus += amt;
      bucket.total_outstanding += amt;
    }

    const out = Array.from(byCustomer.values()).sort(
      (a, b) => b.total_outstanding - a.total_outstanding
    );
    const totals = out.reduce(
      (acc, r) => ({
        bucket_0_30: acc.bucket_0_30 + r.bucket_0_30,
        bucket_31_60: acc.bucket_31_60 + r.bucket_31_60,
        bucket_61_90: acc.bucket_61_90 + r.bucket_61_90,
        bucket_90_plus: acc.bucket_90_plus + r.bucket_90_plus,
        total_outstanding: acc.total_outstanding + r.total_outstanding,
      }),
      {
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_90_plus: 0,
        total_outstanding: 0,
      }
    );
    res.json({ rows: out, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
