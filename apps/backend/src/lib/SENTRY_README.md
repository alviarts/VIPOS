# Sentry Backend Monitoring - Quick Start

## Setup (One-time)

1. **Create Sentry Project**
   - Go to https://sentry.io/
   - Create project: `vipos-backend` (Node.js)

2. **Get DSN**
   - Copy DSN from project settings

3. **Configure Environment**

   ```bash
   # Add to .env
   SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456
   SENTRY_RELEASE=vipos-backend@1.0.0
   NODE_ENV=production
   ```

4. **Test**

   ```bash
   npm run dev
   curl http://localhost:3001/api/test-error
   ```

5. **Verify**
   - Check Sentry dashboard
   - Error should appear in 1-2 minutes

## Usage

### Capture Errors

```javascript
const { captureError } = require('./lib/sentry');

try {
  await riskyOperation();
} catch (error) {
  captureError(error, {
    context: 'payment-processing',
    tags: { method: 'qris' },
    extra: { amount: 150000 },
  });
}
```

### Set User Context

```javascript
const { setUser } = require('./lib/sentry');

setUser({
  id: user.id,
  username: user.username,
  tenant_id: user.tenant_id,
});
```

### Add Breadcrumbs

```javascript
const { addBreadcrumb } = require('./lib/sentry');

addBreadcrumb({
  message: 'User initiated checkout',
  category: 'action',
  data: { cart_items: 5 },
});
```

## Already Integrated

✅ Express middleware (automatic)
✅ Error handler (5xx errors)
✅ Performance monitoring
✅ PII filtering

## Next Steps

1. ✅ Setup Sentry project
2. ✅ Configure SENTRY_DSN
3. ⏳ Add error capture to routes
4. ⏳ Setup alerts

See `docs/SENTRY_MONITORING.md` for complete guide.
