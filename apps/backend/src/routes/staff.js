// Staff CRUD (P1-13). Re-used by appointment, calendar, dan future modul
// karyawan/payroll (P1-14).
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { StaffCreateSchema, StaffUpdateSchema } = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, phone, email, role, color, is_active,
                created_at, updated_at
           FROM staff ORDER BY name ASC`
      )
      .all();
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
  (req, res) => {
    try {
      const db = getDb();
      const { name, phone, email, role, color, is_active = 1 } = req.body;
      const result = db
        .prepare(
          `INSERT INTO staff (name, phone, email, role, color, is_active)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(name, phone || null, email || null, role || null, color || '#04C99E', is_active);
      const created = db.prepare(`SELECT * FROM staff WHERE id = ?`).get(result.lastInsertRowid);
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
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const exists = db.prepare(`SELECT id FROM staff WHERE id = ?`).get(id);
      if (!exists) return res.status(404).json({ error: 'Staff not found' });
      const allowed = ['name', 'phone', 'email', 'role', 'color', 'is_active'];
      const fields = [];
      const values = [];
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = ?`);
          values.push(req.body[key] ?? null);
        }
      }
      if (fields.length === 0) {
        const row = db.prepare(`SELECT * FROM staff WHERE id = ?`).get(id);
        return res.json(row);
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      const row = db.prepare(`SELECT * FROM staff WHERE id = ?`).get(id);
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update staff', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const exists = db.prepare(`SELECT id FROM staff WHERE id = ?`).get(id);
    if (!exists) return res.status(404).json({ error: 'Staff not found' });
    db.prepare(`DELETE FROM staff WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete staff', details: err.message });
  }
});

module.exports = router;
