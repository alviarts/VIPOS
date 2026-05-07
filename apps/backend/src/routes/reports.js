// P1-17 — Reports (Laporan).
//
// Endpoint family /api/reports/* untuk semua report di catalog
// `docs/v2/16_REPORTS_CATALOG.md`. Setiap endpoint terima filter standar
// (from, to, outlet_id, cashier_id, payment_method, dst.) dan kembalikan
// JSON. Export ke CSV/xlsx/PDF dilakukan di client (pakai data tabel JSON).
//
// Schedule report (Prime+ tier): CRUD untuk `report_schedules` table.
// Cron actual + email delivery TBD — di-stub agar tier feature bisa di-toggle.

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireTier } = require('../middleware/tier');
const { validate } = require('../middleware/validate');
const {
  ReportFilterQuerySchema,
  ReportScheduleCreateSchema,
  ReportScheduleUpdateSchema,
} = require('@vipos/shared');
const { QUEUE_NAMES, isQueueEnabled, getOrCreateQueue, safeEnqueue } = require('../lib/queue');
const {
  LEGACY_TO_CANONICAL,
  canonicalizePaymentMethod,
  canonicalPaymentMethodSql,
} = require('../lib/payment-methods');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultRange(q) {
  const today = new Date().toISOString().slice(0, 10);
  const to = q.to || today;
  const from =
    q.from ||
    (() => {
      const d = new Date(to);
      d.setDate(d.getDate() - 29);
      return d.toISOString().slice(0, 10);
    })();
  return { from, to };
}

function makeCtx() {
  return { params: [], idx: 1 };
}

function ph(ctx, val) {
  ctx.params.push(val);
  return `$${ctx.idx++}`;
}

function whereDateRange(field, from, to, ctx) {
  return `DATE(${field}) BETWEEN ${ph(ctx, from)} AND ${ph(ctx, to)}`;
}

function appendCashierFilter(where, ctx, cashierId) {
  if (cashierId) where.push(`t.user_id = ${ph(ctx, cashierId)}`);
}

function appendPaymentFilter(where, ctx, method) {
  if (!method) return;
  // Canonicalise BOTH the column and the param so a filter by `cash`
  // matches `CASH` rows (and vice-versa) — pairs with the GROUP BY
  // canonicalisation below. Without this, picking "Tunai" in the
  // reports filter would silently drop legacy or canonical rows
  // depending on which casing the caller used.
  const canonical = canonicalPaymentMethodSql('t.payment_method');
  const param = canonicalizePaymentMethod(method);
  where.push(`${canonical} = ${ph(ctx, param)}`);
}

// ---------------------------------------------------------------------------
// Report Catalog — list of available reports + tier requirements (untuk hub).
// ---------------------------------------------------------------------------

router.get('/catalog', authenticateToken, (req, res) => {
  res.json([
    {
      group: 'sales',
      label: 'Penjualan',
      reports: [
        { key: 'sales-summary', label: 'Ringkasan Penjualan', tier: 'lite' },
        { key: 'sales-detail', label: 'Detail Penjualan', tier: 'lite' },
        { key: 'sales-daily', label: 'Penjualan Harian', tier: 'lite' },
        { key: 'sales-by-outlet', label: 'Penjualan per Outlet', tier: 'starter' },
        { key: 'sales-by-category', label: 'Penjualan per Kategori', tier: 'lite' },
        { key: 'sales-by-department', label: 'Penjualan per Departemen', tier: 'starter' },
        { key: 'sales-by-product', label: 'Penjualan per Produk', tier: 'lite' },
        { key: 'sales-by-cashier', label: 'Penjualan per Kasir', tier: 'starter' },
        {
          key: 'sales-by-payment-method',
          label: 'Penjualan per Metode Bayar',
          tier: 'lite',
        },
      ],
    },
    {
      group: 'cash-shift',
      label: 'Kas & Shift',
      reports: [
        { key: 'cash-drawer', label: 'Kas Kasir', tier: 'lite' },
        { key: 'shift-close', label: 'Tutup Kasir', tier: 'lite' },
      ],
    },
    {
      group: 'adjustments',
      label: 'Penyesuaian',
      reports: [
        { key: 'void', label: 'Void', tier: 'lite' },
        { key: 'refund', label: 'Refund', tier: 'lite' },
        { key: 'promo', label: 'Promo', tier: 'starter' },
        { key: 'loyalty', label: 'Loyalty Poin', tier: 'starter' },
        { key: 'coupon', label: 'Kupon', tier: 'prime' },
      ],
    },
    {
      group: 'tax-customer',
      label: 'Pajak & Pelanggan',
      reports: [
        { key: 'tax', label: 'Pajak', tier: 'lite' },
        { key: 'customer', label: 'Pelanggan', tier: 'starter' },
      ],
    },
    {
      group: 'inventory',
      label: 'Inventori',
      reports: [
        { key: 'inventory-stock', label: 'Stok Saat Ini', tier: 'lite' },
        { key: 'inventory-movement', label: 'Mutasi Stok', tier: 'lite' },
        { key: 'inventory-turnover', label: 'Perputaran Stok', tier: 'starter' },
        { key: 'inventory-value', label: 'Nilai Stok', tier: 'lite' },
      ],
    },
    {
      group: 'employee',
      label: 'Karyawan',
      reports: [
        { key: 'employee-attendance', label: 'Absensi', tier: 'starter' },
        { key: 'employee-shift', label: 'Shift Kasir', tier: 'starter' },
        { key: 'employee-commission', label: 'Komisi', tier: 'starter' },
      ],
    },
    {
      group: 'financial',
      label: 'Keuangan',
      reports: [
        { key: 'financial-pnl', label: 'Laba Rugi', tier: 'starter' },
        { key: 'financial-balance-sheet', label: 'Neraca', tier: 'starter' },
        { key: 'financial-cashflow', label: 'Arus Kas', tier: 'starter' },
      ],
    },
    {
      group: 'marketing',
      label: 'Marketing',
      reports: [{ key: 'marketing-campaign', label: 'Campaign', tier: 'prime' }],
    },
  ]);
});

