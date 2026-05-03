const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./models/database');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize database
initDatabase();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/inventory', require('./routes/inventory'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API docs (Swagger UI) di-mount setelah route resource supaya prefix tidak
// bentrok. Disable di production via env DISABLE_API_DOCS=1 kalau perlu.
if (process.env.DISABLE_API_DOCS !== '1') {
  try {
    const { mountApiDocs } = require('./api-docs');
    mountApiDocs(app);
  } catch (err) {
    console.warn('[api-docs] Failed to mount Swagger UI:', err.message);
  }
}

// Serve frontend in production (fallback when nginx is not in front).
// In monorepo layout, web build output lives at apps/web/dist (relative to
// apps/backend/src/index.js -> ../../web/dist).
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../web/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`VIPOS Backend running on port ${PORT}`);
});
