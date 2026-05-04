// P1-16 Pengaturan / Settings — outlet, terminal, app settings, notifications,
// support access, payment methods, tax rates, UoM, account profile.
//
// Implementasi monolith satu file: 9 router. Auto-mounted di app.js.
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ============================================================
// 1. /api/outlet
// ============================================================
const outletRouter = express.Router();

outletRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (await query(`SELECT * FROM outlets ORDER BY is_main DESC, name ASC`)).rows;
  res.json(rows);
});

outletRouter.get('/:id', authenticateToken, async (req, res) => {
  const row = (await query(`SELECT * FROM outlets WHERE id = $1`, [req.params.id])).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

outletRouter.post('/', authenticateToken, async (req, res) => {
  const data = req.body || {};
  if (!data.name) return res.status(400).json({ error: 'name wajib' });
  if (!data.code) {
    const last = (await query(`SELECT code FROM outlets ORDER BY id DESC LIMIT 1`)).rows[0];
    const next = last ? Number(String(last.code).replace(/\D/g, '') || 0) + 1 : 1;
    data.code = `OUT-${String(next).padStart(3, '0')}`;
  }
  const ins = await query(
    `INSERT INTO outlets (code, name, type, address, city, province, phone, email,
      logo_url, tax_npwp, timezone, currency, is_main, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
    [
      data.code,
      data.name,
      data.type || null,
      data.address || null,
      data.city || null,
      data.province || null,
      data.phone || null,
      data.email || null,
      data.logo_url || null,
      data.tax_npwp || null,
      data.timezone || 'Asia/Jakarta',
      data.currency || 'IDR',
      data.is_main ? 1 : 0,
      data.is_active === false ? 0 : 1,
    ]
  );
  const newId = ins.rows[0].id;
  if (data.is_main) {
    await query(`UPDATE outlets SET is_main = 0 WHERE id != $1`, [newId]);
  }
  res.status(201).json({ id: newId });
});

outletRouter.put('/:id', authenticateToken, async (req, res) => {
  const data = req.body || {};
  const exists = (await query(`SELECT id FROM outlets WHERE id = $1`, [req.params.id])).rows[0];
  if (!exists) return res.status(404).json({ error: 'Not found' });
  const fields = [
    'code',
    'name',
    'type',
    'address',
    'city',
    'province',
    'phone',
    'email',
    'logo_url',
    'tax_npwp',
    'timezone',
    'currency',
  ];
  const sets = [];
  const params = [];
  let p = 1;
  for (const f of fields) {
    if (data[f] !== undefined) {
      sets.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }
  if (data.is_main !== undefined) {
    sets.push(`is_main = $${p++}`);
    params.push(data.is_main ? 1 : 0);
  }
  if (data.is_active !== undefined) {
    sets.push(`is_active = $${p++}`);
    params.push(data.is_active ? 1 : 0);
  }
  sets.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(req.params.id);
  await query(`UPDATE outlets SET ${sets.join(', ')} WHERE id = $${p}`, params);
  if (data.is_main) {
    await query(`UPDATE outlets SET is_main = 0 WHERE id != $1`, [req.params.id]);
  }
  res.json({ ok: true });
});

outletRouter.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await query(`DELETE FROM outlets WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Floor plan: ambil/edit per outlet (auto-create default kalau belum ada).
outletRouter.get('/:id/floor-plan', authenticateToken, async (req, res) => {
  let row = (await query(`SELECT * FROM outlet_floor_plans WHERE outlet_id = $1`, [req.params.id]))
    .rows[0];
  if (!row) {
    const ins = await query(
      `INSERT INTO outlet_floor_plans (outlet_id, name, tables_json) VALUES ($1, $2, $3) RETURNING id`,
      [req.params.id, 'Lantai 1', '[]']
    );
    row = (await query(`SELECT * FROM outlet_floor_plans WHERE id = $1`, [ins.rows[0].id])).rows[0];
  }
  res.json({
    ...row,
    tables: JSON.parse(row.tables_json || '[]'),
  });
});

outletRouter.put('/:id/floor-plan', authenticateToken, async (req, res) => {
  const { name, width, height, tables } = req.body || {};
  const existing = (
    await query(`SELECT id FROM outlet_floor_plans WHERE outlet_id = $1`, [req.params.id])
  ).rows[0];
  const tablesJson = JSON.stringify(Array.isArray(tables) ? tables : []);
  if (existing) {
    await query(
      `UPDATE outlet_floor_plans
         SET name = $1, width = $2, height = $3, tables_json = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [name || 'Lantai 1', Number(width) || 1000, Number(height) || 700, tablesJson, existing.id]
    );
  } else {
    await query(
      `INSERT INTO outlet_floor_plans (outlet_id, name, width, height, tables_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, name || 'Lantai 1', Number(width) || 1000, Number(height) || 700, tablesJson]
    );
  }
  res.json({ ok: true });
});

// ============================================================
// 2. /api/terminal
// ============================================================
const terminalRouter = express.Router();

terminalRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT t.*, o.name AS outlet_name, u.name AS paired_user_name
         FROM terminals t
         LEFT JOIN outlets o ON o.id = t.outlet_id
         LEFT JOIN users u ON u.id = t.paired_user_id
         ORDER BY t.outlet_id, t.type, t.name`
    )
  ).rows;
  res.json(rows);
});

terminalRouter.post('/', authenticateToken, async (req, res) => {
  const d = req.body || {};
  if (!d.name || !d.type) return res.status(400).json({ error: 'name & type wajib' });
  if (!d.code) {
    const last = (await query(`SELECT code FROM terminals ORDER BY id DESC LIMIT 1`)).rows[0];
    const next = last ? Number(String(last.code).replace(/\D/g, '') || 0) + 1 : 1;
    d.code = `TRM-${String(next).padStart(4, '0')}`;
  }
  const ins = await query(
    `INSERT INTO terminals (code, name, type, outlet_id, model, serial_no, ip_address,
      mac_address, paired_user_id, config_json, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      d.code,
      d.name,
      d.type,
      d.outlet_id || null,
      d.model || null,
      d.serial_no || null,
      d.ip_address || null,
      d.mac_address || null,
      d.paired_user_id || null,
      d.config_json ? JSON.stringify(d.config_json) : null,
      d.is_active === false ? 0 : 1,
    ]
  );
  res.status(201).json({ id: ins.rows[0].id });
});

terminalRouter.put('/:id', authenticateToken, async (req, res) => {
  const d = req.body || {};
  const fields = [
    'code',
    'name',
    'type',
    'outlet_id',
    'model',
    'serial_no',
    'ip_address',
    'mac_address',
    'paired_user_id',
  ];
  const sets = [];
  const params = [];
  let p = 1;
  for (const f of fields) {
    if (d[f] !== undefined) {
      sets.push(`${f} = $${p++}`);
      params.push(d[f]);
    }
  }
  if (d.config_json !== undefined) {
    sets.push(`config_json = $${p++}`);
    params.push(d.config_json ? JSON.stringify(d.config_json) : null);
  }
  if (d.is_active !== undefined) {
    sets.push(`is_active = $${p++}`);
    params.push(d.is_active ? 1 : 0);
  }
  if (sets.length === 0) return res.json({ ok: true });
  params.push(req.params.id);
  await query(`UPDATE terminals SET ${sets.join(', ')} WHERE id = $${p}`, params);
  res.json({ ok: true });
});

terminalRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM terminals WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

terminalRouter.post('/:id/heartbeat', authenticateToken, async (req, res) => {
  await query(`UPDATE terminals SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1`, [
    req.params.id,
  ]);
  res.json({ ok: true });
});

// ============================================================
// 3. /api/setting (key-value generic store).
// ============================================================
const settingRouter = express.Router();

settingRouter.get('/', authenticateToken, async (req, res) => {
  const { category, outlet_id } = req.query;
  let sql = `SELECT * FROM app_settings WHERE 1=1`;
  const params = [];
  let p = 1;
  if (category) {
    sql += ` AND category = $${p++}`;
    params.push(category);
  }
  if (outlet_id !== undefined) {
    if (outlet_id === '' || outlet_id === 'null') {
      sql += ` AND outlet_id IS NULL`;
    } else {
      sql += ` AND outlet_id = $${p++}`;
      params.push(Number(outlet_id));
    }
  }
  sql += ` ORDER BY category, key`;
  const rows = (await query(sql, params)).rows;
  res.json(rows.map((r) => ({ ...r, value: safeJsonParse(r.value_json) })));
});

settingRouter.put('/', authenticateToken, async (req, res) => {
  // Upsert by (outlet_id, category, key). Body: {category, key, value, outlet_id?}
  const { category, key, value, outlet_id } = req.body || {};
  if (!category || !key) return res.status(400).json({ error: 'category & key wajib' });
  const valueJson = JSON.stringify(value === undefined ? null : value);
  const oid = outlet_id || null;
  const existingSql =
    oid === null
      ? `SELECT id FROM app_settings WHERE category = $1 AND key = $2 AND outlet_id IS NULL`
      : `SELECT id FROM app_settings WHERE category = $1 AND key = $2 AND outlet_id = $3`;
  const existingParams = oid === null ? [category, key] : [category, key, oid];
  const existing = (await query(existingSql, existingParams)).rows[0];
  if (existing) {
    await query(
      `UPDATE app_settings SET value_json = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [valueJson, req.user?.id || null, existing.id]
    );
    res.json({ id: existing.id, updated: true });
  } else {
    const ins = await query(
      `INSERT INTO app_settings (outlet_id, category, key, value_json, updated_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [oid, category, key, valueJson, req.user?.id || null]
    );
    res.status(201).json({ id: ins.rows[0].id, created: true });
  }
});

settingRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM app_settings WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

function safeJsonParse(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// ============================================================
// 4. /api/notification-pref
// ============================================================
const notifRouter = express.Router();

notifRouter.get('/', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const rows = (await query(`SELECT * FROM notification_prefs WHERE user_id = $1`, [userId])).rows;
  res.json(rows);
});

notifRouter.put('/', authenticateToken, async (req, res) => {
  const { event_key, via_push, via_wa, via_sms, via_email } = req.body || {};
  if (!event_key) return res.status(400).json({ error: 'event_key wajib' });
  const userId = req.user?.id;
  const existing = (
    await query(`SELECT id FROM notification_prefs WHERE user_id = $1 AND event_key = $2`, [
      userId,
      event_key,
    ])
  ).rows[0];
  if (existing) {
    await query(
      `UPDATE notification_prefs SET via_push = $1, via_wa = $2, via_sms = $3, via_email = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
      [via_push ? 1 : 0, via_wa ? 1 : 0, via_sms ? 1 : 0, via_email ? 1 : 0, existing.id]
    );
  } else {
    await query(
      `INSERT INTO notification_prefs (user_id, event_key, via_push, via_wa, via_sms, via_email) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, event_key, via_push ? 1 : 0, via_wa ? 1 : 0, via_sms ? 1 : 0, via_email ? 1 : 0]
    );
  }
  res.json({ ok: true });
});

// ============================================================
// 5. /api/support-access
// ============================================================
const supportAccessRouter = express.Router();

supportAccessRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT g.*, u.name AS granted_by_name FROM support_access_grants g
         LEFT JOIN users u ON u.id = g.granted_by
         ORDER BY g.created_at DESC`
    )
  ).rows;
  res.json(rows);
});

supportAccessRouter.post('/', authenticateToken, async (req, res) => {
  const { grantee_email, reason, expires_at } = req.body || {};
  if (!grantee_email || !expires_at)
    return res.status(400).json({ error: 'grantee_email & expires_at wajib' });
  const ins = await query(
    `INSERT INTO support_access_grants (grantee_email, reason, granted_by, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [grantee_email, reason || null, req.user?.id || null, expires_at]
  );
  res.status(201).json({ id: ins.rows[0].id });
});

