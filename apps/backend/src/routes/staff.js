// Staff CRUD (P1-13, P2-01b cutover). Re-used by appointment, calendar,
// dan future modul karyawan/payroll (P1-14).
const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { StaffCreateSchema, StaffUpdateSchema } = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT id, name, phone, email, role, color, is_active,
                created_at, updated_at
           FROM staff ORDER BY name ASC`
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load staff', details: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: StaffCreateSchema }),
  async (req, res) => {
    try {
      const { name, phone, email, role, color, is_active = 1 } = req.body;
      const ins = await query(
        `INSERT INTO staff (name, phone, email, role, color, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, phone || null, email || null, role || null, color || '#04C99E', is_active]
      );
      const created = (await query('SELECT * FROM staff WHERE id = $1', [ins.rows[0].id])).rows[0];
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create staff', details: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: StaffUpdateSchema }),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query('SELECT id FROM staff WHERE id = $1', [id])).rows[0];
      if (!exists) return res.status(404).json({ error: 'Staff not found' });
      const allowed = ['name', 'phone', 'email', 'role', 'color', 'is_active'];
      const fields = [];
      const values = [];
      let p = 1;
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${p++}`);
          values.push(req.body[key] ?? null);
        }
      }
      if (fields.length === 0) {
        const row = (await query('SELECT * FROM staff WHERE id = $1', [id])).rows[0];
        return res.json(row);
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await query(`UPDATE staff SET ${fields.join(', ')} WHERE id = $${p}`, values);
      const row = (await query('SELECT * FROM staff WHERE id = $1', [id])).rows[0];
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update staff', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exists = (await query('SELECT id FROM staff WHERE id = $1', [id])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Staff not found' });
    await query('DELETE FROM staff WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete staff', details: err.message });
  }
});

module.exports = router;
