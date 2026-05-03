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
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  ReportFilterQuerySchema,
  ReportScheduleCreateSchema,
  ReportScheduleUpdateSchema,
} = require('@vipos/shared');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultRange(query) {
  const today = new Date().toISOString().slice(0, 10);
  const to = query.to || today;
  const from =
    query.from ||
    (() => {
      const d = new Date(to);
      d.setDate(d.getDate() - 29);
      return d.toISOString().slice(0, 10);
    })();
  return { from, to };
}

function whereDateRange(field, from, to, params) {
  params.push(from, to);
  return `DATE(${field}) BETWEEN ? AND ?`;
}

function appendCashierFilter(where, params, cashierId) {
  if (cashierId) {
    where.push('t.user_id = ?');
    params.push(cashierId);
  }
}

function appendPaymentFilter(where, params, method) {
  if (method) {
    where.push('t.payment_method = ?');
    params.push(method);
  }
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const { cashier_id, payment_method } = req.query;
    const where = ["t.status = 'completed'"];
    const params = [];
    where.push(whereDateRange('t.created_at', from, to, params));
    appendCashierFilter(where, params, cashier_id);
    appendPaymentFilter(where, params, payment_method);
    const whereSql = where.join(' AND ');

    const kpi = db
      .prepare(
        `SELECT
           COALESCE(SUM(t.total_amount), 0) AS gross_revenue,
           COUNT(*) AS transaction_count,
           COUNT(DISTINCT t.customer_id) AS unique_customers,
           COALESCE(SUM(
             (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id)
           ), 0) AS item_count
         FROM transactions t
         WHERE ${whereSql}`
      )
      .get(...params);

    const voided = db
      .prepare(
        `SELECT COUNT(*) AS voided_count, COALESCE(SUM(total_amount), 0) AS voided_value
         FROM transactions
         WHERE status = 'voided'
           AND DATE(created_at) BETWEEN ? AND ?`
      )
      .get(from, to);

    const dailyTrend = db
      .prepare(
        `SELECT DATE(t.created_at) AS date,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                COUNT(*) AS transactions
         FROM transactions t
         WHERE ${whereSql}
         GROUP BY DATE(t.created_at)
         ORDER BY date ASC`
      )
      .all(...params);

    const topProducts = db
      .prepare(
        `SELECT ti.product_id,
                ti.product_name,
                COALESCE(SUM(ti.quantity), 0) AS qty,
                COALESCE(SUM(ti.subtotal), 0) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE ${whereSql}
         GROUP BY ti.product_id, ti.product_name
         ORDER BY qty DESC
         LIMIT 5`
      )
      .all(...params);

    const paymentBreakdown = db
      .prepare(
        `SELECT t.payment_method AS method,
                COUNT(*) AS count,
                COALESCE(SUM(t.total_amount), 0) AS total
         FROM transactions t
         WHERE ${whereSql}
         GROUP BY t.payment_method`
      )
      .all(...params);

    const transactionCount = kpi.transaction_count || 0;
    const grossRevenue = kpi.gross_revenue || 0;
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
        item_count: kpi.item_count || 0,
        unique_customers: kpi.unique_customers || 0,
        voided_count: voided.voided_count || 0,
        voided_value: voided.voided_value || 0,
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const { cashier_id, payment_method, limit = 500 } = req.query;
    const where = [];
    const params = [];
    where.push(whereDateRange('t.created_at', from, to, params));
    appendCashierFilter(where, params, cashier_id);
    appendPaymentFilter(where, params, payment_method);
    const whereSql = where.join(' AND ');

    const rows = db
      .prepare(
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
         LIMIT ?`
      )
      .all(...params, Number(limit) || 500);

    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-daily',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const where = ["t.status = 'completed'"];
    const params = [];
    where.push(whereDateRange('t.created_at', from, to, params));
    appendCashierFilter(where, params, req.query.cashier_id);
    appendPaymentFilter(where, params, req.query.payment_method);
    const whereSql = where.join(' AND ');

    const rows = db
      .prepare(
        `SELECT DATE(t.created_at) AS date,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id)
                ), 0) AS items
         FROM transactions t
         WHERE ${whereSql}
         GROUP BY DATE(t.created_at)
         ORDER BY date ASC`
      )
      .all(...params);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-outlet',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    // VIPOS belum punya outlet_id di transactions; sebelum migration full
    // multi-outlet, treat semua transaksi sebagai outlet utama (id=1).
    const outletRow = db
      .prepare(`SELECT id, name FROM outlets WHERE is_main = 1 AND is_active = 1 LIMIT 1`)
      .get() || { id: 1, name: 'Outlet Pusat' };
    const aggregate = db
      .prepare(
        `SELECT COUNT(*) AS transactions,
                COALESCE(SUM(total_amount), 0) AS revenue,
                COALESCE(SUM(
                  (SELECT COALESCE(SUM(quantity), 0) FROM transaction_items WHERE transaction_id = t.id)
                ), 0) AS items
         FROM transactions t
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN ? AND ?`
      )
      .get(from, to);
    const transactions = aggregate.transactions || 0;
    const rows = [
      {
        outlet_id: outletRow.id,
        outlet_name: outletRow.name,
        transactions,
        revenue: aggregate.revenue || 0,
        items: aggregate.items || 0,
        avg_ticket: transactions ? aggregate.revenue / transactions : 0,
      },
    ];
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-category',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
        `SELECT c.id AS category_id,
                COALESCE(c.name, '(Tanpa Kategori)') AS category_name,
                COALESCE(SUM(ti.quantity), 0) AS qty,
                COALESCE(SUM(ti.subtotal), 0) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN products p ON p.id = ti.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY c.id, c.name
         ORDER BY revenue DESC`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-department',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
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
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY d.id, d.name
         ORDER BY revenue DESC`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-product',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const limit = Number(req.query.limit) || 100;
    const rows = db
      .prepare(
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
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY ti.product_id, ti.product_name, p.harga_modal
         ORDER BY revenue DESC
         LIMIT ?`
      )
      .all(from, to, limit);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-cashier',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
        `SELECT u.id AS cashier_id,
                COALESCE(u.name, u.username) AS cashier_name,
                COUNT(t.id) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS revenue,
                CASE WHEN COUNT(t.id) = 0 THEN 0
                     ELSE ROUND(SUM(t.total_amount) * 1.0 / COUNT(t.id), 2)
                END AS avg_ticket
         FROM users u
         LEFT JOIN transactions t ON t.user_id = u.id
              AND t.status = 'completed'
              AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY u.id, u.name, u.username
         HAVING transactions > 0
         ORDER BY revenue DESC`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/sales-by-payment-method',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
        `SELECT t.payment_method AS method,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS gross_amount
         FROM transactions t
         WHERE t.status = 'completed'
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY t.payment_method
         ORDER BY gross_amount DESC`
      )
      .all(from, to);
    // MDR & net dihitung dari payment_methods table jika ada.
    const mdrRows = db
      .prepare(
        `SELECT code, name, type, fee_percent, fee_flat FROM payment_methods WHERE is_active = 1`
      )
      .all()
      .reduce((acc, row) => {
        const keys = [row.code, row.name, row.type].filter(Boolean);
        for (const k of keys) acc[String(k).toLowerCase()] = row;
        return acc;
      }, {});
    const enriched = rows.map((row) => {
      const pm = mdrRows[(row.method || '').toLowerCase()];
      const feePct = pm?.fee_percent || 0;
      const feeFlat = pm?.fee_flat || 0;
      const mdrAmount = row.gross_amount * (feePct / 100) + feeFlat * (row.transactions || 0);
      return {
        ...row,
        mdr_pct: feePct,
        mdr_amount: mdrAmount,
        net_amount: row.gross_amount - mdrAmount,
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    // Pakai cash_transactions sebagai proxy "drawer movement".
    const rows = db
      .prepare(
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
         WHERE DATE(ct.tanggal) BETWEEN ? AND ?
         ORDER BY ct.tanggal DESC, ct.id DESC`
      )
      .all(from, to);
    const totals = rows.reduce(
      (acc, row) => {
        if (row.tipe === 'pemasukan') acc.income += row.jumlah;
        if (row.tipe === 'pengeluaran') acc.expense += row.jumlah;
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    // Surrogate "shift" = grouping per cashier per day.
    const rows = db
      .prepare(
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
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY DATE(t.created_at), u.id
         ORDER BY shift_date DESC, cashier_name ASC`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// ADJUSTMENTS — void, refund, promo, loyalty, coupon
// ---------------------------------------------------------------------------

router.get('/void', authenticateToken, validate({ query: ReportFilterQuerySchema }), (req, res) => {
  const db = getDb();
  const { from, to } = defaultRange(req.query);
  const rows = db
    .prepare(
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
           AND DATE(t.created_at) BETWEEN ? AND ?
         ORDER BY t.created_at DESC`
    )
    .all(from, to);
  const total = rows.reduce(
    (acc, row) => ({
      count: acc.count + 1,
      value: acc.value + (row.total_amount || 0),
    }),
    { count: 0, value: 0 }
  );
  res.json({ period: { from, to }, total, rows });
});

