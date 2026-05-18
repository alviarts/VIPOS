// Load `.env` with `override: true` so the file is the authoritative
// source of truth for every env var the API process reads, even if pm2
// (or another supervisor) cached stale values when first started. See
// `worker.js` for the long-form rationale and the 2026-05-06 P2-08 RCA.
require('dotenv').config({ override: true });
const { buildApp } = require('./app');
const { initDatabase } = require('./db/init');
const { logger } = require('./lib/logger');

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await initDatabase();
  } catch (err) {
    logger.fatal(
      { err: { message: err.message, stack: err.stack } },
      'Failed to initialize database'
    );
    process.exit(1);
  }
  const app = buildApp();
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'VIPOS Backend running');
  });
})();
