// Outlet management endpoints (P4-11).
//
// Endpoints:
//   GET    /api/outlet              List outlets for current tenant.
//   GET    /api/outlet/:id          Get outlet detail.
//   POST   /api/outlet              Create outlet (admin only).
//   PUT    /api/outlet/:id          Update outlet (admin only).
//   DELETE /api/outlet/:id          Delete outlet (admin only).
//   POST   /api/outlet/switch       Switch active outlet for session.
//
// Multi-outlet support allows managing multiple stores/locations
// under one tenant. Users can switch between outlets, and data
// is filtered by outlet_id where applicable.

const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/outlet - List outlets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { is_active } = req.query;

    let sql = `
      SELECT 
        id, code, name, type, address, city, province,
        phone, email, logo_url, timezone, currency,
        is_main, is_active, created_at, updated_at
      FROM outlets
      WHERE tenant_id = $1
    `;
    const params = [req.user.tenant_id];

    if (is_active !== undefined) {
      sql += ` AND is_active = $${params.length + 1}`;
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    sql += ' ORDER BY is_main DESC, name ASC';

    const result = await query(sql, params);

    res.json(result.rows.map(row => ({
      ...row,
      is_main: Boolean(row.is_main),
      is_active: Boolean(row.is_active),
    })));
  } catch (err) {
    console.error('Error listing outlets:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data outlet' });
  }
});

// GET /api/outlet/:id - Get outlet detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      SELECT 
        id, code, name, type, address, city, province,
        phone, email, logo_url, tax_npwp, timezone, currency,
        is_main, is_active, created_at, updated_at
      FROM outlets
      WHERE id = $1 AND tenant_id = $2
      `,
      [id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Outlet tidak ditemukan' });
    }

    const outlet = result.rows[0];
    res.json({
      ...outlet,
      is_main: Boolean(outlet.is_main),
      is_active: Boolean(outlet.is_active),
    });
  } catch (err) {
    console.error('Error getting outlet detail:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengambil detail outlet' });
  }
});

// POST /api/outlet - Create outlet (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      code,
      name,
      type,
      address,
      city,
      province,
      phone,
      email,
      logo_url,
      tax_npwp,
      timezone,
      currency,
      is_main,
      is_active,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nama outlet wajib diisi' });
    }

    // Check if code already exists
    if (code) {
      const existing = await query(
        'SELECT id FROM outlets WHERE code = $1 AND tenant_id = $2',
        [code, req.user.tenant_id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Kode outlet sudah digunakan' });
      }
    }

    const result = await query(
      `
      INSERT INTO outlets (
        code, name, type, address, city, province,
        phone, email, logo_url, tax_npwp, timezone, currency,
        is_main, is_active, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING 
        id, code, name, type, address, city, province,
        phone, email, logo_url, tax_npwp, timezone, currency,
        is_main, is_active, created_at, updated_at
      `,
      [
        code || null,
        name,
        type || null,
        address || null,
        city || null,
        province || null,
        phone || null,
        email || null,
        logo_url || null,
        tax_npwp || null,
        timezone || 'Asia/Jakarta',
        currency || 'IDR',
        is_main ? 1 : 0,
        is_active !== false ? 1 : 0,
        req.user.tenant_id,
      ]
    );

    const outlet = result.rows[0];
    res.status(201).json({
      ...outlet,
      is_main: Boolean(outlet.is_main),
      is_active: Boolean(outlet.is_active),
    });
  } catch (err) {
    console.error('Error creating outlet:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat membuat outlet' });
  }
});

// PUT /api/outlet/:id - Update outlet (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      type,
      address,
      city,
      province,
      phone,
      email,
      logo_url,
      tax_npwp,
      timezone,
      currency,
      is_main,
      is_active,
    } = req.body;

    // Check if outlet exists
    const existing = await query(
      'SELECT id FROM outlets WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Outlet tidak ditemukan' });
    }

    // Check if code already exists (excluding current outlet)
    if (code) {
      const duplicate = await query(
        'SELECT id FROM outlets WHERE code = $1 AND tenant_id = $2 AND id != $3',
        [code, req.user.tenant_id, id]
      );
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: 'Kode outlet sudah digunakan' });
      }
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`);
      params.push(code || null);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      params.push(type || null);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(address || null);
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      params.push(city || null);
    }
    if (province !== undefined) {
      updates.push(`province = $${paramIndex++}`);
      params.push(province || null);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone || null);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email || null);
    }
    if (logo_url !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      params.push(logo_url || null);
    }
    if (tax_npwp !== undefined) {
      updates.push(`tax_npwp = $${paramIndex++}`);
      params.push(tax_npwp || null);
    }
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      params.push(timezone);
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`);
      params.push(currency);
    }
    if (is_main !== undefined) {
      updates.push(`is_main = $${paramIndex++}`);
      params.push(is_main ? 1 : 0);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data yang diupdate' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id, req.user.tenant_id);

    const result = await query(
      `
      UPDATE outlets
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING 
        id, code, name, type, address, city, province,
        phone, email, logo_url, tax_npwp, timezone, currency,
        is_main, is_active, created_at, updated_at
      `,
      params
    );

    const outlet = result.rows[0];
    res.json({
      ...outlet,
      is_main: Boolean(outlet.is_main),
      is_active: Boolean(outlet.is_active),
    });
  } catch (err) {
    console.error('Error updating outlet:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate outlet' });
  }
});

// DELETE /api/outlet/:id - Delete outlet (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if outlet exists
    const existing = await query(
      'SELECT id, is_main FROM outlets WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Outlet tidak ditemukan' });
    }

    // Prevent deleting main outlet
    if (existing.rows[0].is_main) {
      return res.status(400).json({ error: 'Outlet utama tidak dapat dihapus' });
    }

    await query(
      'DELETE FROM outlets WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );

    res.json({ message: 'Outlet berhasil dihapus' });
  } catch (err) {
    console.error('Error deleting outlet:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat menghapus outlet' });
  }
});

// POST /api/outlet/switch - Switch active outlet
router.post('/switch', authenticateToken, async (req, res) => {
  try {
    const { outlet_id } = req.body;

    if (!outlet_id) {
      return res.status(400).json({ error: 'outlet_id wajib diisi' });
    }

    // Verify outlet exists and is active
    const result = await query(
      `
      SELECT id, name, is_active
      FROM outlets
      WHERE id = $1 AND tenant_id = $2
      `,
      [outlet_id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Outlet tidak ditemukan' });
    }

    const outlet = result.rows[0];
    if (!outlet.is_active) {
      return res.status(400).json({ error: 'Outlet tidak aktif' });
    }

    // In a real implementation, you would update the user's session
    // or store the active outlet_id in a session table.
    // For now, we just return success with the outlet info.
    res.json({
      message: 'Outlet berhasil diganti',
      outlet_id: outlet.id,
      outlet_name: outlet.name,
    });
  } catch (err) {
    console.error('Error switching outlet:', err);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengganti outlet' });
  }
});

module.exports = router;