router.get(
  '/refund',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    // VIPOS belum punya tabel khusus refund/partial — surface row dari `transactions`
    // dengan total_amount negatif (pattern store-credit) sebagai proxy.
    const rows = db
      .prepare(
        `SELECT id, invoice_number, created_at, total_amount, payment_method, notes
         FROM transactions
         WHERE total_amount < 0
           AND DATE(created_at) BETWEEN ? AND ?
         ORDER BY created_at DESC`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/promo',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    // Aggregate dari tabel promos kalau ada kolom usage tracking-nya.
    const rows = db
      .prepare(
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
           (valid_from IS NULL OR DATE(valid_from) <= ?)
           AND (valid_until IS NULL OR DATE(valid_until) >= ?)
         )
         ORDER BY current_use_count DESC, id DESC
         LIMIT 200`
      )
      .all(to, from);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/loyalty',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const totals = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) AS total_earned,
           COALESCE(SUM(CASE WHEN type = 'redeem' THEN points ELSE 0 END), 0) AS total_redeemed,
           COALESCE(SUM(CASE WHEN type = 'expire' THEN points ELSE 0 END), 0) AS total_expired
         FROM loyalty_transactions
         WHERE DATE(created_at) BETWEEN ? AND ?`
      )
      .get(from, to);
    const topEarners = db
      .prepare(
        `SELECT customer_id,
                (SELECT name FROM customers WHERE id = lt.customer_id) AS customer_name,
                COALESCE(SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END), 0) AS earned
         FROM loyalty_transactions lt
         WHERE DATE(created_at) BETWEEN ? AND ?
         GROUP BY customer_id
         ORDER BY earned DESC
         LIMIT 10`
      )
      .all(from, to);
    res.json({ period: { from, to }, totals, top_earners: topEarners });
  }
);

