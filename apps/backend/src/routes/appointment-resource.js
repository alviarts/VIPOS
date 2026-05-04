// Appointment resource CRUD (P1-13, P2-01b cutover). Resources =
// ruangan/treatment-room/meja untuk dipakai di appointment & kalender.
const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  AppointmentResourceCreateSchema,
  AppointmentResourceUpdateSchema,
} = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT id, name, resource_type, capacity, is_active,
                created_at, updated_at
           FROM appointment_resources ORDER BY name ASC`
      )
    ).rows;
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
  async (req, res) => {
    try {
      const { name, resource_type = 'room', capacity = 1, is_active = 1 } = req.body;
      const ins = await query(
        `INSERT INTO appointment_resources (name, resource_type, capacity, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, resource_type, capacity, is_active]
      );
      const row = (
        await query('SELECT * FROM appointment_resources WHERE id = $1', [ins.rows[0].id])
      ).rows[0];
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query('SELECT id FROM appointment_resources WHERE id = $1', [id]))
        .rows[0];
      if (!exists) return res.status(404).json({ error: 'Resource not found' });
      const allowed = ['name', 'resource_type', 'capacity', 'is_active'];
      const fields = [];
      const values = [];
      let p = 1;
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${p++}`);
          values.push(req.body[key]);
        }
      }
      if (fields.length === 0) {
        const row = (await query('SELECT * FROM appointment_resources WHERE id = $1', [id]))
          .rows[0];
        return res.json(row);
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await query(`UPDATE appointment_resources SET ${fields.join(', ')} WHERE id = $${p}`, values);
      const row = (await query('SELECT * FROM appointment_resources WHERE id = $1', [id])).rows[0];
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update resource', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exists = (await query('SELECT id FROM appointment_resources WHERE id = $1', [id]))
      .rows[0];
    if (!exists) return res.status(404).json({ error: 'Resource not found' });
    await query('DELETE FROM appointment_resources WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete resource', details: err.message });
  }
});

module.exports = router;
