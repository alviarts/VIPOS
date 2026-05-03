// Calendar view (P1-13). Returns appointments + staff + resources within
// date range — convenient single fetch for the calendar UI (day/week/month).
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;
    const conds = ['a.start_at >= ?', 'a.start_at <= ?'];
    const params = [from, `${to} 23:59:59`];
    if (req.query.staff_id) {
      conds.push('a.staff_id = ?');
      params.push(parseInt(req.query.staff_id, 10));
    }
    if (req.query.resource_id) {
      conds.push('a.resource_id = ?');
      params.push(parseInt(req.query.resource_id, 10));
    }
    const where = `WHERE ${conds.join(' AND ')}`;
    const rows = db
      .prepare(
        `SELECT a.id, a.ref_no, a.start_at, a.end_at, a.status,
                a.customer_name, a.staff_id, a.resource_id, a.total,
                s.name AS staff_name, s.color AS staff_color,
                r.name AS resource_name,
                (SELECT GROUP_CONCAT(service_name, ', ')
                   FROM appointment_services WHERE appointment_id = a.id)
                  AS service_summary
           FROM appointments a
           LEFT JOIN staff s ON s.id = a.staff_id
           LEFT JOIN appointment_resources r ON r.id = a.resource_id
           ${where}
           ORDER BY a.start_at ASC`
      )
      .all(...params);

    const staff = db
      .prepare(
        `SELECT id, name, phone, email, role, color, is_active,
                created_at, updated_at
           FROM staff WHERE is_active = 1 ORDER BY name ASC`
      )
      .all();
    const resources = db
      .prepare(
        `SELECT id, name, resource_type, capacity, is_active,
                created_at, updated_at
           FROM appointment_resources WHERE is_active = 1 ORDER BY name ASC`
      )
      .all();

    res.json({
      from,
      to,
      appointments: rows,
      staff,
      resources,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load calendar', details: err.message });
  }
});

module.exports = router;
