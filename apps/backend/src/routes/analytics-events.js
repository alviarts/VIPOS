// VIPOS — Analytics event ingestion endpoint.
//
// Surface:
//   POST /api/v1/analytics/events
//     body: { events: [{ name, properties?, timestamp? }] }
//     200:  { received: number }
//
// Receives batched analytics events from the Android app.
// Stores them for later analysis (dashboard, funnel reports).
// This is a server-side analytics store — independent of
// Firebase Analytics (which may not be available).

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/events', authenticateToken, async (req, res) => {
  try {
    const { events } = req.body || {};

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array harus diisi' });
    }

    if (events.length > 100) {
      return res.status(400).json({ error: 'Maksimal 100 events per batch' });
    }

    let received = 0;
    for (const event of events) {
      if (!event.name) continue;

      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, entity, action, after_json, created_at)
         VALUES ($1, $2, 'analytics', $3, $4, $5)`,
        [
          req.tenantId,
          req.user?.id || null,
          event.name,
          event.properties ? JSON.stringify(event.properties) : null,
          event.timestamp ? new Date(event.timestamp) : new Date(),
        ],
      );
      received++;
    }

    return res.status(200).json({ received });
  } catch (err) {
    console.error('Analytics events error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan events' });
  }
});

module.exports = router;