// ---------------------------------------------------------------------------
// SALES reports
// ---------------------------------------------------------------------------

router.get(
  '/sales-summary',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const { cashier_id, payment_method } = req.query;
    const ctx = makeCtx();
    const where = ["t.status = 'completed'"];
    where.push(whereDateRange('t.created_at', from, to, ctx));
    appendCashierFilter(where, ctx, cashier_id);
    appendPaymentFilter(where, ctx, payment_method);
    const whereSql = where.join(' AND ');

    const kpi = (
      await query(
        `SELECT
           COALESCE(SUM(t.total_amount), 0) AS gross_revenue,
           COUNT(*) AS transaction_count,
           COUNT(DISTINCT t.customer_id) AS unique_customers,
           COALESCE(SUM(
             (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id)
           ), 0) AS item_count
         FROM transactions t
         WHERE ${whereSql}`,
        ctx.params
      )
    ).rows[0];

    const voided = (
      await query(
        `SELECT COUNT(*) AS voided_count, COALESCE(SUM(total_amount), 0) AS voided_value
         FROM transactions
         WHERE status = 'voided'
           AND DATE(created_at) BETWEEN $1 AND $2`,
        [from, to]
      )
    ).rows[0];

    const dailyTrend = (
      await query(
        `SELECT DATE(t.created_at) AS date,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                COUNT(*) AS transactions
         FROM transactions t
         WHERE ${whereSql}
         GROUP BY DATE(t.created_at)
         ORDER BY date ASC`,
        ctx.params
      )
    ).rows;

    const topProducts = (
      await query(
        `SELECT ti.product_id,
                ti.product_name,
                COALESCE(SUM(ti.quantity), 0) AS qty,
                COALESCE(SUM(ti.subtotal), 0) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE ${whereSql}
         GROUP BY ti.product_id, ti.product_name
         ORDER BY qty DESC
         LIMIT 5`,
        ctx.params
      )
    ).rows;

    // Canonicalise so legacy lowercase rows (`cash`/`card`/`qris`,
    // pre-#236) merge with the matching canonical Android codes
    // (`CASH`/`EDC`/`QRIS_STATIC`) in the breakdown — see
    // `lib/payment-methods.js`.
    const canonical = canonicalPaymentMethodSql('t.payment_method');
    const paymentBreakdown = (
      await query(
        `SELECT ${canonical} AS method,
                COUNT(*) AS count,
                COALESCE(SUM(t.total_amount), 0) AS total
         FROM transactions t
         WHERE ${whereSql}
         GROUP BY ${canonical}`,
        ctx.params
      )
    ).rows;

    const transactionCount = Number(kpi.transaction_count) || 0;
    const grossRevenue = Number(kpi.gross_revenue) || 0;
    res.json({
      period: { from, to },
      kpi: {
        gross_revenue: grossRevenue,
        discount: 0,
        tax: 0,
        service_charge: 0,
        net_revenue: grossRevenue,
        transaction_count: transactionCount,
        avg_ticket: transactionCount ? grossRevenue / transactionCount : 0,
        item_count: Number(kpi.item_count) || 0,
        unique_customers: Number(kpi.unique_customers) || 0,
        voided_count: Number(voided.voided_count) || 0,
        voided_value: Number(voided.voided_value) || 0,
      },
      daily_trend: dailyTrend,
      top_products: topProducts,
      payment_breakdown: paymentBreakdown,
    });
  }
);

