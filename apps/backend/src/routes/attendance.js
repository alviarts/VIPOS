// Attendance log + geofence config (P1-14).
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AttendanceLogCreateSchema, AttendanceGeofenceUpsertSchema } = require('@vipos/shared');

const logRouter = express.Router();
const fenceRouter = express.Router();

logRouter.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conds = [];
    const params = [];
    if (req.query.employee_id) {
      conds.push('a.employee_id = ?');
      params.push(parseInt(req.query.employee_id, 10));
    }
    if (req.query.from) {
      conds.push('a.logged_at >= ?');
      params.push(req.query.from);
    }
    if (req.query.to) {
      conds.push('a.logged_at <= ?');
      params.push(`${req.query.to} 23:59:59`);
    }
    if (req.query.log_type) {
      conds.push('a.log_type = ?');
      params.push(req.query.log_type);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT a.*, e.name AS employee_name
           FROM attendance_logs a
           LEFT JOIN employees e ON e.id = a.employee_id
           ${where}
           ORDER BY a.logged_at DESC
           LIMIT 500`
      )
      .all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

logRouter.post(
  '/',
  authenticateToken,
  validate({ body: AttendanceLogCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const data = req.body;
      const employee = db.prepare(`SELECT id FROM employees WHERE id = ?`).get(data.employee_id);
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
      const result = db
        .prepare(
          `INSERT INTO attendance_logs (
             employee_id, log_type, logged_at, method, latitude, longitude,
             photo_url, note, is_off_site
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.employee_id,
          data.log_type,
          data.logged_at || new Date().toISOString(),
          data.method || 'manual',
          data.latitude ?? null,
          data.longitude ?? null,
          data.photo_url || null,
          data.note || null,
          data.is_off_site ? 1 : 0
        );
      const row = db
        .prepare(
          `SELECT a.*, e.name AS employee_name FROM attendance_logs a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`
        )
        .get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

logRouter.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    db.prepare(`DELETE FROM attendance_logs WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// Geofence
fenceRouter.get('/', authenticateToken, (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM attendance_geofences ORDER BY outlet_id ASC`).all();
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
  (req, res) => {
    try {
      const db = getDb();
      const data = req.body;
      const exists = db
        .prepare(`SELECT id FROM attendance_geofences WHERE outlet_id = ?`)
        .get(data.outlet_id);
      if (exists) {
        db.prepare(
          `UPDATE attendance_geofences SET outlet_name = ?, latitude = ?, longitude = ?, radius_m = ?, strict_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE outlet_id = ?`
        ).run(
          data.outlet_name || null,
          data.latitude ?? null,
          data.longitude ?? null,
          data.radius_m || 100,
          data.strict_mode ? 1 : 0,
          data.outlet_id
        );
      } else {
        db.prepare(
          `INSERT INTO attendance_geofences (outlet_id, outlet_name, latitude, longitude, radius_m, strict_mode) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          data.outlet_id,
          data.outlet_name || null,
          data.latitude ?? null,
          data.longitude ?? null,
          data.radius_m || 100,
          data.strict_mode ? 1 : 0
        );
      }
      const row = db
        .prepare(`SELECT * FROM attendance_geofences WHERE outlet_id = ?`)
        .get(data.outlet_id);
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

module.exports = { logRouter, fenceRouter };
