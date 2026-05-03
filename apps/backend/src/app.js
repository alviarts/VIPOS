const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./models/database');

/**
 * Build & return the configured Express app.
 * Caller is responsible for app.listen(...).
 *
 * @param {object} [opts]
 * @param {boolean} [opts.morganEnabled] default true
 * @returns {import('express').Express}
 */
function buildApp(opts = {}) {
  const { morganEnabled = true } = opts;

  initDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  if (morganEnabled) {
    app.use(morgan('dev'));
  }

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api', require('./routes/product-variants'));
  app.use('/api', require('./routes/product-recipe'));
  app.use('/api/uploads', require('./routes/uploads').router);
  // Serve uploaded files publicly (no auth — they're public URLs).
  app.use(
    '/uploads',
    require('express').static(require('node:path').join(__dirname, '..', 'uploads'), {
      maxAge: '7d',
    })
  );
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/departments', require('./routes/departments'));
  app.use('/api/customers', require('./routes/customers'));
  app.use('/api/customer-groups', require('./routes/customer-groups'));
  app.use('/api/customer-tags', require('./routes/customer-tags'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/finance', require('./routes/finance'));
  app.use('/api/inventory', require('./routes/inventory'));
  app.use('/api/stock-opname', require('./routes/stock-opname'));
  app.use('/api/quotation', require('./routes/quotation'));
  app.use('/api/sales-order', require('./routes/sales-order'));
  app.use('/api/delivery-order', require('./routes/delivery-order'));
  app.use('/api/invoice', require('./routes/invoice'));
  app.use('/api/receipt', require('./routes/receipt'));
  app.use('/api/aging-report', require('./routes/aging-report'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (process.env.DISABLE_API_DOCS !== '1') {
    try {
      const { mountApiDocs } = require('./api-docs');
      mountApiDocs(app);
    } catch (err) {
      console.warn('[api-docs] Failed to mount Swagger UI:', err.message);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../web/dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
    });
  }

  return app;
}

module.exports = { buildApp };