router.get(
  '/sales-detail',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const { cashier_id, payment_method, limit = 500 } = req.query;
    const ctx = makeCtx();
    const where = [];
    where.push(whereDateRange('t.created_at', from, to, ctx));
    appendCashierFilter(where, ctx, cashier_id);
    appendPaymentFilter(where, ctx, payment_method);
    const whereSql = where.join(' AND ');
    const limitPh = ph(ctx, Number(limit) || 500);

    const rows = (
      await query(
        `SELECT t.id,
                t.invoice_number,
                t.created_at,
                t.user_id,
                u.name AS cashier_name,
                t.customer_id,
                c.name AS customer_name,
                t.payment_method,
                t.status,
                t.total_amount,
                t.payment_amount,
                t.change_amount,
                (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id) AS item_count
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN customers c ON c.id = t.customer_id
         WHERE ${whereSql}
         ORDER BY t.created_at DESC
         LIMIT ${limitPh}`,
        ctx.params
      )
    ).rows;

    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-daily',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const ctx = makeCtx();
    const where = ["t.status = 'completed'"];
    where.push(whereDateRange('t.created_at', from, to, ctx));
    appendCashierFilter(where, ctx, req.query.cashier_id);
    appendPaymentFilter(where, ctx, req.query.payment_method);
    const whereSql = where.join(' AND ');

    const rows = (
      await query(
        `SELECT DATE(t.created_at) AS date,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id)
                ), 0) AS items
         FROM transactions t
         WHERE ${whereSql}
         GROUP BY DATE(t.created_at)
         ORDER BY date ASC`,
        ctx.params
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-outlet',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const outletRow = (
      await query(`SELECT id, name FROM outlets WHERE is_main = 1 AND is_active = 1 LIMIT 1`)
    ).rows[0] || { id: 1, name: 'Outlet Pusat' };
    const aggregate = (
      await query(
        `SELECT COUNT(*) AS transactions,
                COALESCE(SUM(total_amount), 0) AS revenue,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id)
                ), 0) AS items
         FROM transactions t
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN $1 AND $2`,
        [from, to]
      )
    ).rows[0];
    const transactions = Number(aggregate.transactions) || 0;
    const revenue = Number(aggregate.revenue) || 0;
    const rows = [
      {
        outlet_id: outletRow.id,
        outlet_name: outletRow.name,
        transactions,
        revenue,
        items: Number(aggregate.items) || 0,
        avg_ticket: transactions ? revenue / transactions : 0,
      },
    ];
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-category',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT c.id AS category_id,
                COALESCE(c.name, '(Tanpa Kategori)') AS category_name,
                COALESCE(SUM(ti.quantity), 0) AS qty,
                COALESCE(SUM(ti.subtotal), 0) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY c.id, c.name
         ORDER BY revenue DESC`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-department',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT d.id AS department_id,
                COALESCE(d.name, '(Tanpa Departemen)') AS department_name,
                COALESCE(SUM(ti.quantity), 0) AS qty,
                COALESCE(SUM(ti.subtotal), 0) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN departments d ON d.id = c.department_id
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY d.id, d.name
         ORDER BY revenue DESC`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-product',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const limit = Number(req.query.limit) || 100;
    const rows = (
      await query(
        `SELECT ti.product_id,
                ti.product_name,
                p.harga_modal,
                COALESCE(SUM(ti.quantity), 0) AS qty,
                COALESCE(SUM(ti.subtotal), 0) AS revenue,
                COALESCE(SUM(ti.subtotal) - SUM(ti.quantity * COALESCE(p.harga_modal, 0)), 0) AS margin
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY ti.product_id, ti.product_name, p.harga_modal
         ORDER BY revenue DESC
         LIMIT $3`,
        [from, to, limit]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-cashier',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT u.id AS cashier_id,
                COALESCE(u.name, u.username) AS cashier_name,
                COUNT(t.id) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                CASE WHEN COUNT(t.id) = 0 THEN 0
                     ELSE ROUND((SUM(t.total_amount) * 1.0 / COUNT(t.id))::numeric, 2)
                END AS avg_ticket
         FROM users u
         LEFT JOIN transactions t ON t.user_id = u.id
              AND t.status = 'completed'
              AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY u.id, u.name, u.username
         HAVING COUNT(t.id) > 0
         ORDER BY revenue DESC`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-payment-method',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    // Canonicalise so legacy lowercase rows merge with the matching
    // canonical Android codes — otherwise this report shows two rows
    // per logical method (e.g. `cash` + `CASH`).
    const canonical = canonicalPaymentMethodSql('t.payment_method');
    const rows = (
      await query(
        `SELECT ${canonical} AS method,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS gross_amount
         FROM transactions t
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY ${canonical}
         ORDER BY gross_amount DESC`,
        [from, to]
      )
    ).rows;
    // The `payment_methods` reference table is seeded with legacy
    // lowercase codes (`cash`/`card`/`qris`); the rows above are now
    // canonicalised to uppercase. Build the lookup acc under BOTH the
    // table's lowercased keys AND the canonical Android equivalent so
    // an `EDC` row finds the `card` MDR config without a schema change.
    const mdrRows = (
      await query(
        `SELECT code, name, type, fee_percent, fee_flat FROM payment_methods WHERE is_active = 1`
      )
    ).rows.reduce((acc, row) => {
      const keys = [row.code, row.name, row.type].filter(Boolean);
      for (const k of keys) {
        const lowered = String(k).toLowerCase();
        acc[lowered] = row;
        const canonicalEquivalent = LEGACY_TO_CANONICAL[lowered];
        if (canonicalEquivalent) acc[canonicalEquivalent.toLowerCase()] = row;
      }
      return acc;
    }, {});
    const enriched = rows.map((row) => {
      const pm = mdrRows[(row.method || '').toLowerCase()];
      const feePct = pm?.fee_percent || 0;
      const feeFlat = pm?.fee_flat || 0;
      const grossAmount = Number(row.gross_amount) || 0;
      const transactions = Number(row.transactions) || 0;
      const mdrAmount = grossAmount * (feePct / 100) + feeFlat * transactions;
      return {
        ...row,
        mdr_pct: feePct,
        mdr_amount: mdrAmount,
        net_amount: grossAmount - mdrAmount,
      };
    });
    res.json({ period: { from, to }, rows: enriched });
  }
);

// ---------------------------------------------------------------------------
// CASH & SHIFT
// ---------------------------------------------------------------------------

router.get(
  '/cash-drawer',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT ct.id,
                ct.tanggal,
                ct.tipe,
                ct.kategori,
                ct.jumlah,
                ct.keterangan,
                ct.reference,
                ca.nama AS account_nama,
                u.name AS cashier_name
         FROM cash_transactions ct
         LEFT JOIN cash_accounts ca ON ca.id = ct.account_id
         LEFT JOIN users u ON u.id = ct.user_id
         WHERE DATE(ct.tanggal) BETWEEN $1 AND $2
         ORDER BY ct.tanggal DESC, ct.id DESC`,
        [from, to]
      )
    ).rows;
    const totals = rows.reduce(
      (acc, row) => {
        if (row.tipe === 'pemasukan') acc.income += Number(row.jumlah) || 0;
        if (row.tipe === 'pengeluaran') acc.expense += Number(row.jumlah) || 0;
        return acc;
      },
      { income: 0, expense: 0 }
    );
    res.json({ period: { from, to }, totals, rows });
  }
);

