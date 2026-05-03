const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  CustomerTagAssignSchema,
} = require('@vipos/shared');

const router = express.Router();

function generateKode(db) {
  const last = db
    .prepare(`SELECT kode FROM customers WHERE kode LIKE 'PLG%' ORDER BY id DESC LIMIT 1`)
    .get();
  if (!last) return 'PLG0001';
  const num = parseInt((last.kode || '').replace(/\D/g, ''), 10) || 0;
  return 'PLG' + String(num + 1).padStart(4, '0');
}

function loadTagsFor(db, customerIds) {
  if (!customerIds.length) return new Map();
  const placeholders = customerIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT m.customer_id, t.id, t.name, t.color
         FROM customer_tag_map m
         JOIN customer_tags t ON t.id = m.tag_id
        WHERE m.customer_id IN (${placeholders})
        ORDER BY t.name ASC`
    )
    .all(...customerIds);
  const byCustomer = new Map();
  for (const row of rows) {
    if (!byCustomer.has(row.customer_id)) byCustomer.set(row.customer_id, []);
    byCustomer.get(row.customer_id).push({ id: row.id, name: row.name, color: row.color });
  }
  return byCustomer;
}

function loadStatsFor(db, customerIds) {
  if (!customerIds.length) return new Map();
  const placeholders = customerIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT customer_id,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(total_amount), 0) AS total_spent,
              MAX(created_at) AS last_visit
         FROM transactions
        WHERE customer_id IN (${placeholders})
          AND status = 'completed'
        GROUP BY customer_id`
    )
    .all(...customerIds);
  const map = new Map();
  for (const row of rows) {
    map.set(row.customer_id, {
      transaction_count: row.transaction_count,
      total_spent: row.total_spent,
      last_visit: row.last_visit,
    });
  }
  return map;
}

