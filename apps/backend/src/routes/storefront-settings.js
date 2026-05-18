// Storefront (e-menu) config — single-row table id=1 (P2-01b cutover).
//
//   GET /api/storefront-settings
//   PUT /api/storefront-settings
const express = require('express');
const { query } = require('../db');
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

async function ensureRow() {
  const r = await query('SELECT * FROM storefront_settings WHERE id = 1');
  if (r.rows.length) return r.rows[0];
  await query(
    `INSERT INTO storefront_settings (id, slug, brand_name, primary_color)
     VALUES (1, 'toko', 'Toko Saya', '#04C99E')`
  );
  return (await query('SELECT * FROM storefront_settings WHERE id = 1')).rows[0];
}

router.get('/', authenticateToken, async (_req, res) => {
  try {
    const row = await ensureRow();
    res.json(rowToSettings(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: StorefrontSettingsUpdateSchema }),
  async (req, res) => {
    try {
      await ensureRow();
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
        await query(`UPDATE storefront_settings SET ${fields.join(', ')} WHERE id = 1`, params);
      }
      const row = (await query('SELECT * FROM storefront_settings WHERE id = 1')).rows[0];
      res.json(rowToSettings(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