router.get(
  '/shift-close',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT DATE(t.created_at) AS shift_date,
                u.id AS cashier_id,
                COALESCE(u.name, u.username) AS cashier_name,
                MIN(t.created_at) AS open_time,
                MAX(t.created_at) AS close_time,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                COALESCE(SUM(CASE WHEN t.payment_method = 'cash' THEN t.total_amount ELSE 0 END), 0) AS cash_revenue,
                COALESCE(SUM(CASE WHEN t.payment_method = 'card' THEN t.total_amount ELSE 0 END), 0) AS card_revenue,
                COALESCE(SUM(CASE WHEN t.payment_method = 'qris' THEN t.total_amount ELSE 0 END), 0) AS qris_revenue
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY DATE(t.created_at), u.id, u.name, u.username
         ORDER BY shift_date DESC, cashier_name ASC`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// ADJUSTMENTS — void, refund, promo, loyalty, coupon
// ---------------------------------------------------------------------------

router.get(
  '/void',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT t.id,
                t.invoice_number,
                t.created_at,
                t.total_amount,
                t.payment_method,
                t.notes AS reason,
                u.name AS voided_by
         FROM transactions t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.status = 'voided'
           AND DATE(t.created_at) BETWEEN $1 AND $2
         ORDER BY t.created_at DESC`,
        [from, to]
      )
    ).rows;
    const total = rows.reduce(
      (acc, row) => ({
        count: acc.count + 1,
        value: acc.value + (Number(row.total_amount) || 0),
      }),
      { count: 0, value: 0 }
    );
    res.json({ period: { from, to }, total, rows });
  }
);

router.get(
  '/refund',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT id, invoice_number, created_at, total_amount, payment_method, notes
         FROM transactions
         WHERE total_amount < 0
           AND DATE(created_at) BETWEEN $1 AND $2
         ORDER BY created_at DESC`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/promo',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT id,
                name,
                promo_type,
                discount_value,
                valid_from,
                valid_until,
                COALESCE(current_use_count, 0) AS usage_count,
                is_active
         FROM promos
         WHERE (
           (valid_from IS NULL OR DATE(valid_from) <= $1)
           AND (valid_until IS NULL OR DATE(valid_until) >= $2)
         )
         ORDER BY current_use_count DESC, id DESC
         LIMIT 200`,
        [to, from]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/loyalty',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const totals = (
      await query(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) AS total_earned,
           COALESCE(SUM(CASE WHEN type = 'redeem' THEN points ELSE 0 END), 0) AS total_redeemed,
           COALESCE(SUM(CASE WHEN type = 'expire' THEN points ELSE 0 END), 0) AS total_expired
         FROM loyalty_transactions
         WHERE DATE(created_at) BETWEEN $1 AND $2`,
        [from, to]
      )
    ).rows[0];
    const topEarners = (
      await query(
        `SELECT customer_id,
                (SELECT name FROM customers WHERE id = lt.customer_id) AS customer_name,
                COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) AS earned
         FROM loyalty_transactions lt
         WHERE DATE(created_at) BETWEEN $1 AND $2
         GROUP BY customer_id
         ORDER BY earned DESC
         LIMIT 10`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, totals, top_earners: topEarners });
  }
);

router.get(
  '/coupon',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT c.id,
                c.code,
                c.batch_id,
                c.max_uses,
                c.used_count,
                c.valid_from,
                c.valid_until,
                c.is_active,
                p.name AS promo_name,
                p.discount_value,
                COALESCE(SUM(cr.amount), 0) AS redeemed_amount
         FROM coupons c
         LEFT JOIN promos p ON p.id = c.promo_id
         LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
              AND DATE(cr.redeemed_at) BETWEEN $1 AND $2
         GROUP BY c.id, c.code, c.batch_id, c.max_uses, c.used_count,
                  c.valid_from, c.valid_until, c.is_active, p.name, p.discount_value, c.created_at
         ORDER BY c.created_at DESC
         LIMIT 500`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// TAX & CUSTOMER
