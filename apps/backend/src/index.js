require('dotenv').config();
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
