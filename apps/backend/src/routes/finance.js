const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  CashAccountCreateSchema,
  CashAccountUpdateSchema,
  CashTransactionCreateSchema,
} = require('@vipos/shared');

const router = express.Router();

async function getAccountSaldo(q, accountId) {
  const row = (
    await q(
      `SELECT
        (SELECT saldo_awal FROM cash_accounts WHERE id = $1) AS saldo_awal,
        COALESCE(SUM(CASE
          WHEN tipe = 'pemasukan' AND account_id = $2 THEN jumlah
          WHEN tipe = 'pengeluaran' AND account_id = $3 THEN -jumlah
          WHEN tipe = 'transfer' AND account_id = $4 THEN -jumlah
          WHEN tipe = 'transfer' AND account_to_id = $5 THEN jumlah
          ELSE 0 END), 0) AS movement
       FROM cash_transactions
       WHERE account_id = $6 OR account_to_id = $7`,
      [accountId, accountId, accountId, accountId, accountId, accountId, accountId]
    )
  ).rows[0];
  return (Number(row.saldo_awal) || 0) + (Number(row.movement) || 0);
}

// =============== CASH ACCOUNTS (Buku Kas) ===============

router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT * FROM cash_accounts
         WHERE is_active = 1
         ORDER BY kode`
      )
    ).rows;
    const enriched = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        saldo: await getAccountSaldo(query, r.id),
      }))
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/accounts',
  authenticateToken,
  requireAdmin,
  validate({ body: CashAccountCreateSchema }),
  async (req, res) => {
    try {
      const { kode, tipe, nama, kategori, saldo_awal } = req.body;
      const ins = await query(
        `INSERT INTO cash_accounts (kode, tipe, nama, kategori, saldo_awal)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          kode.trim(),
          tipe || 'detail',
          nama.trim(),
          kategori ? kategori.trim() : 'Kas & Bank',
          saldo_awal ?? 0,
        ]
      );
      const row = (await query('SELECT * FROM cash_accounts WHERE id = $1', [ins.rows[0].id]))
        .rows[0];
      res.status(201).json({ ...row, saldo: await getAccountSaldo(query, row.id) });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Kode akun sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/accounts/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: CashAccountUpdateSchema }),
  async (req, res) => {
    try {
      const { kode, tipe, nama, kategori, saldo_awal } = req.body;
      const existing = (await query('SELECT * FROM cash_accounts WHERE id = $1', [req.params.id]))
        .rows[0];
      if (!existing) return res.status(404).json({ error: 'Akun tidak ditemukan' });

      await query(
        `UPDATE cash_accounts
            SET kode = $1, tipe = $2, nama = $3, kategori = $4, saldo_awal = $5
          WHERE id = $6`,
        [
          (kode || existing.kode).trim(),
          tipe || existing.tipe,
          (nama || existing.nama).trim(),
          kategori ? kategori.trim() : existing.kategori,
          saldo_awal ?? existing.saldo_awal,
          req.params.id,
        ]
      );
      const row = (await query('SELECT * FROM cash_accounts WHERE id = $1', [req.params.id]))
        .rows[0];
      res.json({ ...row, saldo: await getAccountSaldo(query, row.id) });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Kode akun sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const used = (
      await query(
        'SELECT COUNT(*) as count FROM cash_transactions WHERE account_id = $1 OR account_to_id = $2',
        [req.params.id, req.params.id]
      )
    ).rows[0];
    if (Number(used.count) > 0) {
      await query('UPDATE cash_accounts SET is_active = 0 WHERE id = $1', [req.params.id]);
      return res.json({
        message: 'Akun dinonaktifkan karena sudah memiliki transaksi',
      });
    }
    await query('DELETE FROM cash_accounts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Akun berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== CASH TRANSACTIONS ===============

router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { tipe, account_id, from, to, limit = 100 } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;

    if (tipe) {
      conditions.push(`ct.tipe = $${p++}`);
      params.push(tipe);
    }
    if (account_id) {
      conditions.push(`(ct.account_id = $${p++} OR ct.account_to_id = $${p++})`);
      params.push(account_id, account_id);
    }
    if (from) {
      conditions.push(`ct.tanggal >= $${p++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`ct.tanggal <= $${p++}`);
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = (
      await query(
        `SELECT
           ct.*,
           a1.nama AS account_name,
           a1.kode AS account_kode,
           a2.nama AS account_to_name,
           u.name AS user_name
         FROM cash_transactions ct
         LEFT JOIN cash_accounts a1 ON a1.id = ct.account_id
         LEFT JOIN cash_accounts a2 ON a2.id = ct.account_to_id
         LEFT JOIN users u ON u.id = ct.user_id
         ${where}
         ORDER BY ct.tanggal DESC, ct.id DESC
         LIMIT $${p}`,
        [...params, parseInt(limit, 10) || 100]
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/transactions',
  authenticateToken,
  validate({ body: CashTransactionCreateSchema }),
  async (req, res) => {
    try {
      const { tanggal, tipe, account_id, account_to_id, kategori, jumlah, keterangan, reference } =
        req.body;
      const ins = await query(
        `INSERT INTO cash_transactions
           (tanggal, tipe, account_id, account_to_id, kategori, jumlah, keterangan, reference, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          tanggal || new Date().toISOString().slice(0, 10),
          tipe,
          account_id,
          account_to_id ?? null,
          kategori ? kategori.trim() : null,
          jumlah,
          keterangan ? keterangan.trim() : null,
          reference ? reference.trim() : null,
          req.user.id,
        ]
      );

      const row = (
        await query(
          `SELECT
             ct.*,
             a1.nama AS account_name,
             a1.kode AS account_kode,
             a2.nama AS account_to_name,
             u.name AS user_name
           FROM cash_transactions ct
           LEFT JOIN cash_accounts a1 ON a1.id = ct.account_id
           LEFT JOIN cash_accounts a2 ON a2.id = ct.account_to_id
           LEFT JOIN users u ON u.id = ct.user_id
           WHERE ct.id = $1`,
          [ins.rows[0].id]
        )
      ).rows[0];
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/transactions/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM cash_transactions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Transaksi keuangan dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== SUMMARY ===============

router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;
    if (from) {
      conditions.push(`tanggal >= $${p++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`tanggal <= $${p++}`);
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = (
      await query(
        `SELECT tipe, COALESCE(SUM(jumlah), 0) AS total, COUNT(*) AS count
         FROM cash_transactions
         ${where}
         GROUP BY tipe`,
        params
      )
    ).rows;

    const summary = { pemasukan: 0, pengeluaran: 0, transfer: 0, count: 0 };
    rows.forEach((r) => {
      summary[r.tipe] = Number(r.total);
      summary.count += Number(r.count);
    });
    summary.saldo = summary.pemasukan - summary.pengeluaran;
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
