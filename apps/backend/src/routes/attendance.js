// Attendance log + geofence config (P1-14, P2-01b cutover).
const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AttendanceLogCreateSchema, AttendanceGeofenceUpsertSchema } = require('@vipos/shared');

const logRouter = express.Router();
const fenceRouter = express.Router();

logRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const conds = [];
    const params = [];
    let p = 1;
    if (req.query.employee_id) {
      conds.push(`a.employee_id = $${p++}`);
      params.push(parseInt(req.query.employee_id, 10));
    }
    if (req.query.from) {
      conds.push(`a.logged_at >= $${p++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conds.push(`a.logged_at <= $${p++}`);
      params.push(`${req.query.to} 23:59:59`);
    }
    if (req.query.log_type) {
      conds.push(`a.log_type = $${p++}`);
      params.push(req.query.log_type);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT a.*, e.name AS employee_name
           FROM attendance_logs a
           LEFT JOIN employees e ON e.id = a.employee_id
           ${where}
           ORDER BY a.logged_at DESC
           LIMIT 500`,
        params
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

logRouter.post(
  '/',
  authenticateToken,
  validate({ body: AttendanceLogCreateSchema }),
  async (req, res) => {
    try {
      const data = req.body;
      const employee = (await query('SELECT id FROM employees WHERE id = $1', [data.employee_id]))
        .rows[0];
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
      const ins = await query(
        `INSERT INTO attendance_logs (
            employee_id, log_type, logged_at, method, latitude, longitude,
            photo_url, note, is_off_site
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          data.employee_id,
          data.log_type,
          data.logged_at || new Date().toISOString(),
          data.method || 'manual',
          data.latitude ?? null,
          data.longitude ?? null,
          data.photo_url || null,
          data.note || null,
          data.is_off_site ? 1 : 0,
        ]
      );
      const row = (
        await query(
          `SELECT a.*, e.name AS employee_name
             FROM attendance_logs a
             LEFT JOIN employees e ON e.id = a.employee_id
            WHERE a.id = $1`,
          [ins.rows[0].id]
        )
      ).rows[0];
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

logRouter.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM attendance_logs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// Geofence
fenceRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (await query('SELECT * FROM attendance_geofences ORDER BY outlet_id ASC')).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

fenceRouter.put(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: AttendanceGeofenceUpsertSchema }),
  async (req, res) => {
    try {
      const data = req.body;
      const exists = (
        await query('SELECT id FROM attendance_geofences WHERE outlet_id = $1', [data.outlet_id])
      ).rows[0];
      if (exists) {
        await query(
          `UPDATE attendance_geofences
              SET outlet_name = $1, latitude = $2, longitude = $3,
                  radius_m = $4, strict_mode = $5, updated_at = CURRENT_TIMESTAMP
            WHERE outlet_id = $6`,
          [
            data.outlet_name || null,
            data.latitude ?? null,
            data.longitude ?? null,
            data.radius_m || 100,
            data.strict_mode ? 1 : 0,
            data.outlet_id,
          ]
        );
      } else {
        await query(
          `INSERT INTO attendance_geofences
              (outlet_id, outlet_name, latitude, longitude, radius_m, strict_mode)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            data.outlet_id,
            data.outlet_name || null,
            data.latitude ?? null,
            data.longitude ?? null,
            data.radius_m || 100,
            data.strict_mode ? 1 : 0,
          ]
        );
      }
      const row = (
        await query('SELECT * FROM attendance_geofences WHERE outlet_id = $1', [data.outlet_id])
      ).rows[0];
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

module.exports = { logRouter, fenceRouter };