// ---------------------------------------------------------------------------

router.get(
  '/tax',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const taxes = (await query(`SELECT id, code, name, rate FROM tax_rates WHERE is_active = 1`))
      .rows;
    const aggregate = (
      await query(
        `SELECT COALESCE(SUM(total_amount), 0) AS gross
         FROM transactions
         WHERE status = 'completed' AND DATE(created_at) BETWEEN $1 AND $2`,
        [from, to]
      )
    ).rows[0];
    const grossNum = Number(aggregate.gross) || 0;
    const rows = taxes.map((tax) => {
      const rate = Number(tax.rate) || 0;
      const base = rate ? grossNum / (1 + rate / 100) : grossNum;
      const taxAmount = grossNum - base;
      return {
        tax_id: tax.id,
        code: tax.code,
        name: tax.name,
        rate,
        tax_base: base,
        tax_amount: taxAmount,
      };
    });
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/customer',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const totals = (
      await query(
        `SELECT COUNT(DISTINCT customer_id) AS active_customers,
                COALESCE(AVG(total_amount), 0) AS avg_spend,
                COUNT(*) AS transactions,
                COALESCE(SUM(total_amount), 0) AS total_spend
         FROM transactions
         WHERE status = 'completed'
           AND customer_id IS NOT NULL
           AND DATE(created_at) BETWEEN $1 AND $2`,
        [from, to]
      )
    ).rows[0];
    const newCustomers = (
      await query(
        `SELECT COUNT(*) AS new_customers
         FROM (
           SELECT customer_id, MIN(DATE(created_at)) AS first_date
           FROM transactions
           WHERE status = 'completed' AND customer_id IS NOT NULL
           GROUP BY customer_id
         ) sub
         WHERE first_date BETWEEN $1 AND $2`,
        [from, to]
      )
    ).rows[0];
    const top = (
      await query(
        `SELECT t.customer_id,
                c.name,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS total_spend
         FROM transactions t
         LEFT JOIN customers c ON c.id = t.customer_id
         WHERE t.status = 'completed'
           AND t.customer_id IS NOT NULL
           AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY t.customer_id, c.name
         ORDER BY total_spend DESC
         LIMIT 10`,
        [from, to]
      )
    ).rows;
    res.json({
      period: { from, to },
      totals: {
        ...totals,
        new_customers: Number(newCustomers.new_customers) || 0,
        returning_customers:
          (Number(totals.active_customers) || 0) - (Number(newCustomers.new_customers) || 0),
      },
      top_customers: top,
    });
  }
);

// ---------------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------------

