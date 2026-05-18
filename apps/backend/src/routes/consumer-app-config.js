// Consumer App (Prime+ white-label) config — single-row id=1 (P2-01b cutover).
const express = require('express');
const { query } = require('../db');
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

async function ensureRow() {
  const r = await query('SELECT * FROM consumer_app_config WHERE id = 1');
  if (r.rows.length) return r.rows[0];
  await query(
    `INSERT INTO consumer_app_config (id, app_name, primary_color, status)
     VALUES (1, 'Toko Saya App', '#04C99E', 'draft')`
  );
  return (await query('SELECT * FROM consumer_app_config WHERE id = 1')).rows[0];
}

router.get('/', authenticateToken, async (_req, res) => {
  try {
    const row = await ensureRow();
    res.json(rowToConfig(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: ConsumerAppConfigUpdateSchema }),
  async (req, res) => {
    try {
      await ensureRow();
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
      let p = 1;
      for (const k of allowed) {
        if (k in req.body) {
          fields.push(`${k} = $${p++}`);
          params.push(req.body[k] ?? null);
        }
      }
      for (const k of JSON_FIELDS) {
        if (k in req.body) {
          fields.push(`${k} = $${p++}`);
          params.push(req.body[k] == null ? null : JSON.stringify(req.body[k]));
        }
      }
      if (fields.length) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        await query(`UPDATE consumer_app_config SET ${fields.join(', ')} WHERE id = 1`, params);
      }
      const row = (await query('SELECT * FROM consumer_app_config WHERE id = 1')).rows[0];
      res.json(rowToConfig(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