router.get(
  '/coupon',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
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
              AND DATE(cr.redeemed_at) BETWEEN ? AND ?
         GROUP BY c.id
         ORDER BY c.created_at DESC
         LIMIT 500`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// TAX & CUSTOMER
// ---------------------------------------------------------------------------

router.get('/tax', authenticateToken, validate({ query: ReportFilterQuerySchema }), (req, res) => {
  const db = getDb();
  const { from, to } = defaultRange(req.query);
  // Belum ada line-level tax breakdown di transactions; return row per
  // tax_rate dengan estimasi (gross / (1+rate)) * rate.
  const taxes = db.prepare(`SELECT id, code, name, rate FROM tax_rates WHERE is_active = 1`).all();
  const aggregate = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) AS gross
         FROM transactions
         WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?`
    )
    .get(from, to);
  const rows = taxes.map((tax) => {
    const rate = tax.rate || 0;
    const base = rate ? aggregate.gross / (1 + rate / 100) : aggregate.gross;
    const taxAmount = aggregate.gross - base;
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
});

router.get(
  '/customer',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const totals = db
      .prepare(
        `SELECT COUNT(DISTINCT customer_id) AS active_customers,
                COALESCE(AVG(total_amount), 0) AS avg_spend,
                COUNT(*) AS transactions,
                COALESCE(SUM(total_amount), 0) AS total_spend
         FROM transactions
         WHERE status = 'completed'
           AND customer_id IS NOT NULL
           AND DATE(created_at) BETWEEN ? AND ?`
      )
      .get(from, to);
    const newCustomers = db
      .prepare(
        `SELECT COUNT(*) AS new_customers
         FROM (
           SELECT customer_id, MIN(DATE(created_at)) AS first_date
           FROM transactions
           WHERE status = 'completed' AND customer_id IS NOT NULL
           GROUP BY customer_id
         ) sub
         WHERE first_date BETWEEN ? AND ?`
      )
      .get(from, to);
    const top = db
      .prepare(
        `SELECT t.customer_id,
                c.name,
                COUNT(*) AS transactions,
                COALESCE(SUM(t.total_amount), 0) AS total_spend
         FROM transactions t
         LEFT JOIN customers c ON c.id = t.customer_id
         WHERE t.status = 'completed'
           AND t.customer_id IS NOT NULL
           AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY t.customer_id, c.name
         ORDER BY total_spend DESC
         LIMIT 10`
      )
      .all(from, to);
    res.json({
      period: { from, to },
      totals: {
        ...totals,
        new_customers: newCustomers.new_customers,
        returning_customers: (totals.active_customers || 0) - (newCustomers.new_customers || 0),
      },
      top_customers: top,
    });
  }
);

// ---------------------------------------------------------------------------
// INVENTORY
// ---------------------------------------------------------------------------

