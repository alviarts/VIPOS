// Appointment CRUD + state machine + reminders + convert-to-transaction
// (P1-13).
//
// Status flow:
//   PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
//   any pre-COMPLETED → CANCELLED / NO_SHOW
//
// Convert: appointment yang sudah selesai bisa di-link ke transaction
// (cashier yang membuat transaksi nanti, route ini hanya menyimpan ID-nya).
//
// Reminder: kirim 24h / 1h sebelum start_at. Implementasi production akan
// pakai marketing module (P1-11), di sini hanya mark `reminder_*_sent_at`.
const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  AppointmentCreateSchema,
  AppointmentUpdateSchema,
  AppointmentRescheduleSchema,
  AppointmentCancelSchema,
} = require('@vipos/shared');

const router = express.Router();

const VALID_STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

async function generateRefNo(q) {
  const last = (
    await q(`SELECT ref_no FROM appointments WHERE ref_no LIKE 'APT%' ORDER BY id DESC LIMIT 1`)
  ).rows[0];
  if (!last) return 'APT0001';
  const num = parseInt((last.ref_no || '').replace(/\D/g, ''), 10) || 0;
  return 'APT' + String(num + 1).padStart(4, '0');
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

async function loadServices(q, appointmentId) {
  return (
    await q(
      `SELECT id, product_id, service_name, qty, price, duration_minutes, subtotal
         FROM appointment_services WHERE appointment_id = $1
         ORDER BY id ASC`,
      [appointmentId]
    )
  ).rows;
}

async function rowToAppointment(q, row) {
  if (!row) return null;
  const services = await loadServices(q, row.id);
  return {
    ...row,
    reminders_config: parseJson(row.reminders_config, null),
    services,
  };
}

async function loadAppointment(q, id) {
  const row = (
    await q(
      `SELECT a.*,
              s.name AS staff_name,
              s.color AS staff_color,
              r.name AS resource_name
         FROM appointments a
         LEFT JOIN staff s ON s.id = a.staff_id
         LEFT JOIN appointment_resources r ON r.id = a.resource_id
        WHERE a.id = $1`,
      [id]
    )
  ).rows[0];
  return rowToAppointment(q, row);
}

function computeTotals(services) {
  let total = 0;
  let duration = 0;
  for (const s of services) {
    const qty = s.qty || 1;
    const subtotal = (s.price || 0) * qty;
    total += subtotal;
    duration += (s.duration_minutes || 0) * qty;
  }
  return { total, duration };
}

async function checkConflict(q, { staffId, resourceId, startAt, endAt, excludeId }) {
  const baseConds = ["status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')"];
  const baseParams = [endAt, startAt];

  if (staffId) {
    let p = 3;
    let conds = [...baseConds, `start_at < $1`, `end_at > $2`];
    const params = [...baseParams, staffId];
    conds.push(`staff_id = $${p++}`);
    if (excludeId) {
      conds.push(`id != $${p++}`);
      params.push(excludeId);
    }
    const staffConflict = (
      await q(`SELECT id FROM appointments WHERE ${conds.join(' AND ')} LIMIT 1`, params)
    ).rows[0];
    if (staffConflict) return { type: 'staff', id: staffConflict.id };
  }
  if (resourceId) {
    let p = 3;
    let conds = [...baseConds, `start_at < $1`, `end_at > $2`];
    const params = [...baseParams, resourceId];
    conds.push(`resource_id = $${p++}`);
    if (excludeId) {
      conds.push(`id != $${p++}`);
      params.push(excludeId);
    }
    const resConflict = (
      await q(`SELECT id FROM appointments WHERE ${conds.join(' AND ')} LIMIT 1`, params)
    ).rows[0];
    if (resConflict) return { type: 'resource', id: resConflict.id };
  }
  return null;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const conds = [];
    const params = [];
    let p = 1;
    if (req.query.from) {
      conds.push(`a.start_at >= $${p++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conds.push(`a.start_at <= $${p++}`);
      params.push(req.query.to);
    }
    if (req.query.status) {
      conds.push(`a.status = $${p++}`);
      params.push(req.query.status);
    }
    if (req.query.staff_id) {
      conds.push(`a.staff_id = $${p++}`);
      params.push(parseInt(req.query.staff_id, 10));
    }
    if (req.query.customer_id) {
      conds.push(`a.customer_id = $${p++}`);
      params.push(parseInt(req.query.customer_id, 10));
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT a.*,
                s.name AS staff_name,
                s.color AS staff_color,
                r.name AS resource_name
           FROM appointments a
           LEFT JOIN staff s ON s.id = a.staff_id
           LEFT JOIN appointment_resources r ON r.id = a.resource_id
           ${where}
           ORDER BY a.start_at ASC
           LIMIT 500`,
        params
      )
    ).rows;
    const out = await Promise.all(rows.map((row) => rowToAppointment(query, row)));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list appointments', details: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const apt = await loadAppointment(query, id);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(apt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load appointment', details: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  validate({ body: AppointmentCreateSchema }),
  async (req, res) => {
    try {
      const payload = req.body;
      const services = payload.services || [];
      const { total, duration } = computeTotals(services);
      const durationMinutes = payload.duration_minutes || duration || 30;

      const startAt = new Date(payload.start_at);
      if (Number.isNaN(startAt.getTime())) {
        return res.status(400).json({ error: 'start_at invalid' });
      }
      const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

      const conflict = await checkConflict(query, {
        staffId: payload.staff_id || null,
        resourceId: payload.resource_id || null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
      if (conflict) {
        return res.status(409).json({
          error: `Bentrok ${conflict.type === 'staff' ? 'staff' : 'resource'}`,
          conflicting_id: conflict.id,
        });
      }

      const id = await tx(async (txQuery) => {
        const refNo = await generateRefNo(txQuery);
        const ins = await txQuery(
          `INSERT INTO appointments (
              ref_no, customer_id, customer_name, customer_phone,
              staff_id, resource_id, start_at, end_at, duration_minutes,
              status, notes, deposit_amount, total, reminders_config
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id`,
          [
            refNo,
            payload.customer_id || null,
            payload.customer_name,
            payload.customer_phone || null,
            payload.staff_id || null,
            payload.resource_id || null,
            startAt.toISOString(),
            endAt.toISOString(),
            durationMinutes,
            payload.status || 'PENDING',
            payload.notes || null,
            payload.deposit_amount || 0,
            total,
            payload.reminders_config ? JSON.stringify(payload.reminders_config) : null,
          ]
        );
        const newId = ins.rows[0].id;
        for (const s of services) {
          const qty = s.qty || 1;
          const subtotal = (s.price || 0) * qty;
          await txQuery(
            `INSERT INTO appointment_services (
                appointment_id, product_id, service_name, qty, price,
                duration_minutes, subtotal
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              newId,
              s.product_id || null,
              s.service_name,
              qty,
              s.price || 0,
              s.duration_minutes || 0,
              subtotal,
            ]
          );
        }
        return newId;
      });

      const apt = await loadAppointment(query, id);
      res.status(201).json(apt);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create appointment', details: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  validate({ body: AppointmentUpdateSchema }),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await loadAppointment(query, id);
      if (!existing) return res.status(404).json({ error: 'Appointment not found' });
      if (
        existing.status === 'COMPLETED' ||
        existing.status === 'CANCELLED' ||
        existing.status === 'NO_SHOW'
      ) {
        return res
          .status(400)
          .json({ error: 'Tidak bisa edit appointment yang sudah selesai/batal' });
      }
      const payload = req.body;
      const services = payload.services || existing.services;
      const { total, duration } = computeTotals(services);
      const durationMinutes =
        payload.duration_minutes || duration || existing.duration_minutes || 30;
      const startAt = payload.start_at ? new Date(payload.start_at) : new Date(existing.start_at);
      const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

      const conflict = await checkConflict(query, {
        staffId: payload.staff_id ?? existing.staff_id,
        resourceId: payload.resource_id ?? existing.resource_id,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excludeId: id,
      });
      if (conflict) {
        return res.status(409).json({
          error: `Bentrok ${conflict.type === 'staff' ? 'staff' : 'resource'}`,
          conflicting_id: conflict.id,
        });
      }

      await tx(async (txQuery) => {
        await txQuery(
          `UPDATE appointments SET
              customer_id = $1, customer_name = $2, customer_phone = $3,
              staff_id = $4, resource_id = $5, start_at = $6, end_at = $7,
              duration_minutes = $8, notes = $9, deposit_amount = $10, total = $11,
              reminders_config = $12, updated_at = CURRENT_TIMESTAMP
            WHERE id = $13`,
          [
            payload.customer_id ?? existing.customer_id,
            payload.customer_name ?? existing.customer_name,
            payload.customer_phone ?? existing.customer_phone,
            payload.staff_id ?? existing.staff_id,
            payload.resource_id ?? existing.resource_id,
            startAt.toISOString(),
            endAt.toISOString(),
            durationMinutes,
            payload.notes ?? existing.notes,
            payload.deposit_amount ?? existing.deposit_amount,
            total,
            payload.reminders_config !== undefined
              ? JSON.stringify(payload.reminders_config)
              : existing.reminders_config
                ? JSON.stringify(existing.reminders_config)
                : null,
            id,
          ]
        );
        if (payload.services) {
          await txQuery(`DELETE FROM appointment_services WHERE appointment_id = $1`, [id]);
          for (const s of services) {
            const qty = s.qty || 1;
            const subtotal = (s.price || 0) * qty;
            await txQuery(
              `INSERT INTO appointment_services (
                  appointment_id, product_id, service_name, qty, price,
                  duration_minutes, subtotal
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                id,
                s.product_id || null,
                s.service_name,
                qty,
                s.price || 0,
                s.duration_minutes || 0,
                subtotal,
              ]
            );
          }
        }
      });
      res.json(await loadAppointment(query, id));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update appointment', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exists = (await query(`SELECT id FROM appointments WHERE id = $1`, [id])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Appointment not found' });
    await query(`DELETE FROM appointments WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete appointment', details: err.message });
  }
});

async function transitionStatus(id, nextStatus, extra = {}) {
  const existing = (await query(`SELECT status FROM appointments WHERE id = $1`, [id])).rows[0];
  if (!existing) return { error: 'not_found' };
  const allowed = VALID_STATUS_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      error: 'invalid_transition',
      from: existing.status,
      to: nextStatus,
    };
  }
  const fields = [];
  const values = [];
  let p = 1;
  fields.push(`status = $${p++}`);
  values.push(nextStatus);
  fields.push('updated_at = CURRENT_TIMESTAMP');
  if (nextStatus === 'IN_PROGRESS') {
    fields.push('checked_in_at = CURRENT_TIMESTAMP');
  }
  if (nextStatus === 'COMPLETED') {
    fields.push('completed_at = CURRENT_TIMESTAMP');
  }
  if (nextStatus === 'CANCELLED' || nextStatus === 'NO_SHOW') {
    fields.push('cancelled_at = CURRENT_TIMESTAMP');
  }
  if (extra.cancel_reason !== undefined) {
    fields.push(`cancel_reason = $${p++}`);
    values.push(extra.cancel_reason);
  }
  values.push(id);
  await query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = $${p}`, values);
  return { ok: true };
}

router.post('/:id/confirm', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await transitionStatus(id, 'CONFIRMED');
  if (result.error === 'not_found') return res.status(404).json({ error: 'Appointment not found' });
  if (result.error)
    return res.status(400).json({ ...result, error: 'Invalid transition', code: result.error });
  res.json(await loadAppointment(query, id));
});

router.post('/:id/checkin', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await transitionStatus(id, 'IN_PROGRESS');
  if (result.error === 'not_found') return res.status(404).json({ error: 'Appointment not found' });
  if (result.error)
    return res.status(400).json({ ...result, error: 'Invalid transition', code: result.error });
  res.json(await loadAppointment(query, id));
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await transitionStatus(id, 'COMPLETED');
  if (result.error === 'not_found') return res.status(404).json({ error: 'Appointment not found' });
  if (result.error)
    return res.status(400).json({ ...result, error: 'Invalid transition', code: result.error });
  res.json(await loadAppointment(query, id));
});