router.get('/inventory-stock', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT p.id,
              p.sku,
              p.name,
              COALESCE(c.name, '-') AS category_name,
              p.stock,
              p.satuan,
              COALESCE(p.harga_modal, 0) AS unit_cost,
              p.stock * COALESCE(p.harga_modal, 0) AS stock_value,
              CASE WHEN p.stock <= COALESCE(p.stok_minimum, 0) THEN 1 ELSE 0 END AS is_low_stock,
              p.is_active
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.name ASC`
    )
  ).rows;
  const totals = rows.reduce(
    (acc, row) => ({
      products: acc.products + 1,
      stock_qty: acc.stock_qty + (Number(row.stock) || 0),
      stock_value: acc.stock_value + (Number(row.stock_value) || 0),
      low_stock: acc.low_stock + (row.is_low_stock ? 1 : 0),
    }),
    { products: 0, stock_qty: 0, stock_value: 0, low_stock: 0 }
  );
  res.json({ totals, rows });
});

router.get(
  '/inventory-movement',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT im.id,
                im.tanggal,
                im.tipe,
                im.qty,
                im.stok_sebelum,
                im.stok_sesudah,
                im.unit_cost,
                im.reason,
                im.ref_type,
                im.ref_id,
                im.keterangan,
                p.name AS product_name,
                p.sku,
                u.name AS user_name
         FROM inventory_movements im
         LEFT JOIN products p ON p.id = im.product_id
         LEFT JOIN users u ON u.id = im.user_id
         WHERE DATE(im.tanggal) BETWEEN $1 AND $2
         ORDER BY im.tanggal DESC, im.id DESC
         LIMIT 1000`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/inventory-turnover',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT p.id AS product_id,
                p.sku,
                p.name,
                p.stock AS current_stock,
                COALESCE(SUM(ti.quantity), 0) AS sold_qty,
                CASE
                  WHEN p.stock + COALESCE(SUM(ti.quantity), 0) = 0 THEN 0
                  ELSE ROUND(
                    ((COALESCE(SUM(ti.quantity), 0) * 1.0) /
                     NULLIF((p.stock + COALESCE(SUM(ti.quantity), 0)) / 2.0, 0))::numeric,
                    3
                  )
                END AS turnover_ratio
         FROM products p
         LEFT JOIN transaction_items ti ON ti.product_id = p.id
         LEFT JOIN transactions t ON t.id = ti.transaction_id
              AND t.status = 'completed'
              AND DATE(t.created_at) BETWEEN $1 AND $2
         GROUP BY p.id, p.sku, p.name, p.stock
         ORDER BY sold_qty DESC
         LIMIT 200`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

router.get('/inventory-value', authenticateToken, async (req, res) => {
  const result = (
    await query(
      `SELECT COUNT(*) AS products,
              COALESCE(SUM(stock), 0) AS qty,
              COALESCE(SUM(stock * COALESCE(harga_modal, 0)), 0) AS total_value
       FROM products
       WHERE is_active = 1`
    )
  ).rows[0];
  const byCategory = (
    await query(
      `SELECT COALESCE(c.name, '(Tanpa Kategori)') AS category_name,
              COUNT(p.id) AS products,
              COALESCE(SUM(p.stock), 0) AS qty,
              COALESCE(SUM(p.stock * COALESCE(p.harga_modal, 0)), 0) AS total_value
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1
       GROUP BY c.id, c.name
       ORDER BY total_value DESC`
    )
  ).rows;
  res.json({ totals: result, by_category: byCategory });
});

// ---------------------------------------------------------------------------
// EMPLOYEE
// ---------------------------------------------------------------------------

router.get(
  '/employee-attendance',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    let rows = [];
    try {
      rows = (
        await query(
          `SELECT DATE(al.logged_at) AS date,
                  al.employee_id,
                  e.name AS employee_name,
                  e.position,
                  MIN(CASE WHEN al.log_type = 'check_in' THEN al.logged_at END) AS first_check_in,
                  MAX(CASE WHEN al.log_type = 'check_out' THEN al.logged_at END) AS last_check_out,
                  SUM(CASE WHEN al.log_type = 'check_in' THEN 1 ELSE 0 END) AS check_in_count,
                  SUM(CASE WHEN al.log_type = 'check_out' THEN 1 ELSE 0 END) AS check_out_count,
                  SUM(CASE WHEN al.is_off_site = 1 THEN 1 ELSE 0 END) AS off_site_count
           FROM attendance_logs al
           LEFT JOIN employees e ON e.id = al.employee_id
           WHERE DATE(al.logged_at) BETWEEN $1 AND $2
           GROUP BY DATE(al.logged_at), al.employee_id, e.name, e.position
           ORDER BY date DESC, employee_name ASC
           LIMIT 1000`,
          [from, to]
        )
      ).rows;
    } catch (_err) {
      rows = [];
    }
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/employee-shift',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    let rows = [];
    try {
      rows = (
        await query(
          `SELECT sa.id,
                  sa.schedule_date,
                  sa.is_off,
                  s.name AS shift_name,
                  s.start_time,
                  s.end_time,
                  e.name AS employee_name,
                  e.position
           FROM schedule_assignments sa
           LEFT JOIN shifts s ON s.id = sa.shift_id
           LEFT JOIN employees e ON e.id = sa.employee_id
           WHERE DATE(sa.schedule_date) BETWEEN $1 AND $2
           ORDER BY sa.schedule_date DESC, s.start_time ASC
           LIMIT 1000`,
          [from, to]
        )
      ).rows;
    } catch (_err) {
      rows = [];
    }
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/employee-commission',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    let rows = [];
    try {
      rows = (
        await query(
          `SELECT ca.id AS assignment_id,
                  ca.basis_amount,
                  ca.basis_qty,
                  ca.computed_amount,
                  ca.tier_percentage,
                  ca.period_key,
                  cg.name AS group_name,
                  cg.type AS group_type,
                  cg.amount_basis,
                  cg.calc_period,
                  ca.transaction_id,
                  ca.employee_id,
                  COALESCE(e.name, u.name) AS employee_name
           FROM commission_assignments ca
           LEFT JOIN commission_groups cg ON cg.id = ca.commission_group_id
           LEFT JOIN users u ON u.id = ca.employee_id
           LEFT JOIN employees e ON e.user_id = u.id
           LEFT JOIN transactions t ON t.id = ca.transaction_id
           WHERE (ca.transaction_id IS NULL
                  OR DATE(t.created_at) BETWEEN $1 AND $2)
           ORDER BY ca.created_at DESC
           LIMIT 1000`,
          [from, to]
        )
      ).rows;
    } catch (_err) {
      rows = [];
    }
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// FINANCIAL — proxy ke data dari /api/financial-report (ringkasan)
// ---------------------------------------------------------------------------

router.get(
  '/financial-pnl',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const accounts = (
      await query(
        `SELECT ga.id, ga.code, ga.name, ga.type, ga.normal_balance,
                COALESCE(SUM(gjl.debit), 0) AS debit_total,
                COALESCE(SUM(gjl.credit), 0) AS credit_total
         FROM gl_accounts ga
         LEFT JOIN gl_journal_lines gjl ON gjl.account_id = ga.id
         LEFT JOIN gl_journals gj ON gj.id = gjl.journal_id
              AND DATE(gj.journal_date) BETWEEN $1 AND $2
         WHERE ga.type IN ('PENDAPATAN', 'BEBAN')
         GROUP BY ga.id, ga.code, ga.name, ga.type, ga.normal_balance
         ORDER BY ga.code ASC`,
        [from, to]
      )
    ).rows;
    let revenue = 0;
    let expense = 0;
    for (const acc of accounts) {
      const debit = Number(acc.debit_total) || 0;
      const credit = Number(acc.credit_total) || 0;
      const balance = acc.normal_balance === 'credit' ? credit - debit : debit - credit;
      if (acc.type === 'PENDAPATAN') revenue += balance;
      if (acc.type === 'BEBAN') expense += balance;
    }
    res.json({
      period: { from, to },
      totals: {
        revenue,
        expense,
        net_profit: revenue - expense,
      },
      accounts,
    });
  }
);

router.get(
  '/financial-balance-sheet',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { to } = defaultRange(req.query);
    const accounts = (
      await query(
        `SELECT ga.id, ga.code, ga.name, ga.type, ga.normal_balance,
                COALESCE(SUM(gjl.debit), 0) AS debit_total,
                COALESCE(SUM(gjl.credit), 0) AS credit_total
         FROM gl_accounts ga
         LEFT JOIN gl_journal_lines gjl ON gjl.account_id = ga.id
         LEFT JOIN gl_journals gj ON gj.id = gjl.journal_id
              AND DATE(gj.journal_date) <= $1
         WHERE ga.type IN ('ASET', 'KEWAJIBAN', 'MODAL')
         GROUP BY ga.id, ga.code, ga.name, ga.type, ga.normal_balance
         ORDER BY ga.code ASC`,
        [to]
      )
    ).rows;
    let asset = 0;
    let liability = 0;
    let equity = 0;
    const enriched = accounts.map((acc) => {
      const debit = Number(acc.debit_total) || 0;
      const credit = Number(acc.credit_total) || 0;
      const balance = acc.normal_balance === 'credit' ? credit - debit : debit - credit;
      if (acc.type === 'ASET') asset += balance;
      if (acc.type === 'KEWAJIBAN') liability += balance;
      if (acc.type === 'MODAL') equity += balance;
      return { ...acc, balance };
    });
    res.json({
      as_of: to,
      totals: { asset, liability, equity },
      accounts: enriched,
    });
  }
);

router.get(
  '/financial-cashflow',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const rows = (
      await query(
        `SELECT DATE(ct.tanggal) AS date,
                ct.tipe,
                COALESCE(ct.kategori, '-') AS kategori,
                COALESCE(SUM(ct.jumlah), 0) AS amount
         FROM cash_transactions ct
         WHERE DATE(ct.tanggal) BETWEEN $1 AND $2
         GROUP BY DATE(ct.tanggal), ct.tipe, ct.kategori
         ORDER BY date ASC`,
        [from, to]
      )
    ).rows;
    const totals = rows.reduce(
      (acc, row) => {
        const amt = Number(row.amount) || 0;
        if (row.tipe === 'pemasukan') acc.in += amt;
        if (row.tipe === 'pengeluaran') acc.out += amt;
        return acc;
      },
      { in: 0, out: 0 }
    );
    res.json({ period: { from, to }, totals, rows });
  }
);

// ---------------------------------------------------------------------------
// MARKETING — placeholder (campaign table belum ada di main)
// ---------------------------------------------------------------------------

router.get(
  '/marketing-campaign',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  async (req, res) => {
    const { from, to } = defaultRange(req.query);
    const exists = (await query(`SELECT to_regclass('public.marketing_campaigns') AS reg`)).rows[0];
    if (!exists || !exists.reg) {
      res.json({ period: { from, to }, rows: [], placeholder: true });
      return;
    }
    const rows = (
      await query(
        `SELECT c.id, c.name, c.channel,
                (SELECT COUNT(*) FROM marketing_campaign_recipients r WHERE r.campaign_id = c.id) AS audience_count,
                c.sent_count, c.delivered_count, c.opened_count, c.status, c.scheduled_at
         FROM marketing_campaigns c
         WHERE DATE(COALESCE(c.scheduled_at, c.created_at)) BETWEEN $1 AND $2
         ORDER BY COALESCE(c.scheduled_at, c.created_at) DESC`,
        [from, to]
      )
    ).rows;
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// SCHEDULE (Prime+) — CRUD
// ---------------------------------------------------------------------------

router.get('/schedule', authenticateToken, async (req, res) => {
  const rows = (await query(`SELECT * FROM report_schedules ORDER BY created_at DESC`)).rows;
  res.json(rows);
});

router.get('/schedule/:id', authenticateToken, async (req, res) => {
  const row = (await query(`SELECT * FROM report_schedules WHERE id = $1`, [req.params.id]))
    .rows[0];
  if (!row) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
  res.json(row);
});

router.post(
  '/schedule',
  authenticateToken,
  validate({ body: ReportScheduleCreateSchema }),
  async (req, res) => {
    const data = req.body;
    const ins = await query(
      `INSERT INTO report_schedules
           (report_key, name, params_json, frequency, recipients, format, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        data.report_key,
        data.name,
        data.params_json || null,
        data.frequency,
        data.recipients || null,
        data.format || 'pdf',
        data.is_active ?? 1,
        req.user?.id || null,
      ]
    );
    const created = (await query(`SELECT * FROM report_schedules WHERE id = $1`, [ins.rows[0].id]))
      .rows[0];
    res.status(201).json(created);
  }
);