supportAccessRouter.post('/:id/revoke', authenticateToken, async (req, res) => {
  await query(
    `UPDATE support_access_grants SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL`,
    [req.params.id]
  );
  res.json({ ok: true });
});

// ============================================================
// 6. /api/payment-method
// ============================================================
const paymentMethodRouter = express.Router();

paymentMethodRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT pm.*, a.code AS account_code, a.name AS account_name
         FROM payment_methods pm
         LEFT JOIN gl_accounts a ON a.id = pm.account_id
         ORDER BY sort_order ASC, name ASC`
    )
  ).rows;
  res.json(rows);
});

paymentMethodRouter.post('/', authenticateToken, async (req, res) => {
  const d = req.body || {};
  if (!d.name || !d.type) return res.status(400).json({ error: 'name & type wajib' });
  const ins = await query(
    `INSERT INTO payment_methods (code, name, type, provider, fee_percent, fee_flat, account_id, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      d.code || null,
      d.name,
      d.type,
      d.provider || null,
      Number(d.fee_percent) || 0,
      Number(d.fee_flat) || 0,
      d.account_id || null,
      d.is_active === false ? 0 : 1,
      Number(d.sort_order) || 0,
    ]
  );
  res.status(201).json({ id: ins.rows[0].id });
});

paymentMethodRouter.put('/:id', authenticateToken, async (req, res) => {
  const d = req.body || {};
  const fields = [
    'code',
    'name',
    'type',
    'provider',
    'fee_percent',
    'fee_flat',
    'account_id',
    'sort_order',
  ];
  const sets = [];
  const params = [];
  let p = 1;
  for (const f of fields) {
    if (d[f] !== undefined) {
      sets.push(`${f} = $${p++}`);
      params.push(d[f]);
    }
  }
  if (d.is_active !== undefined) {
    sets.push(`is_active = $${p++}`);
    params.push(d.is_active ? 1 : 0);
  }
  if (sets.length === 0) return res.json({ ok: true });
  params.push(req.params.id);
  await query(`UPDATE payment_methods SET ${sets.join(', ')} WHERE id = $${p}`, params);
  res.json({ ok: true });
});

paymentMethodRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM payment_methods WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// ============================================================
// 7. /api/tax-rate
// ============================================================
const taxRateRouter = express.Router();

taxRateRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (await query(`SELECT * FROM tax_rates ORDER BY name ASC`)).rows;
  res.json(rows);
});

taxRateRouter.post('/', authenticateToken, async (req, res) => {
  const d = req.body || {};
  if (!d.name) return res.status(400).json({ error: 'name wajib' });
  const ins = await query(
    `INSERT INTO tax_rates (code, name, rate, is_inclusive, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      d.code || null,
      d.name,
      Number(d.rate) || 0,
      d.is_inclusive ? 1 : 0,
      d.is_active === false ? 0 : 1,
    ]
  );
  res.status(201).json({ id: ins.rows[0].id });
});

taxRateRouter.put('/:id', authenticateToken, async (req, res) => {
  const d = req.body || {};
  const fields = ['code', 'name', 'rate'];
  const sets = [];
  const params = [];
  let p = 1;
  for (const f of fields) {
    if (d[f] !== undefined) {
      sets.push(`${f} = $${p++}`);
      params.push(d[f]);
    }
  }
  if (d.is_inclusive !== undefined) {
    sets.push(`is_inclusive = $${p++}`);
    params.push(d.is_inclusive ? 1 : 0);
  }
  if (d.is_active !== undefined) {
    sets.push(`is_active = $${p++}`);
    params.push(d.is_active ? 1 : 0);
  }
  if (sets.length === 0) return res.json({ ok: true });
  params.push(req.params.id);
  await query(`UPDATE tax_rates SET ${sets.join(', ')} WHERE id = $${p}`, params);
  res.json({ ok: true });
});

taxRateRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM tax_rates WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// ============================================================
// 8. /api/uom
// ============================================================
const uomRouter = express.Router();

uomRouter.get('/', authenticateToken, async (req, res) => {
  const rows = (
    await query(
      `SELECT u.*, b.code AS base_code, b.name AS base_name
         FROM uoms u LEFT JOIN uoms b ON b.id = u.base_uom_id
         ORDER BY u.name ASC`
    )
  ).rows;
  res.json(rows);
});

uomRouter.post('/', authenticateToken, async (req, res) => {
  const d = req.body || {};
  if (!d.name) return res.status(400).json({ error: 'name wajib' });
  const ins = await query(
    `INSERT INTO uoms (code, name, symbol, base_uom_id, conversion_factor, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      d.code || null,
      d.name,
      d.symbol || null,
      d.base_uom_id || null,
      Number(d.conversion_factor) || 1,
      d.is_active === false ? 0 : 1,
    ]
  );
  res.status(201).json({ id: ins.rows[0].id });
});