router.post(
  '/:id/cancel',
  authenticateToken,
  validate({ body: AppointmentCancelSchema }),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const result = await transitionStatus(id, 'CANCELLED', {
      cancel_reason: req.body?.reason || null,
    });
    if (result.error === 'not_found')
      return res.status(404).json({ error: 'Appointment not found' });
    if (result.error)
      return res.status(400).json({ ...result, error: 'Invalid transition', code: result.error });
    res.json(await loadAppointment(query, id));
  }
);

router.post('/:id/no-show', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const result = await transitionStatus(id, 'NO_SHOW');
  if (result.error === 'not_found') return res.status(404).json({ error: 'Appointment not found' });
  if (result.error)
    return res.status(400).json({ ...result, error: 'Invalid transition', code: result.error });
  res.json(await loadAppointment(query, id));
});

router.post(
  '/:id/reschedule',
  authenticateToken,
  validate({ body: AppointmentRescheduleSchema }),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await loadAppointment(query, id);
      if (!existing) return res.status(404).json({ error: 'Appointment not found' });
      if (
        existing.status === 'COMPLETED' ||
        existing.status === 'CANCELLED' ||
        existing.status === 'NO_SHOW'
      ) {
        return res.status(400).json({ error: 'Tidak bisa reschedule appointment selesai/batal' });
      }
      const startAt = new Date(req.body.start_at);
      if (Number.isNaN(startAt.getTime())) {
        return res.status(400).json({ error: 'start_at invalid' });
      }
      const durationMinutes = req.body.duration_minutes || existing.duration_minutes || 30;
      const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
      const staffId = req.body.staff_id !== undefined ? req.body.staff_id : existing.staff_id;
      const resourceId =
        req.body.resource_id !== undefined ? req.body.resource_id : existing.resource_id;
      const conflict = await checkConflict(query, {
        staffId,
        resourceId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        excludeId: id,
      });
      if (conflict) {
        return res.status(409).json({
          error: `Bentrok ${conflict.type === 'staff' ? 'staff' : 'resource'}`,
          conflicting_id: conflict.id,
        });
      }
      await query(
        `UPDATE appointments SET
            start_at = $1, end_at = $2, duration_minutes = $3,
            staff_id = $4, resource_id = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $6`,
        [startAt.toISOString(), endAt.toISOString(), durationMinutes, staffId, resourceId, id]
      );
      res.json(await loadAppointment(query, id));
    } catch (err) {
      res.status(500).json({ error: 'Failed to reschedule', details: err.message });
    }
  }
);

