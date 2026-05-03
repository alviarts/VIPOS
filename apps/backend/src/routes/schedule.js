// Shifts + schedule assignments + swap workflow (P1-14).
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  ShiftCreateSchema,
  ShiftUpdateSchema,
  ScheduleAssignSchema,
  ScheduleSwapCreateSchema,
  ScheduleSwapDecisionSchema,
} = require('@vipos/shared');

const shiftRouter = express.Router();
const scheduleRouter = express.Router();
const swapRouter = express.Router();

// ============== SHIFT ==============
shiftRouter.get('/', authenticateToken, (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM shifts ORDER BY start_time ASC`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

shiftRouter.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: ShiftCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const data = req.body;
      const result = db
        .prepare(
          `INSERT INTO shifts (name, start_time, end_time, break_minutes, color, is_active) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.name,
          data.start_time,
          data.end_time,
          data.break_minutes || 0,
          data.color || '#04C99E',
          data.is_active ?? 1
        );
      res
        .status(201)
        .json(db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(result.lastInsertRowid));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

shiftRouter.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: ShiftUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const exists = db.prepare(`SELECT id FROM shifts WHERE id = ?`).get(id);
      if (!exists) return res.status(404).json({ error: 'Shift not found' });
      const allowed = ['name', 'start_time', 'end_time', 'break_minutes', 'color', 'is_active'];
      const fields = [];
      const values = [];
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = ?`);
          values.push(req.body[key]);
        }
      }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE shifts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      res.json(db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(id));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

shiftRouter.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    db.prepare(`DELETE FROM shifts WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ============== SCHEDULE ==============
scheduleRouter.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conds = [];
    const params = [];
    if (req.query.from) {
      conds.push('s.schedule_date >= ?');
      params.push(req.query.from);
    }
    if (req.query.to) {
      conds.push('s.schedule_date <= ?');
      params.push(req.query.to);
    }
    if (req.query.employee_id) {
      conds.push('s.employee_id = ?');
      params.push(parseInt(req.query.employee_id, 10));
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT s.*, e.name AS employee_name,
                sh.name AS shift_name, sh.start_time AS shift_start, sh.end_time AS shift_end
           FROM schedule_assignments s
           LEFT JOIN employees e ON e.id = s.employee_id
           LEFT JOIN shifts sh ON sh.id = s.shift_id
           ${where}
           ORDER BY s.schedule_date ASC, e.name ASC`
      )
      .all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

scheduleRouter.post(
  '/assign',
  authenticateToken,
  requireAdmin,
  validate({ body: ScheduleAssignSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const upsert = db.prepare(
        `INSERT INTO schedule_assignments (employee_id, shift_id, schedule_date, is_off, note)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, schedule_date)
         DO UPDATE SET shift_id = excluded.shift_id, is_off = excluded.is_off, note = excluded.note, updated_at = CURRENT_TIMESTAMP`
      );
      const tx = db.transaction(() => {
        for (const a of req.body.assignments) {
          upsert.run(
            a.employee_id,
            a.shift_id || null,
            a.schedule_date,
            a.is_off ? 1 : 0,
            a.note || null
          );
        }
      });
      tx();
      res.json({
        success: true,
        count: req.body.assignments.length,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

scheduleRouter.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    db.prepare(`DELETE FROM schedule_assignments WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ============== SWAP ==============
swapRouter.get('/', authenticateToken, (req, res) => {
  try {
    const rows = getDb()
      .prepare(
        `SELECT s.*, e1.name AS requester_name, e2.name AS partner_name
           FROM schedule_swaps s
           LEFT JOIN employees e1 ON e1.id = s.requester_id
           LEFT JOIN employees e2 ON e2.id = s.partner_id
           ORDER BY s.created_at DESC`
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

swapRouter.post(
  '/',
  authenticateToken,
  validate({ body: ScheduleSwapCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const data = req.body;
      // Verify both assignments exist and belong to declared employees.
      const reqAssign = db
        .prepare(`SELECT * FROM schedule_assignments WHERE id = ?`)
        .get(data.requester_assignment_id);
      const partnerAssign = db
        .prepare(`SELECT * FROM schedule_assignments WHERE id = ?`)
        .get(data.partner_assignment_id);
      if (!reqAssign || !partnerAssign) {
        return res.status(404).json({ error: 'Assignment(s) not found' });
      }
      if (
        reqAssign.employee_id !== data.requester_id ||
        partnerAssign.employee_id !== data.partner_id
      ) {
        return res.status(400).json({ error: 'Assignment ownership mismatch' });
      }
      const result = db
        .prepare(
          `INSERT INTO schedule_swaps (requester_id, requester_assignment_id, partner_id, partner_assignment_id, reason, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`
        )
        .run(
          data.requester_id,
          data.requester_assignment_id,
          data.partner_id,
          data.partner_assignment_id,
          data.reason || null
        );
      res
        .status(201)
        .json(db.prepare(`SELECT * FROM schedule_swaps WHERE id = ?`).get(result.lastInsertRowid));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

swapRouter.post(
  '/:id/approve',
  authenticateToken,
  requireAdmin,
  validate({ body: ScheduleSwapDecisionSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const swap = db.prepare(`SELECT * FROM schedule_swaps WHERE id = ?`).get(id);
      if (!swap) return res.status(404).json({ error: 'Not found' });
      if (swap.status !== 'PENDING')
        return res.status(400).json({ error: 'Swap sudah diputuskan sebelumnya' });

      const reqA = db
        .prepare(`SELECT * FROM schedule_assignments WHERE id = ?`)
        .get(swap.requester_assignment_id);
      const partnerA = db
        .prepare(`SELECT * FROM schedule_assignments WHERE id = ?`)
        .get(swap.partner_assignment_id);
      if (!reqA || !partnerA) return res.status(404).json({ error: 'Assignments missing' });

      // Atomic swap: tukar isi (shift_id, schedule_date, is_off, note) antar
      // dua assignment, employee_id tetap. Begitu unique(employee_id,
      // schedule_date) tidak bentrok, dan setiap karyawan tetap memegang
      // riwayat assignment-nya sendiri. Tetap perlu sentinel tanggal supaya
      // dua assignment tidak bentrok ketika date berubah.
      const tx = db.transaction(() => {
        const sentinel = '0001-01-01';
        db.prepare(
          `UPDATE schedule_assignments SET schedule_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(sentinel, reqA.id);
        db.prepare(
          `UPDATE schedule_assignments SET shift_id = ?, schedule_date = ?, is_off = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(reqA.shift_id, reqA.schedule_date, reqA.is_off, reqA.note, partnerA.id);
        db.prepare(
          `UPDATE schedule_assignments SET shift_id = ?, schedule_date = ?, is_off = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(partnerA.shift_id, partnerA.schedule_date, partnerA.is_off, partnerA.note, reqA.id);
        db.prepare(
          `UPDATE schedule_swaps SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP, decision_note = ? WHERE id = ?`
        ).run(req.user?.id || null, req.body.decision_note || null, id);
      });
      tx();
      res.json(db.prepare(`SELECT * FROM schedule_swaps WHERE id = ?`).get(id));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

swapRouter.post(
  '/:id/reject',
  authenticateToken,
  requireAdmin,
  validate({ body: ScheduleSwapDecisionSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const swap = db.prepare(`SELECT * FROM schedule_swaps WHERE id = ?`).get(id);
      if (!swap) return res.status(404).json({ error: 'Not found' });
      if (swap.status !== 'PENDING')
        return res.status(400).json({ error: 'Swap sudah diputuskan sebelumnya' });
      db.prepare(
        `UPDATE schedule_swaps SET status = 'REJECTED', decided_by = ?, decided_at = CURRENT_TIMESTAMP, decision_note = ? WHERE id = ?`
      ).run(req.user?.id || null, req.body.decision_note || null, id);
      res.json(db.prepare(`SELECT * FROM schedule_swaps WHERE id = ?`).get(id));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

module.exports = { shiftRouter, scheduleRouter, swapRouter };
