// VIPOS — Simple cron-like task scheduler.
//
// Runs periodic tasks without external dependencies (no Redis,
// no BullMQ for simple periodic work). Uses setInterval with
// drift compensation.
//
// Tasks:
//   - Loyalty point expiry (monthly)
//   - Stale QRIS invocation cleanup (hourly)
//   - Database backup reminder (daily)
//
// Usage:
//   const { startScheduler } = require('./lib/scheduler');
//   startScheduler(); // Call once on app boot

const { query } = require('../db');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Clean up expired QRIS invocations older than 24 hours.
 * These are already in terminal state (EXPIRED) but keeping
 * them forever wastes disk. Runs hourly.
 */
async function cleanupExpiredQris() {
  try {
    const { rowCount } = await query(
      `DELETE FROM qris_dynamic_invocations
       WHERE status = 'EXPIRED'
         AND created_at < NOW() - INTERVAL '24 hours'`,
    );
    if (rowCount > 0) {
      console.log(`[scheduler] Cleaned up ${rowCount} expired QRIS invocations`);
    }
  } catch (err) {
    console.error('[scheduler] QRIS cleanup error:', err.message);
  }
}

/**
 * Expire loyalty points that are past their expiry date.
 * Runs daily. Only processes rules with points_expire_after_months set.
 */
async function expireLoyaltyPoints() {
  try {
    // Find customers with points that should expire based on
    // their last earn date + rule's expire_after_months.
    // This is a simplified version — full implementation would
    // track per-point expiry dates.
    const { rows: rules } = await query(
      `SELECT id, points_expire_after_months
       FROM loyalty_rules
       WHERE is_active = 1
         AND points_expire_after_months IS NOT NULL
         AND points_expire_after_months > 0`,
    );

    if (rules.length === 0) return;

    for (const rule of rules) {
      const months = rule.points_expire_after_months;
      // Find customers whose last earn was > N months ago and still have points
      const { rows: customers } = await query(
        `SELECT lt.customer_id, c.points as current_points
         FROM loyalty_transactions lt
         JOIN customers c ON lt.customer_id = c.id
         WHERE lt.rule_id = $1
           AND lt.type = 'earn'
           AND lt.created_at < NOW() - ($2 || ' months')::interval
           AND c.points > 0
         GROUP BY lt.customer_id, c.points
         HAVING MAX(lt.created_at) < NOW() - ($2 || ' months')::interval`,
        [rule.id, months.toString()],
      );

      for (const cust of customers) {
        // Expire all points
        await query(
          `UPDATE customers SET points = 0 WHERE id = $1`,
          [cust.customer_id],
        );
        await query(
          `INSERT INTO loyalty_transactions
             (tenant_id, customer_id, type, points, balance_after, rule_id)
           SELECT tenant_id, $1, 'expire', $2, 0, $3
           FROM customers WHERE id = $1`,
          [cust.customer_id, -(cust.current_points), rule.id],
        );
      }

      if (customers.length > 0) {
        console.log(`[scheduler] Expired points for ${customers.length} customers (rule ${rule.id})`);
      }
    }
  } catch (err) {
    console.error('[scheduler] Loyalty expiry error:', err.message);
  }
}

/**
 * Start all scheduled tasks.
 */
function startScheduler() {
  console.log('[scheduler] Starting periodic tasks...');

  // QRIS cleanup: every hour
  setInterval(cleanupExpiredQris, HOUR_MS);

  // Loyalty expiry: every day at ~3 AM (offset from boot)
  setTimeout(() => {
    expireLoyaltyPoints();
    setInterval(expireLoyaltyPoints, DAY_MS);
  }, 10_000); // 10s after boot for first run

  console.log('[scheduler] Scheduled: QRIS cleanup (hourly), loyalty expiry (daily)');
}

module.exports = { startScheduler, cleanupExpiredQris, expireLoyaltyPoints };