router.post('/:id/send-reminder', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = (await query(`SELECT * FROM appointments WHERE id = $1`, [id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });
    const window = req.body?.window || '24h';
    if (window !== '24h' && window !== '1h') {
      return res.status(400).json({ error: 'window harus 24h atau 1h' });
    }
    const field = window === '24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';
    await query(
      `UPDATE appointments SET ${field} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    // Note: actual WA/SMS dispatch akan dilakukan via marketing module
    // (P1-11). Di sini hanya mark sebagai "sent" untuk audit trail.
    res.json(await loadAppointment(query, id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reminder', details: err.message });
  }
});

router.post('/:id/convert', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const apt = await loadAppointment(query, id);
    if (!apt) return res.status(404).json({ error: 'Appointment not found' });
    if (apt.status !== 'COMPLETED' && apt.status !== 'IN_PROGRESS') {
      return res
        .status(400)
        .json({ error: 'Hanya bisa convert appointment IN_PROGRESS / COMPLETED' });
    }
    if (apt.transaction_id) {
      return res.status(400).json({ error: 'Appointment ini sudah dikonversi ke transaksi' });
    }
    const txId = req.body?.transaction_id ? parseInt(req.body.transaction_id, 10) : null;
    if (txId) {
      const tr = (await query(`SELECT id FROM transactions WHERE id = $1`, [txId])).rows[0];
      if (!tr) return res.status(404).json({ error: 'Transaction not found' });
      await query(
        `UPDATE appointments SET transaction_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [txId, id]
      );
    }
    res.json({
      ...(await loadAppointment(query, id)),
      cart_prefill: {
        customer_id: apt.customer_id,
        customer_name: apt.customer_name,
        items: (apt.services || []).map((s) => ({
          product_id: s.product_id,
          product_name: s.service_name,
          qty: s.qty,
          price: s.price,
          subtotal: s.subtotal,
        })),
        deposit_amount: apt.deposit_amount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to convert', details: err.message });
  }
});

module.exports = router;
