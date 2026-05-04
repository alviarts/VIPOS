const express = require('express');
const { query, tx, iLikePattern } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { safeLogAudit, ACTIONS } = require('../lib/audit');
const {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  CustomerTagAssignSchema,
} = require('@vipos/shared');

const router = express.Router();

async function generateKode(q) {
  const last = (
    await q(`SELECT kode FROM customers WHERE kode LIKE 'PLG%' ORDER BY id DESC LIMIT 1`)
  ).rows[0];
  if (!last) return 'PLG0001';
  const num = parseInt((last.kode || '').replace(/\D/g, ''), 10) || 0;
  return 'PLG' + String(num + 1).padStart(4, '0');
}

async function loadTagsFor(q, customerIds) {
  if (!customerIds.length) return new Map();
  const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(',');
  const rows = (
    await q(
      `SELECT m.customer_id, t.id, t.name, t.color
         FROM customer_tag_map m
         JOIN customer_tags t ON t.id = m.tag_id
        WHERE m.customer_id IN (${placeholders})
        ORDER BY t.name ASC`,
      customerIds
    )
  ).rows;
  const byCustomer = new Map();
  for (const row of rows) {
    if (!byCustomer.has(row.customer_id)) byCustomer.set(row.customer_id, []);
    byCustomer.get(row.customer_id).push({ id: row.id, name: row.name, color: row.color });
  }
  return byCustomer;
}

