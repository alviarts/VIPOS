/**
 * SQLite driver for the async query layer (P2-01b).
 *
 * Uses better-sqlite3 under the hood (sync), wrapped in resolved Promises
 * so the call site can `await`. This driver is the default and is used
 * by all tests + local dev — Postgres is not required to run the app.
 *
 * PLACEHOLDER TRANSLATION:
 *   Routes write SQL with $1, $2, ... (Postgres-style) so the same SQL
 *   works under both drivers. This module rewrites $N → ? before passing
 *   to better-sqlite3.
 *
 * DDL FILTER:
 *   The Postgres-only `RETURNING` clause works on SQLite >= 3.35
 *   (better-sqlite3 ships current sqlite). No translation needed.
 */

const { getDb } = require('../models/database');

/**
 * Translate Postgres-style $1, $2 placeholders to SQLite ? placeholders.
 * Naive but correct for the SQL we generate (no nested $ in identifiers
 * or string literals — guarded by code review of route refactors).
 */
function translateSql(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

function isMutation(sql) {
  return /^\s*(insert|update|delete)\b/i.test(sql);
}

function hasReturning(sql) {
  return /\breturning\b/i.test(sql);
}

async function query(sql, params = []) {
  const db = getDb();
  const sqliteSql = translateSql(sql);
  const stmt = db.prepare(sqliteSql);
  if (isMutation(sqliteSql) && !hasReturning(sqliteSql)) {
    const info = stmt.run(...params);
    return { rows: [], rowCount: info.changes };
  }
  // SELECT, or mutation with RETURNING.
  if (hasReturning(sqliteSql) && isMutation(sqliteSql)) {
    const rows = stmt.all(...params);
    return { rows, rowCount: rows.length };
  }
  const rows = stmt.all(...params);
  return { rows, rowCount: rows.length };
}

async function tx(fn) {
  const db = getDb();
  // better-sqlite3 transactions are sync. We need to call the user's async
  // callback with a tx-bound query helper — since better-sqlite3 holds a
  // single connection, "tx-bound" just means we run inside the same
  // transaction scope. We wrap the call manually with BEGIN/COMMIT on the
  // raw connection so the callback can stay async.
  db.exec('BEGIN');
  try {
    const result = await fn(query);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  }
}

function _resetForTests() {
  // Underlying database singleton is reset by tests via
  // `require('../models/database')._resetDbForTests()`. Nothing extra to do
  // here — `getDb()` will re-open lazily next time.
}

module.exports = { query, tx, _resetForTests };