uomRouter.put('/:id', authenticateToken, async (req, res) => {
  const d = req.body || {};
  const fields = ['code', 'name', 'symbol', 'base_uom_id', 'conversion_factor'];
  const sets = [];
  const params = [];
  let p = 1;
  for (const f of fields) {
    if (d[f] !== undefined) {
      sets.push(`${f} = $${p++}`);
      params.push(d[f]);
    }
  }
  if (d.is_active !== undefined) {
    sets.push(`is_active = $${p++}`);
    params.push(d.is_active ? 1 : 0);
  }
  if (sets.length === 0) return res.json({ ok: true });
  params.push(req.params.id);
  await query(`UPDATE uoms SET ${sets.join(', ')} WHERE id = $${p}`, params);
  res.json({ ok: true });
});

uomRouter.delete('/:id', authenticateToken, async (req, res) => {
  await query(`DELETE FROM uoms WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// ============================================================
// 9. /api/account-profile (current user profile + change-password lite)
// ============================================================
const profileRouter = express.Router();

profileRouter.get('/', authenticateToken, async (req, res) => {
  const row = (
    await query(
      `SELECT id, username, name, email, phone, role, photo_url, totp_enabled, last_login_at, created_at
         FROM users WHERE id = $1`,
      [req.user?.id]
    )
  ).rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

profileRouter.put('/', authenticateToken, async (req, res) => {
  const d = req.body || {};
  const fields = ['name', 'email', 'phone', 'photo_url'];
  const sets = [];
  const params = [];
  let p = 1;
  for (const f of fields) {
    if (d[f] !== undefined) {
      sets.push(`${f} = $${p++}`);
      params.push(d[f]);
    }
  }
  if (sets.length === 0) return res.json({ ok: true });
  params.push(req.user?.id);
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${p}`, params);
  res.json({ ok: true });
});

