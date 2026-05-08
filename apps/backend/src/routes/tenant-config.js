// VIPOS — Tenant configuration endpoints.
//
// Surface:
//   GET /api/v1/config
//     200:  { config: { key: value, ... } }
//
//   PUT /api/v1/config
//     body: { key: value, ... }
//     200:  { updated: [...keys] }
//
// Wraps the app_settings table with a simpler key-value API
// for the Android app to read/write tenant-level configuration
// (receipt header, tax rate, service charge %, etc.)

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET / — read all config for the current tenant.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT key, value FROM app_settings
       WHERE tenant_id = $1 AND category = 'config'
       ORDER BY key`,
      [req.tenantId],
    );

    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }

    return res.status(200).json({ config });
  } catch (err) {
    console.error('Config read error:', err);
    return res.status(500).json({ error: 'Gagal membaca konfigurasi' });
  }
});

// PUT / — bulk upsert config keys.
router.put('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const keys = Object.keys(body);

    if (keys.length === 0) {
      return res.status(400).json({ error: 'Minimal satu key harus diisi' });
    }

    const updated = [];
    for (const key of keys) {
      const value = String(body[key]);
      // Use outlet_id=NULL for tenant-level config.
      // The unique constraint is on (outlet_id, category, key).
      const existing = await query(
        `SELECT id FROM app_settings
         WHERE tenant_id = $1 AND category = 'config' AND key = $2 AND outlet_id IS NULL`,
        [req.tenantId, key],
      );
      if (existing.rows.length > 0) {
        await query(
          `UPDATE app_settings SET value = $1, updated_at = NOW() WHERE id = $2`,
          [value, existing.rows[0].id],
        );
      } else {
        await query(
          `INSERT INTO app_settings (tenant_id, category, key, value)
           VALUES ($1, 'config', $2, $3)`,
          [req.tenantId, key, value],
        );
      }
      updated.push(key);
    }

    return res.status(200).json({ updated });
  } catch (err) {
    console.error('Config update error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan konfigurasi' });
  }
});

module.exports = router;
