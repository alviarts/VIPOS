// Shifts + schedule assignments + swap workflow (P1-14).
const express = require('express');
const { query, tx } = require('../db');
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
shiftRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (await query(`SELECT * FROM shifts ORDER BY start_time ASC`)).rows;
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
  async (req, res) => {
    try {
      const data = req.body;
      const ins = await query(
        `INSERT INTO shifts (name, start_time, end_time, break_minutes, color, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          data.name,
          data.start_time,
          data.end_time,
          data.break_minutes || 0,
          data.color || '#04C99E',
          data.is_active ?? 1,
        ]
      );
      const row = (await query(`SELECT * FROM shifts WHERE id = $1`, [ins.rows[0].id])).rows[0];
      res.status(201).json(row);
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query(`SELECT id FROM shifts WHERE id = $1`, [id])).rows[0];
      if (!exists) return res.status(404).json({ error: 'Shift not found' });
      const allowed = ['name', 'start_time', 'end_time', 'break_minutes', 'color', 'is_active'];
      const fields = [];
      const values = [];
      let p = 1;
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${p++}`);
          values.push(req.body[key]);
        }
      }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await query(`UPDATE shifts SET ${fields.join(', ')} WHERE id = $${p}`, values);
      }
      const row = (await query(`SELECT * FROM shifts WHERE id = $1`, [id])).rows[0];
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

shiftRouter.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query(`DELETE FROM shifts WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ============== SCHEDULE ==============
scheduleRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const conds = [];
    const params = [];
    let p = 1;
    if (req.query.from) {
      conds.push(`s.schedule_date >= $${p++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conds.push(`s.schedule_date <= $${p++}`);
      params.push(req.query.to);
    }
    if (req.query.employee_id) {
      conds.push(`s.employee_id = $${p++}`);
      params.push(parseInt(req.query.employee_id, 10));
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT s.*, e.name AS employee_name,
                sh.name AS shift_name, sh.start_time AS shift_start, sh.end_time AS shift_end
           FROM schedule_assignments s
           LEFT JOIN employees e ON e.id = s.employee_id
           LEFT JOIN shifts sh ON sh.id = s.shift_id
           ${where}
           ORDER BY s.schedule_date ASC, e.name ASC`,
        params
      )
    ).rows;
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
  async (req, res) => {
    try {
      await tx(async (txQuery) => {
        for (const a of req.body.assignments) {
          await txQuery(
            `INSERT INTO schedule_assignments (employee_id, shift_id, schedule_date, is_off, note)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT(employee_id, schedule_date)
             DO UPDATE SET shift_id = excluded.shift_id, is_off = excluded.is_off, note = excluded.note, updated_at = CURRENT_TIMESTAMP`,
            [a.employee_id, a.shift_id || null, a.schedule_date, a.is_off ? 1 : 0, a.note || null]
          );
        }
      });
      res.json({
        success: true,
        count: req.body.assignments.length,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

scheduleRouter.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query(`DELETE FROM schedule_assignments WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ============== SWAP ==============
swapRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT s.*, e1.name AS requester_name, e2.name AS partner_name
           FROM schedule_swaps s
           LEFT JOIN employees e1 ON e1.id = s.requester_id
           LEFT JOIN employees e2 ON e2.id = s.partner_id
           ORDER BY s.created_at DESC`
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

swapRouter.post(
  '/',
  authenticateToken,
  validate({ body: ScheduleSwapCreateSchema }),
  async (req, res) => {
    try {
      const data = req.body;
      const reqAssign = (
        await query(`SELECT * FROM schedule_assignments WHERE id = $1`, [
          data.requester_assignment_id,
        ])
      ).rows[0];
      const partnerAssign = (
        await query(`SELECT * FROM schedule_assignments WHERE id = $1`, [
          data.partner_assignment_id,
        ])
      ).rows[0];
      if (!reqAssign || !partnerAssign) {
        return res.status(404).json({ error: 'Assignment(s) not found' });
      }
      if (
        reqAssign.employee_id !== data.requester_id ||
        partnerAssign.employee_id !== data.partner_id
      ) {
        return res.status(400).json({ error: 'Assignment ownership mismatch' });
      }
      const ins = await query(
        `INSERT INTO schedule_swaps (requester_id, requester_assignment_id, partner_id, partner_assignment_id, reason, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING id`,
        [
          data.requester_id,
          data.requester_assignment_id,
          data.partner_id,
          data.partner_assignment_id,
          data.reason || null,
        ]
      );
      const row = (await query(`SELECT * FROM schedule_swaps WHERE id = $1`, [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(row);
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const swap = (await query(`SELECT * FROM schedule_swaps WHERE id = $1`, [id])).rows[0];
      if (!swap) return res.status(404).json({ error: 'Not found' });
      if (swap.status !== 'PENDING')
        return res.status(400).json({ error: 'Swap sudah diputuskan sebelumnya' });

      const reqA = (
        await query(`SELECT * FROM schedule_assignments WHERE id = $1`, [
          swap.requester_assignment_id,
        ])
      ).rows[0];
      const partnerA = (
        await query(`SELECT * FROM schedule_assignments WHERE id = $1`, [
          swap.partner_assignment_id,
        ])
      ).rows[0];
      if (!reqA || !partnerA) return res.status(404).json({ error: 'Assignments missing' });

      // Atomic swap: tukar isi (shift_id, schedule_date, is_off, note) antar
      // dua assignment, employee_id tetap. Sentinel tanggal mencegah unique
      // (employee_id, schedule_date) bentrok di tengah swap.
      await tx(async (txQuery) => {
        const sentinel = '0001-01-01';
        await txQuery(
          `UPDATE schedule_assignments SET schedule_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [sentinel, reqA.id]
        );
        await txQuery(
          `UPDATE schedule_assignments SET shift_id = $1, schedule_date = $2, is_off = $3, note = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
          [reqA.shift_id, reqA.schedule_date, reqA.is_off, reqA.note, partnerA.id]
        );
        await txQuery(
          `UPDATE schedule_assignments SET shift_id = $1, schedule_date = $2, is_off = $3, note = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
          [partnerA.shift_id, partnerA.schedule_date, partnerA.is_off, partnerA.note, reqA.id]
        );
        await txQuery(
          `UPDATE schedule_swaps SET status = 'APPROVED', decided_by = $1, decided_at = CURRENT_TIMESTAMP, decision_note = $2 WHERE id = $3`,
          [req.user?.id || null, req.body.decision_note || null, id]
        );
      });
      const row = (await query(`SELECT * FROM schedule_swaps WHERE id = $1`, [id])).rows[0];
      res.json(row);
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const swap = (await query(`SELECT * FROM schedule_swaps WHERE id = $1`, [id])).rows[0];
      if (!swap) return res.status(404).json({ error: 'Not found' });
      if (swap.status !== 'PENDING')
        return res.status(400).json({ error: 'Swap sudah diputuskan sebelumnya' });
      await query(
        `UPDATE schedule_swaps SET status = 'REJECTED', decided_by = $1, decided_at = CURRENT_TIMESTAMP, decision_note = $2 WHERE id = $3`,
        [req.user?.id || null, req.body.decision_note || null, id]
      );
      const row = (await query(`SELECT * FROM schedule_swaps WHERE id = $1`, [id])).rows[0];
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

module.exports = { shiftRouter, scheduleRouter, swapRouter };
