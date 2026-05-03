// Appointment resource CRUD (P1-13). Resources = ruangan/treatment-room/meja
// untuk dipakai di appointment & kalender.
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  AppointmentResourceCreateSchema,
  AppointmentResourceUpdateSchema,
} = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, resource_type, capacity, is_active,
                created_at, updated_at
           FROM appointment_resources ORDER BY name ASC`
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load resources', details: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: AppointmentResourceCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const { name, resource_type = 'room', capacity = 1, is_active = 1 } = req.body;
      const result = db
        .prepare(
          `INSERT INTO appointment_resources (name, resource_type, capacity, is_active)
           VALUES (?, ?, ?, ?)`
        )
        .run(name, resource_type, capacity, is_active);
      const row = db
        .prepare(`SELECT * FROM appointment_resources WHERE id = ?`)
        .get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create resource', details: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: AppointmentResourceUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const exists = db.prepare(`SELECT id FROM appointment_resources WHERE id = ?`).get(id);
      if (!exists) return res.status(404).json({ error: 'Resource not found' });
      const allowed = ['name', 'resource_type', 'capacity', 'is_active'];
      const fields = [];
      const values = [];
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = ?`);
          values.push(req.body[key]);
        }
      }
      if (fields.length === 0) {
        const row = db.prepare(`SELECT * FROM appointment_resources WHERE id = ?`).get(id);
        return res.json(row);
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE appointment_resources SET ${fields.join(', ')} WHERE id = ?`).run(
        ...values
      );
      const row = db.prepare(`SELECT * FROM appointment_resources WHERE id = ?`).get(id);
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update resource', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const exists = db.prepare(`SELECT id FROM appointment_resources WHERE id = ?`).get(id);
    if (!exists) return res.status(404).json({ error: 'Resource not found' });
    db.prepare(`DELETE FROM appointment_resources WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete resource', details: err.message });
  }
});

module.exports = router;