router.put(
  '/schedule/:id',
  authenticateToken,
  validate({ body: ReportScheduleUpdateSchema }),
  async (req, res) => {
    const existing = (await query(`SELECT * FROM report_schedules WHERE id = $1`, [req.params.id]))
      .rows[0];
    if (!existing) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
    const data = req.body;
    const merged = {
      report_key: data.report_key || existing.report_key,
      name: data.name || existing.name,
      params_json: data.params_json !== undefined ? data.params_json : existing.params_json,
      frequency: data.frequency || existing.frequency,
      recipients: data.recipients !== undefined ? data.recipients : existing.recipients,
      format: data.format || existing.format,
      is_active: data.is_active !== undefined ? data.is_active : existing.is_active,
    };
    await query(
      `UPDATE report_schedules
         SET report_key = $1, name = $2, params_json = $3, frequency = $4,
             recipients = $5, format = $6, is_active = $7
       WHERE id = $8`,
      [
        merged.report_key,
        merged.name,
        merged.params_json,
        merged.frequency,
        merged.recipients,
        merged.format,
        merged.is_active,
        req.params.id,
      ]
    );
    const updated = (await query(`SELECT * FROM report_schedules WHERE id = $1`, [req.params.id]))
      .rows[0];
    res.json(updated);
  }
);

