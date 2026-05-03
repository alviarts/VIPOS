const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function getAccountSaldo(db, accountId) {
  const row = db
    .prepare(
      `
    SELECT
      (SELECT saldo_awal FROM cash_accounts WHERE id = ?) AS saldo_awal,
      COALESCE(SUM(CASE
        WHEN tipe = 'pemasukan' AND account_id = ? THEN jumlah
        WHEN tipe = 'pengeluaran' AND account_id = ? THEN -jumlah
        WHEN tipe = 'transfer' AND account_id = ? THEN -jumlah
        WHEN tipe = 'transfer' AND account_to_id = ? THEN jumlah
        ELSE 0 END), 0) AS movement
    FROM cash_transactions
    WHERE account_id = ? OR account_to_id = ?
  `
    )
    .get(accountId, accountId, accountId, accountId, accountId, accountId, accountId);
  return (row.saldo_awal || 0) + (row.movement || 0);
}

// =============== CASH ACCOUNTS (Buku Kas) ===============

router.get('/accounts', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `
      SELECT * FROM cash_accounts
      WHERE is_active = 1
      ORDER BY kode
    `
      )
      .all();
    const enriched = rows.map((r) => ({ ...r, saldo: getAccountSaldo(db, r.id) }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { kode, tipe, nama, kategori, saldo_awal } = req.body;
    if (!kode || !nama) return res.status(400).json({ error: 'Kode dan nama akun wajib diisi' });
    const db = getDb();
    const result = db
      .prepare(
        `
      INSERT INTO cash_accounts (kode, tipe, nama, kategori, saldo_awal)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(
        kode.trim(),
        tipe === 'header' ? 'header' : 'detail',
        nama.trim(),
        kategori ? kategori.trim() : 'Kas & Bank',
        Number.isFinite(parseFloat(saldo_awal)) ? parseFloat(saldo_awal) : 0
      );
    const row = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...row, saldo: getAccountSaldo(db, row.id) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kode akun sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/accounts/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { kode, tipe, nama, kategori, saldo_awal } = req.body;
    const db = getDb();
    db.prepare(
      `
      UPDATE cash_accounts
         SET kode = ?, tipe = ?, nama = ?, kategori = ?, saldo_awal = ?
       WHERE id = ?
    `
    ).run(
      (kode || '').trim(),
      tipe === 'header' ? 'header' : 'detail',
      (nama || '').trim(),
      kategori ? kategori.trim() : 'Kas & Bank',
      Number.isFinite(parseFloat(saldo_awal)) ? parseFloat(saldo_awal) : 0,
      req.params.id
    );
    const row = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(req.params.id);
    res.json({ ...row, saldo: getAccountSaldo(db, row.id) });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kode akun sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const used = db
      .prepare(
        'SELECT COUNT(*) as count FROM cash_transactions WHERE account_id = ? OR account_to_id = ?'
      )
      .get(req.params.id, req.params.id);
    if (used.count > 0) {
      db.prepare('UPDATE cash_accounts SET is_active = 0 WHERE id = ?').run(req.params.id);
      return res.json({ message: 'Akun dinonaktifkan karena sudah memiliki transaksi' });
    }
    db.prepare('DELETE FROM cash_accounts WHERE id = ?').run(req.params.id);
    res.json({ message: 'Akun berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== CASH TRANSACTIONS ===============

router.get('/transactions', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { tipe, account_id, from, to, limit = 100 } = req.query;
    const conditions = [];
    const params = [];

    if (tipe) {
      conditions.push('ct.tipe = ?');
      params.push(tipe);
    }
    if (account_id) {
      conditions.push('(ct.account_id = ? OR ct.account_to_id = ?)');
      params.push(account_id, account_id);
    }
    if (from) {
      conditions.push('ct.tanggal >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('ct.tanggal <= ?');
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `
      SELECT
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
      LIMIT ?
    `
      )
      .all(...params, parseInt(limit, 10) || 100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transactions', authenticateToken, (req, res) => {
  try {
    const { tanggal, tipe, account_id, account_to_id, kategori, jumlah, keterangan, reference } =
      req.body;
    if (!tipe || !['pemasukan', 'pengeluaran', 'transfer'].includes(tipe)) {
      return res.status(400).json({ error: 'Tipe transaksi tidak valid' });
    }
    if (!account_id) return res.status(400).json({ error: 'Akun wajib dipilih' });

    const jumlahNum = parseFloat(jumlah);
    if (!Number.isFinite(jumlahNum) || jumlahNum <= 0) {
      return res.status(400).json({ error: 'Jumlah harus lebih dari 0' });
    }

    if (tipe === 'transfer' && !account_to_id) {
      return res.status(400).json({ error: 'Akun tujuan wajib dipilih untuk transfer' });
    }

    const db = getDb();
    const result = db
      .prepare(
        `
      INSERT INTO cash_transactions
        (tanggal, tipe, account_id, account_to_id, kategori, jumlah, keterangan, reference, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        tanggal || new Date().toISOString().slice(0, 10),
        tipe,
        parseInt(account_id, 10),
        account_to_id ? parseInt(account_to_id, 10) : null,
        kategori ? kategori.trim() : null,
        jumlahNum,
        keterangan ? keterangan.trim() : null,
        reference ? reference.trim() : null,
        req.user.id
      );

    const row = db
      .prepare(
        `
      SELECT
        ct.*,
        a1.nama AS account_name,
        a1.kode AS account_kode,
        a2.nama AS account_to_name,
        u.name AS user_name
      FROM cash_transactions ct
      LEFT JOIN cash_accounts a1 ON a1.id = ct.account_id
      LEFT JOIN cash_accounts a2 ON a2.id = ct.account_to_id
      LEFT JOIN users u ON u.id = ct.user_id
      WHERE ct.id = ?
    `
      )
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/transactions/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(req.params.id);
    res.json({ message: 'Transaksi keuangan dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============== SUMMARY ===============

router.get('/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) {
      conditions.push('tanggal >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('tanggal <= ?');
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `
      SELECT tipe, COALESCE(SUM(jumlah), 0) AS total, COUNT(*) AS count
      FROM cash_transactions
      ${where}
      GROUP BY tipe
    `
      )
      .all(...params);

    const summary = { pemasukan: 0, pengeluaran: 0, transfer: 0, count: 0 };
    rows.forEach((r) => {
      summary[r.tipe] = r.total;
      summary.count += r.count;
    });
    summary.saldo = summary.pemasukan - summary.pengeluaran;
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