function applyTagsTransaction(db, customerId, tagIds) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO customer_tag_map (customer_id, tag_id) VALUES (?, ?)'
  );
  const clear = db.prepare('DELETE FROM customer_tag_map WHERE customer_id = ?');
  const tx = db.transaction((ids) => {
    clear.run(customerId);
    ids.forEach((id) => insert.run(customerId, id));
  });
  tx(tagIds);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { search, active_only, group_id, tag_id, has_deposit, has_points } = req.query;

    const conditions = [];
    const params = [];
    if (active_only !== 'false') conditions.push('c.is_active = 1');
    if (search) {
      conditions.push(
        '(c.name LIKE ? OR c.kode LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.npwp LIKE ?)'
      );
      const q = `%${search}%`;
      params.push(q, q, q, q, q);
    }
    if (group_id) {
      conditions.push('c.customer_group_id = ?');
      params.push(parseInt(group_id, 10));
    }
    if (tag_id) {
      conditions.push('c.id IN (SELECT customer_id FROM customer_tag_map WHERE tag_id = ?)');
      params.push(parseInt(tag_id, 10));
    }
    if (has_deposit === 'true') conditions.push('c.deposit > 0');
    if (has_points === 'true') conditions.push('c.points > 0');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT c.*,
                g.name AS customer_group_name,
                g.color AS customer_group_color
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.customer_group_id
           ${where}
          ORDER BY c.created_at DESC`
      )
      .all(...params);

    const ids = rows.map((r) => r.id);
    const tagsByCustomer = loadTagsFor(db, ids);
    const statsByCustomer = loadStatsFor(db, ids);
    const enriched = rows.map((row) => ({
      ...row,
      tags: tagsByCustomer.get(row.id) || [],
      transaction_count: statsByCustomer.get(row.id)?.transaction_count ?? 0,
      total_spent: statsByCustomer.get(row.id)?.total_spent ?? 0,
      last_visit: statsByCustomer.get(row.id)?.last_visit ?? null,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.kode, c.name, c.phone, c.email, c.address, c.gender,
                c.birth_date, c.npwp, c.id_card_no, c.province, c.city, c.district,
                c.points, c.deposit, c.notes,
                g.name AS group_name
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.customer_group_id
          WHERE c.is_active = 1
          ORDER BY c.name ASC`
      )
      .all();
    const header = [
      'kode',
      'name',
      'phone',
      'email',
      'address',
      'gender',
      'birth_date',
      'npwp',
      'id_card_no',
      'province',
      'city',
      'district',
      'points',
      'deposit',
      'notes',
      'group_name',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(header.map((k) => csvEscape(r[k])).join(','));
    }
    const csv = '\uFEFF' + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT c.*,
                g.name AS customer_group_name,
                g.color AS customer_group_color
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.customer_group_id
          WHERE c.id = ?`
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    const tagsByCustomer = loadTagsFor(db, [row.id]);
    const statsByCustomer = loadStatsFor(db, [row.id]);
    const tags = tagsByCustomer.get(row.id) || [];
    const stats = statsByCustomer.get(row.id) || {
      transaction_count: 0,
      total_spent: 0,
      last_visit: null,
    };
    res.json({ ...row, tags, ...stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/transactions', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const exists = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!exists) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    const rows = db
      .prepare(
        `SELECT t.id, t.invoice_number, t.total_amount, t.payment_method,
                t.status, t.created_at,
                u.name AS cashier_name
           FROM transactions t
           LEFT JOIN users u ON u.id = t.user_id
          WHERE t.customer_id = ?
          ORDER BY t.created_at DESC
          LIMIT 200`
      )
      .all(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:id/tags',
  authenticateToken,
  validate({ body: CustomerTagAssignSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const exists = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
      if (!exists) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
      applyTagsTransaction(db, parseInt(req.params.id, 10), req.body.tag_ids);
      res.json({ message: 'Tag tersimpan' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/import', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ error: 'Body harus { rows: [...] }' });
    const db = getDb();

    const groups = db.prepare('SELECT id, name FROM customer_groups').all();
    const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g.id]));

    const findByPhone = db.prepare(
      'SELECT id FROM customers WHERE phone = ? AND phone IS NOT NULL'
    );
    const insert = db.prepare(`
        INSERT INTO customers
          (kode, name, phone, email, address, gender, birth_date, customer_group_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
    const update = db.prepare(`
        UPDATE customers
           SET name = ?, email = ?, address = ?, gender = ?, birth_date = ?,
               customer_group_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
      `);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    const tx = db.transaction((items) => {
      items.forEach((raw, idx) => {
        const r = raw || {};
        if (!r.name || !String(r.name).trim()) {
          skipped += 1;
          errors.push({ row: idx + 1, message: 'Nama wajib diisi' });
          return;
        }
        const groupId = r.group_name
          ? (groupByName.get(String(r.group_name).toLowerCase()) ?? null)
          : null;
        const phone = r.phone ? String(r.phone).trim() : null;
        let existing = null;
        if (phone) existing = findByPhone.get(phone);
        if (existing) {
          update.run(
            String(r.name).trim(),
            r.email || null,
            r.address || null,
            r.gender || null,
            r.birth_date || null,
            groupId,
            r.notes || null,
            existing.id
          );
          updated += 1;
        } else {
          const kode = generateKode(db);
          insert.run(
            kode,
            String(r.name).trim(),
            phone,
            r.email || null,
            r.address || null,
            r.gender || null,
            r.birth_date || null,
            groupId,
            r.notes || null
          );
          inserted += 1;
        }
      });
    });
    tx(rows);

    res.json({ inserted, updated, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, validate({ body: CustomerCreateSchema }), (req, res) => {
  try {
    const {
      kode,
      name,
      phone,
      email,
      address,
      gender,
      birth_date,
      points,
      deposit,
      notes,
      customer_group_id,
      npwp,
      id_card_no,
      province,
      city,
      district,
      tag_ids,
    } = req.body;

    const db = getDb();
    const kodeFinal = (kode && kode.trim()) || generateKode(db);
    const result = db
      .prepare(
        `INSERT INTO customers
             (kode, name, phone, email, address, gender, birth_date, points, deposit, notes,
              customer_group_id, npwp, id_card_no, province, city, district)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        kodeFinal,
        name.trim(),
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
        gender || null,
        birth_date || null,
        Number.isFinite(parseInt(points, 10)) ? parseInt(points, 10) : 0,
        Number.isFinite(parseFloat(deposit)) ? parseFloat(deposit) : 0,
        notes ? notes.trim() : null,
        customer_group_id ?? null,
        npwp ? npwp.trim() : null,
        id_card_no ? id_card_no.trim() : null,
        province || null,
        city || null,
        district || null
      );

    const newId = result.lastInsertRowid;
    if (Array.isArray(tag_ids)) {
      applyTagsTransaction(db, newId, tag_ids);
    }
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(newId);
    res.status(201).json(row);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kode pelanggan sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticateToken, validate({ body: CustomerUpdateSchema }), (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });

    // Merge with existing for partial updates.
    const m = { ...existing, ...req.body };
    const norm = (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null));

    db.prepare(
      `UPDATE customers
            SET kode = ?,
                name = ?,
                phone = ?,
                email = ?,
                address = ?,
                gender = ?,
                birth_date = ?,
                points = ?,
                deposit = ?,
                notes = ?,
                customer_group_id = ?,
                npwp = ?,
                id_card_no = ?,
                province = ?,
                city = ?,
                district = ?,
                is_active = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
    ).run(
      norm(m.kode),
      m.name && String(m.name).trim(),
      norm(m.phone),
      norm(m.email),
      norm(m.address),
      m.gender || null,
      m.birth_date || null,
      Number.isFinite(parseInt(m.points, 10)) ? parseInt(m.points, 10) : 0,
      Number.isFinite(parseFloat(m.deposit)) ? parseFloat(m.deposit) : 0,
      norm(m.notes),
      m.customer_group_id ?? null,
      norm(m.npwp),
      norm(m.id_card_no),
      norm(m.province),
      norm(m.city),
      norm(m.district),
      m.is_active === false || m.is_active === 0 ? 0 : 1,
      req.params.id
    );

    if (Array.isArray(req.body.tag_ids)) {
      applyTagsTransaction(db, parseInt(req.params.id, 10), req.body.tag_ids);
    }

    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kode pelanggan sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const used = db
      .prepare('SELECT COUNT(*) as count FROM transactions WHERE customer_id = ?')
      .get(req.params.id);
    if (used.count > 0) {
      db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(req.params.id);
      return res.json({
        message: 'Pelanggan dinonaktifkan karena sudah memiliki riwayat transaksi',
      });
    }
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Pelanggan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
