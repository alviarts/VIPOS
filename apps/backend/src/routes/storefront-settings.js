// Storefront (e-menu) config — single-row table id=1.
//
//   GET /api/storefront-settings
//   PUT /api/storefront-settings
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { StorefrontSettingsUpdateSchema } = require('@vipos/shared');

const router = express.Router();

const JSON_FIELDS = [
  'operating_hours',
  'payment_methods',
  'delivery_zones',
  'banner_slides',
  'featured_product_ids',
  'hidden_category_ids',
];

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToSettings(row) {
  if (!row) return null;
  const out = { ...row };
  for (const k of JSON_FIELDS) {
    out[k] = parseJson(row[k], null);
  }
  return out;
}

function ensureRow(db) {
  const row = db.prepare('SELECT * FROM storefront_settings WHERE id = 1').get();
  if (row) return row;
  db.prepare(
    `INSERT INTO storefront_settings (id, slug, brand_name, primary_color)
     VALUES (1, 'toko', 'Toko Saya', '#04C99E')`
  ).run();
  return db.prepare('SELECT * FROM storefront_settings WHERE id = 1').get();
}

router.get('/', authenticateToken, (_req, res) => {
  const row = ensureRow(getDb());
  res.json(rowToSettings(row));
});

router.put(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: StorefrontSettingsUpdateSchema }),
  (req, res) => {
    const db = getDb();
    ensureRow(db);
    const allowed = [
      'slug',
      'custom_domain',
      'is_active',
      'brand_name',
      'logo_url',
      'cover_image_url',
      'primary_color',
      'accent_color',
      'theme',
      'language',
      'currency',
      'tagline',
      'about_text',
      'contact_phone',
      'contact_whatsapp',
      'contact_email',
      'contact_instagram',
      'tos_text',
      'privacy_text',
      'faq_text',
      'seo_title',
      'seo_description',
      'seo_og_image_url',
      'ga_id',
      'fb_pixel_id',
      'min_order_amount',
      'service_charge_percent',
      'tax_percent',
      'supports_dine_in',
      'supports_takeaway',
      'supports_delivery',
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
      db.prepare(`UPDATE storefront_settings SET ${fields.join(', ')} WHERE id = 1`).run(...params);
    }
    const row = db.prepare('SELECT * FROM storefront_settings WHERE id = 1').get();
    res.json(rowToSettings(row));
  }
);

module.exports = router;