async function loadStatsFor(q, customerIds) {
  if (!customerIds.length) return new Map();
  const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(',');
  const rows = (
    await q(
      `SELECT customer_id,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(total_amount), 0) AS total_spent,
              MAX(created_at) AS last_visit
         FROM transactions
        WHERE customer_id IN (${placeholders})
          AND status = 'completed'
        GROUP BY customer_id`,
      customerIds
    )
  ).rows;
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

async function applyTagsTransaction(customerId, tagIds) {
  await tx(async (txQuery) => {
    await txQuery('DELETE FROM customer_tag_map WHERE customer_id = $1', [customerId]);
    for (const id of tagIds) {
      await txQuery(
        'INSERT INTO customer_tag_map (customer_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [customerId, id]
      );
    }
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, active_only, group_id, tag_id, has_deposit, has_points } = req.query;

    const conditions = [];
    const params = [];
    let p = 1;
    if (active_only !== 'false') conditions.push('c.is_active = 1');
    if (search) {
      const pattern = `%${iLikePattern(search)}%`;
      conditions.push(
        `(c.name LIKE $${p} OR c.kode LIKE $${p + 1} OR c.phone LIKE $${p + 2} OR c.email LIKE $${p + 3} OR c.npwp LIKE $${p + 4})`
      );
      params.push(pattern, pattern, pattern, pattern, pattern);
      p += 5;
    }
    if (group_id) {
      conditions.push(`c.customer_group_id = $${p++}`);
      params.push(parseInt(group_id, 10));
    }
    if (tag_id) {
      conditions.push(`c.id IN (SELECT customer_id FROM customer_tag_map WHERE tag_id = $${p++})`);
      params.push(parseInt(tag_id, 10));
    }
    if (has_deposit === 'true') conditions.push('c.deposit > 0');
    if (has_points === 'true') conditions.push('c.points > 0');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT c.*,
                g.name AS customer_group_name,
                g.color AS customer_group_color
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.customer_group_id
           ${where}
          ORDER BY c.created_at DESC`,
        params
      )
    ).rows;

    const ids = rows.map((r) => r.id);
    const [tagsByCustomer, statsByCustomer] = await Promise.all([
      loadTagsFor(query, ids),
      loadStatsFor(query, ids),
    ]);
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

router.get('/export', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT c.kode, c.name, c.phone, c.email, c.address, c.gender,
                c.birth_date, c.npwp, c.id_card_no, c.province, c.city, c.district,
                c.points, c.deposit, c.notes,
                g.name AS group_name
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.customer_group_id
          WHERE c.is_active = 1
          ORDER BY c.name ASC`
      )
    ).rows;
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

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const row = (
      await query(
        `SELECT c.*,
                g.name AS customer_group_name,
                g.color AS customer_group_color
           FROM customers c
           LEFT JOIN customer_groups g ON g.id = c.customer_group_id
          WHERE c.id = $1`,
        [req.params.id]
      )
    ).rows[0];
    if (!row) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    const [tagsByCustomer, statsByCustomer] = await Promise.all([
      loadTagsFor(query, [row.id]),
      loadStatsFor(query, [row.id]),
    ]);
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

router.get('/:id/transactions', authenticateToken, async (req, res) => {
  try {
    const exists = (await query('SELECT id FROM customers WHERE id = $1', [req.params.id])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    const rows = (
      await query(
        `SELECT t.id, t.invoice_number, t.total_amount, t.payment_method,
                t.status, t.created_at,
                u.name AS cashier_name
           FROM transactions t
           LEFT JOIN users u ON u.id = t.user_id
          WHERE t.customer_id = $1
          ORDER BY t.created_at DESC
          LIMIT 200`,
        [req.params.id]
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:id/tags',
  authenticateToken,
  validate({ body: CustomerTagAssignSchema }),
  async (req, res) => {
    try {
      const exists = (await query('SELECT id FROM customers WHERE id = $1', [req.params.id]))
        .rows[0];
      if (!exists) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
      await applyTagsTransaction(parseInt(req.params.id, 10), req.body.tag_ids);
      res.json({ message: 'Tag tersimpan' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ error: 'Body harus { rows: [...] }' });

    const groups = (await query('SELECT id, name FROM customer_groups')).rows;
    const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g.id]));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    await tx(async (txQuery) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx] || {};
        if (!r.name || !String(r.name).trim()) {
          skipped += 1;
          errors.push({ row: idx + 1, message: 'Nama wajib diisi' });
          continue;
        }
        const groupId = r.group_name
          ? (groupByName.get(String(r.group_name).toLowerCase()) ?? null)
          : null;
        const phone = r.phone ? String(r.phone).trim() : null;
        let existing = null;
        if (phone) {
          existing = (
            await txQuery('SELECT id FROM customers WHERE phone = $1 AND phone IS NOT NULL', [
              phone,
            ])
          ).rows[0];
        }
        if (existing) {
          await txQuery(
            `UPDATE customers
                SET name = $1, email = $2, address = $3, gender = $4, birth_date = $5,
                    customer_group_id = $6, notes = $7, updated_at = CURRENT_TIMESTAMP
              WHERE id = $8`,
            [
              String(r.name).trim(),
              r.email || null,
              r.address || null,
              r.gender || null,
              r.birth_date || null,
              groupId,
              r.notes || null,
              existing.id,
            ]
          );
          updated += 1;
        } else {
          const kode = await generateKode(txQuery);
          await txQuery(
            `INSERT INTO customers
              (kode, name, phone, email, address, gender, birth_date, customer_group_id, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              kode,
              String(r.name).trim(),
              phone,
              r.email || null,
              r.address || null,
              r.gender || null,
              r.birth_date || null,
              groupId,
              r.notes || null,
            ]
          );
          inserted += 1;
        }
      }
    });

    res.json({ inserted, updated, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, validate({ body: CustomerCreateSchema }), async (req, res) => {
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

    const kodeFinal = (kode && kode.trim()) || (await generateKode(query));
    const ins = await query(
      `INSERT INTO customers
            (kode, name, phone, email, address, gender, birth_date, points, deposit, notes,
             customer_group_id, npwp, id_card_no, province, city, district)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id`,
      [
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
        district || null,
      ]
    );

    const newId = ins.rows[0].id;
    if (Array.isArray(tag_ids)) {
      await applyTagsTransaction(newId, tag_ids);
    }
    const row = (await query('SELECT * FROM customers WHERE id = $1', [newId])).rows[0];
    await safeLogAudit(req, {
      entity: 'customer',
      entity_id: newId,
      action: ACTIONS.CREATE,
      after: row,
    });
    res.status(201).json(row);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Kode pelanggan sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:id',
  authenticateToken,
  validate({ body: CustomerUpdateSchema }),
  async (req, res) => {
    try {
      const existing = (await query('SELECT * FROM customers WHERE id = $1', [req.params.id]))
        .rows[0];
      if (!existing) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });

      // Merge with existing for partial updates.
      const m = { ...existing, ...req.body };
      const norm = (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null));

      await query(
        `UPDATE customers
              SET kode = $1,
                  name = $2,
                  phone = $3,
                  email = $4,
                  address = $5,
                  gender = $6,
                  birth_date = $7,
                  points = $8,
                  deposit = $9,
                  notes = $10,
                  customer_group_id = $11,
                  npwp = $12,
                  id_card_no = $13,
                  province = $14,
                  city = $15,
                  district = $16,
                  is_active = $17,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $18`,
        [
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
          req.params.id,
        ]
      );

      if (Array.isArray(req.body.tag_ids)) {
        await applyTagsTransaction(parseInt(req.params.id, 10), req.body.tag_ids);
      }

      const row = (await query('SELECT * FROM customers WHERE id = $1', [req.params.id])).rows[0];
      await safeLogAudit(req, {
        entity: 'customer',
        entity_id: req.params.id,
        action: ACTIONS.UPDATE,
        before: existing,
        after: row,
      });
      res.json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Kode pelanggan sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const before = (await query('SELECT * FROM customers WHERE id = $1', [req.params.id]))
      .rows[0];
    const used = (
      await query('SELECT COUNT(*) as count FROM transactions WHERE customer_id = $1', [
        req.params.id,
      ])
    ).rows[0];
    if (Number(used.count) > 0) {
      await query('UPDATE customers SET is_active = 0 WHERE id = $1', [req.params.id]);
      const after = (await query('SELECT * FROM customers WHERE id = $1', [req.params.id]))
        .rows[0];
      await safeLogAudit(req, {
        entity: 'customer',
        entity_id: req.params.id,
        action: ACTIONS.UPDATE,
        before,
        after,
      });
      return res.json({
        message: 'Pelanggan dinonaktifkan karena sudah memiliki riwayat transaksi',
      });
    }
    await query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    await safeLogAudit(req, {
      entity: 'customer',
      entity_id: req.params.id,
      action: ACTIONS.DELETE,
      before,
    });
    res.json({ message: 'Pelanggan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
