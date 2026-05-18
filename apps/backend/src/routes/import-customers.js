// VIPOS — Customer bulk import from CSV/JSON (P1-06 enhancement).
//
// Surface:
//   POST /api/v1/customers/import
//     body: { customers: [{ name, phone?, email?, ... }] }
//     201:  { imported: number, skipped: number, errors: [...] }
//
// Imports customers in bulk. Skips duplicates (by phone or email).
// Returns detailed error report for failed rows.

const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { customers } = req.body || {};

    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'customers array harus diisi' });
    }

    if (customers.length > 1000) {
      return res.status(400).json({ error: 'Maksimal 1000 pelanggan per import' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < customers.length; i++) {
      const row = customers[i];
      const rowNum = i + 1;

      if (!row.name || row.name.trim().length === 0) {
        errors.push({ row: rowNum, error: 'Nama harus diisi' });
        continue;
      }

      // Check duplicate by phone or email
      if (row.phone) {
        const { rows: existing } = await query(
          `SELECT id FROM customers WHERE phone = $1 AND tenant_id = $2`,
          [row.phone, req.tenantId],
        );
        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }
      if (row.email) {
        const { rows: existing } = await query(
          `SELECT id FROM customers WHERE email = $1 AND tenant_id = $2`,
          [row.email.toLowerCase(), req.tenantId],
        );
        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      // Generate customer code
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int as cnt FROM customers WHERE tenant_id = $1`,
        [req.tenantId],
      );
      const nextNum = (countRows[0].cnt || 0) + imported + 1;
      const kode = `PLG${String(nextNum).padStart(3, '0')}`;

      try {
        await query(
          `INSERT INTO customers (tenant_id, kode, name, phone, email, address, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.tenantId,
            kode,
            row.name.trim(),
            row.phone || null,
            row.email ? row.email.toLowerCase().trim() : null,
            row.address || null,
            row.notes || null,
          ],
        );
        imported++;
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
      }
    }

    return res.status(201).json({
      imported,
      skipped,
      errors: errors.slice(0, 50), // Cap error list
      total_rows: customers.length,
    });
  } catch (err) {
    console.error('Customer import error:', err);
    return res.status(500).json({ error: 'Gagal mengimpor pelanggan' });
  }
});

module.exports = router;