profileRouter.post('/change-password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Kedua password wajib' });
  if (new_password.length < 6)
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  const user = (await query(`SELECT id, password FROM users WHERE id = $1`, [req.user?.id]))
    .rows[0];
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  const ok = await bcrypt.compare(current_password, user.password);
  if (!ok) return res.status(400).json({ error: 'Password lama salah' });
  const hash = await bcrypt.hash(new_password, 10);
  await query(`UPDATE users SET password = $1 WHERE id = $2`, [hash, user.id]);
  res.json({ ok: true });
});

// ============================================================
// 10. /api/import-export (placeholder per-entity bulk ops)
// ============================================================
const importExportRouter = express.Router();

const ENTITIES = ['products', 'customers', 'employees', 'gl_accounts', 'gl_vendors'];

importExportRouter.get('/entities', authenticateToken, (req, res) => {
  res.json(ENTITIES.map((e) => ({ entity: e, label: e })));
});

importExportRouter.get('/export/:entity', authenticateToken, async (req, res) => {
  const entity = req.params.entity;
  if (!ENTITIES.includes(entity)) return res.status(400).json({ error: 'Entity tidak didukung' });
  const rows = (await query(`SELECT * FROM ${entity} LIMIT 5000`)).rows;
  if (req.query.format === 'csv' || req.query.format === undefined) {
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
      return res.end('');
    }
    const cols = Object.keys(rows[0]);
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [cols.join(',')]
      .concat(rows.map((r) => cols.map((c) => escape(r[c])).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}.csv"`);
    res.end(csv);
  } else {
    res.json({ entity, count: rows.length, items: rows });
  }
});

importExportRouter.post('/import/:entity', authenticateToken, async (req, res) => {
  // Body: {rows: [{...}]}.
  const entity = req.params.entity;
  if (!ENTITIES.includes(entity)) return res.status(400).json({ error: 'Entity tidak didukung' });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.json({ inserted: 0, errors: [] });
  const sampleCols = Object.keys(rows[0]);
  const errors = [];
  let inserted = 0;
  await tx(async (txQuery) => {
    for (const r of rows) {
      try {
        const cols = sampleCols.filter((c) => c in r && c !== 'id');
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
        const values = cols.map((c) => r[c]);
        await txQuery(`INSERT INTO ${entity} (${cols.join(',')}) VALUES (${placeholders})`, values);
        inserted++;
      } catch (err) {
        errors.push({ row: r, error: err.message });
      }
    }
  });
  res.json({ inserted, errors });
});

module.exports = {
  outletRouter,
  terminalRouter,
  settingRouter,
  notifRouter,
  supportAccessRouter,
  paymentMethodRouter,
  taxRateRouter,
  uomRouter,
  profileRouter,
  importExportRouter,
};
