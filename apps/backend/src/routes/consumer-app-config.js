// Consumer App (Prime+ white-label) config — single-row id=1.
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ConsumerAppConfigUpdateSchema } = require('@vipos/shared');

const router = express.Router();

const JSON_FIELDS = ['featured_promo_ids', 'hidden_product_ids', 'operating_hours'];

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToConfig(row) {
  if (!row) return null;
  const out = { ...row };
  for (const k of JSON_FIELDS) out[k] = parseJson(row[k], null);
  return out;
}

function ensureRow(db) {
  const row = db.prepare('SELECT * FROM consumer_app_config WHERE id = 1').get();
  if (row) return row;
  db.prepare(
    `INSERT INTO consumer_app_config (id, app_name, primary_color, status)
     VALUES (1, 'Toko Saya App', '#04C99E', 'draft')`
  ).run();
  return db.prepare('SELECT * FROM consumer_app_config WHERE id = 1').get();
}

router.get('/', authenticateToken, (_req, res) => {
  const row = ensureRow(getDb());
  res.json(rowToConfig(row));
});

router.put(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: ConsumerAppConfigUpdateSchema }),
  (req, res) => {
    const db = getDb();
    ensureRow(db);
    const allowed = [
      'app_name',
      'app_icon_url',
      'splash_image_url',
      'primary_color',
      'bundle_id_android',
      'bundle_id_ios',
      'play_store_url',
      'app_store_url',
      'status',
    ];
    const fields = [];
    const params = [];
    for (const k of allowed) {
      if (k in req.body) {
        fields.push(`${k} = ?`);
        params.push(req.body[k] ?? null);
      }
    }
    for (const k of JSON_FIELDS) {
      if (k in req.body) {
        fields.push(`${k} = ?`);
        params.push(req.body[k] == null ? null : JSON.stringify(req.body[k]));
      }
    }
    if (fields.length) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      db.prepare(`UPDATE consumer_app_config SET ${fields.join(', ')} WHERE id = 1`).run(...params);
    }
    const row = db.prepare('SELECT * FROM consumer_app_config WHERE id = 1').get();
    res.json(rowToConfig(row));
  }
);

module.exports = router;
