require('dotenv').config();
const { buildApp } = require('./app');
const { initDatabase } = require('./db/init');

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
  const app = buildApp();
  app.listen(PORT, () => {
    console.log(`VIPOS Backend running on port ${PORT}`);
  });
})();