router.get('/inventory-stock', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
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
    .all();
  const totals = rows.reduce(
    (acc, row) => ({
      products: acc.products + 1,
      stock_qty: acc.stock_qty + (row.stock || 0),
      stock_value: acc.stock_value + (row.stock_value || 0),
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
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
         WHERE DATE(im.tanggal) BETWEEN ? AND ?
         ORDER BY im.tanggal DESC, im.id DESC
         LIMIT 1000`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

router.get(
  '/inventory-turnover',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
        `SELECT p.id AS product_id,
                p.sku,
                p.name,
                p.stock AS current_stock,
                COALESCE(SUM(ti.quantity), 0) AS sold_qty,
                CASE
                  WHEN p.stock + COALESCE(SUM(ti.quantity), 0) = 0 THEN 0
                  ELSE ROUND(
                    (COALESCE(SUM(ti.quantity), 0) * 1.0) /
                    NULLIF((p.stock + COALESCE(SUM(ti.quantity), 0)) / 2.0, 0),
                    3
                  )
                END AS turnover_ratio
         FROM products p
         LEFT JOIN transaction_items ti ON ti.product_id = p.id
         LEFT JOIN transactions t ON t.id = ti.transaction_id
              AND t.status = 'completed'
              AND DATE(t.created_at) BETWEEN ? AND ?
         GROUP BY p.id, p.sku, p.name, p.stock
         ORDER BY sold_qty DESC
         LIMIT 200`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

router.get('/inventory-value', authenticateToken, (req, res) => {
  const db = getDb();
  const result = db
    .prepare(
      `SELECT COUNT(*) AS products,
              COALESCE(SUM(stock), 0) AS qty,
              COALESCE(SUM(stock * COALESCE(harga_modal, 0)), 0) AS total_value
       FROM products
       WHERE is_active = 1`
    )
    .get();
  const byCategory = db
    .prepare(
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
    .all();
  res.json({ totals: result, by_category: byCategory });
});

// ---------------------------------------------------------------------------
// EMPLOYEE
// ---------------------------------------------------------------------------

router.get(
  '/employee-attendance',
  authenticateToken,
  validate({ query: ReportFilterQuerySchema }),
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    let rows = [];
    try {
      // Aggregate per (date, employee). attendance_logs cuma simpan event
      // (check_in / check_out / break_*) jadi kita pivot ke daily summary.
      rows = db
        .prepare(
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
           WHERE DATE(al.logged_at) BETWEEN ? AND ?
           GROUP BY DATE(al.logged_at), al.employee_id
           ORDER BY date DESC, employee_name ASC
           LIMIT 1000`
        )
        .all(from, to);
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    let rows = [];
    try {
      rows = db
        .prepare(
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
           WHERE DATE(sa.schedule_date) BETWEEN ? AND ?
           ORDER BY sa.schedule_date DESC, s.start_time ASC
           LIMIT 1000`
        )
        .all(from, to);
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    let rows = [];
    try {
      rows = db
        .prepare(
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
                  OR DATE(t.created_at) BETWEEN ? AND ?)
           ORDER BY ca.created_at DESC
           LIMIT 1000`
        )
        .all(from, to);
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const accounts = db
      .prepare(
        `SELECT ga.id, ga.code, ga.name, ga.type, ga.normal_balance,
                COALESCE(SUM(gjl.debit), 0) AS debit_total,
                COALESCE(SUM(gjl.credit), 0) AS credit_total
         FROM gl_accounts ga
         LEFT JOIN gl_journal_lines gjl ON gjl.account_id = ga.id
         LEFT JOIN gl_journals gj ON gj.id = gjl.journal_id
              AND DATE(gj.journal_date) BETWEEN ? AND ?
         WHERE ga.type IN ('PENDAPATAN', 'BEBAN')
         GROUP BY ga.id
         ORDER BY ga.code ASC`
      )
      .all(from, to);
    let revenue = 0;
    let expense = 0;
    for (const acc of accounts) {
      const balance =
        acc.normal_balance === 'credit'
          ? acc.credit_total - acc.debit_total
          : acc.debit_total - acc.credit_total;
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
  (req, res) => {
    const db = getDb();
    const { to } = defaultRange(req.query);
    const accounts = db
      .prepare(
        `SELECT ga.id, ga.code, ga.name, ga.type, ga.normal_balance,
                COALESCE(SUM(gjl.debit), 0) AS debit_total,
                COALESCE(SUM(gjl.credit), 0) AS credit_total
         FROM gl_accounts ga
         LEFT JOIN gl_journal_lines gjl ON gjl.account_id = ga.id
         LEFT JOIN gl_journals gj ON gj.id = gjl.journal_id
              AND DATE(gj.journal_date) <= ?
         WHERE ga.type IN ('ASET', 'KEWAJIBAN', 'MODAL')
         GROUP BY ga.id
         ORDER BY ga.code ASC`
      )
      .all(to);
    let asset = 0;
    let liability = 0;
    let equity = 0;
    const enriched = accounts.map((acc) => {
      const balance =
        acc.normal_balance === 'credit'
          ? acc.credit_total - acc.debit_total
          : acc.debit_total - acc.credit_total;
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const rows = db
      .prepare(
        `SELECT DATE(ct.tanggal) AS date,
                ct.tipe,
                COALESCE(ct.kategori, '-') AS kategori,
                COALESCE(SUM(ct.jumlah), 0) AS amount
         FROM cash_transactions ct
         WHERE DATE(ct.tanggal) BETWEEN ? AND ?
         GROUP BY DATE(ct.tanggal), ct.tipe, ct.kategori
         ORDER BY date ASC`
      )
      .all(from, to);
    const totals = rows.reduce(
      (acc, row) => {
        if (row.tipe === 'pemasukan') acc.in += row.amount;
        if (row.tipe === 'pengeluaran') acc.out += row.amount;
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
  (req, res) => {
    const db = getDb();
    const { from, to } = defaultRange(req.query);
    const exists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='marketing_campaigns'`)
      .get();
    if (!exists) {
      res.json({ period: { from, to }, rows: [], placeholder: true });
      return;
    }
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.channel,
                (SELECT COUNT(*) FROM marketing_campaign_recipients r WHERE r.campaign_id = c.id) AS audience_count,
                c.sent_count, c.delivered_count, c.opened_count, c.status, c.scheduled_at
         FROM marketing_campaigns c
         WHERE DATE(COALESCE(c.scheduled_at, c.created_at)) BETWEEN ? AND ?
         ORDER BY COALESCE(c.scheduled_at, c.created_at) DESC`
      )
      .all(from, to);
    res.json({ period: { from, to }, rows });
  }
);

// ---------------------------------------------------------------------------
// SCHEDULE (Prime+) — CRUD
// ---------------------------------------------------------------------------

router.get('/schedule', authenticateToken, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM report_schedules ORDER BY created_at DESC`).all();
  res.json(rows);
});

router.get('/schedule/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM report_schedules WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
  res.json(row);
});

router.post(
  '/schedule',
  authenticateToken,
  validate({ body: ReportScheduleCreateSchema }),
  (req, res) => {
    const db = getDb();
    const data = req.body;
    const result = db
      .prepare(
        `INSERT INTO report_schedules
           (report_key, name, params_json, frequency, recipients, format, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.report_key,
        data.name,
        data.params_json || null,
        data.frequency,
        data.recipients || null,
        data.format || 'pdf',
        data.is_active ?? 1,
        req.user?.id || null
      );
    const created = db
      .prepare(`SELECT * FROM report_schedules WHERE id = ?`)
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  }
);

router.put(
  '/schedule/:id',
  authenticateToken,
  validate({ body: ReportScheduleUpdateSchema }),
  (req, res) => {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM report_schedules WHERE id = ?`).get(req.params.id);
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
    db.prepare(
      `UPDATE report_schedules
         SET report_key = ?, name = ?, params_json = ?, frequency = ?,
             recipients = ?, format = ?, is_active = ?
       WHERE id = ?`
    ).run(
      merged.report_key,
      merged.name,
      merged.params_json,
      merged.frequency,
      merged.recipients,
      merged.format,
      merged.is_active,
      req.params.id
    );
    const updated = db.prepare(`SELECT * FROM report_schedules WHERE id = ?`).get(req.params.id);
    res.json(updated);
  }
);

router.delete('/schedule/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM report_schedules WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
  db.prepare(`DELETE FROM report_schedules WHERE id = ?`).run(req.params.id);
  res.status(204).send();
});

router.post('/schedule/:id/run', authenticateToken, (req, res) => {
  // Stub: actual cron + email belum diimplement; kita catat last_run_at agar
  // integrasi Prime+ scheduling di phase berikutnya bisa dibangun di atasnya.
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM report_schedules WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Schedule tidak ditemukan' });
  const now = new Date().toISOString();
  db.prepare(`UPDATE report_schedules SET last_run_at = ? WHERE id = ?`).run(now, req.params.id);
  res.json({
    message: 'Scheduled report queued (stub).',
    last_run_at: now,
  });
});

module.exports = router;