router.delete('/schedule/:id', authenticateToken, async (req, res) => {
  const existing = (await query(`SELECT id FROM report_schedules WHERE id = $1`, [req.params.id]))
    .rows[0];
  if (!existing) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
  await query(`DELETE FROM report_schedules WHERE id = $1`, [req.params.id]);
  res.status(204).send();
});

// P2-04 PR-C: enqueue the schedule onto the `report` queue. The processor
// (`apps/backend/src/jobs/report.js`) generates the report and chains a
// downstream `email` job per recipient. Tier-gated: Prime+ only.
router.post('/schedule/:id/run', authenticateToken, requireTier('prime'), async (req, res) => {
  const existing = (await query(`SELECT * FROM report_schedules WHERE id = $1`, [req.params.id]))
    .rows[0];
  if (!existing) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
  const now = new Date().toISOString();
  await query(`UPDATE report_schedules SET last_run_at = $1 WHERE id = $2`, [now, req.params.id]);

  const data = {
    tenant_id: req.tenantId ?? null,
    user_id: req.user?.id ?? null,
    schedule_id: existing.id,
    report_key: existing.report_key,
    name: existing.name,
    params_json: existing.params_json ?? null,
    recipients: existing.recipients ?? null,
    format: existing.format ?? 'pdf',
  };

  if (!isQueueEnabled()) {
    // Sync fallback: keep the legacy "stub" contract — the schedule's
    // last_run_at has been updated, but no actual generation/delivery
    // happens. Surfaces that the worker is offline.
    return res.json({
      message: 'Scheduled report queued (sync fallback — REDIS_URL unset).',
      last_run_at: now,
      enqueued: false,
      sync: true,
    });
  }
  const queue = getOrCreateQueue(QUEUE_NAMES.REPORT);
  const job = await safeEnqueue(queue, 'generate', data);
  if (!job) {
    return res.json({
      message: 'Scheduled report queued (sync fallback).',
      last_run_at: now,
      enqueued: false,
      sync: true,
    });
  }
  return res.status(202).json({
    message: 'Scheduled report queued.',
    last_run_at: now,
    enqueued: true,
    job_id: job.id,
    queue: queue.name,
  });
});

module.exports = router;
