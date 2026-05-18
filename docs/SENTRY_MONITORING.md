# Sentry Backend Monitoring Setup Guide

## Overview

Sentry provides real-time error tracking and performance monitoring for VIPOS backend API.

## Features Implemented

✅ **Error Tracking**

- Automatic error capture
- Stack traces with source maps
- Error grouping and deduplication
- Release tracking

✅ **Performance Monitoring**

- Transaction tracing
- Database query monitoring
- HTTP request tracking
- Custom spans

✅ **User Context**

- User ID tracking
- Tenant and outlet context
- Custom tags and metadata

✅ **Breadcrumbs**

- Request logs
- Database queries
- Custom events

✅ **Security**

- Automatic PII scrubbing
- Sensitive data filtering
- Authorization header removal

---

## Setup Instructions

### 1. Create Sentry Project

1. Go to [Sentry.io](https://sentry.io/)
2. Create account or sign in
3. Create new project:
   - Platform: **Node.js**
   - Project name: `vipos-backend`
   - Team: Your team

### 2. Get DSN

1. In Sentry project settings
2. Go to **Client Keys (DSN)**
3. Copy the DSN URL

### 3. Configure Environment Variables

Add to `.env`:

```bash
# Sentry Error Monitoring
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456
SENTRY_RELEASE=vipos-backend@1.0.0
NODE_ENV=production
```

**Environments:**

- `development` - 100% sampling, all errors
- `staging` - 100% sampling, all errors
- `production` - 10% sampling, 5xx errors only

### 4. Test Integration

```bash
cd apps/backend

# Start server
npm run dev

# Trigger test error (in another terminal)
curl http://localhost:3001/api/test-error

# Check Sentry dashboard
# Error should appear within 1-2 minutes
```

### 5. Verify in Sentry Dashboard

1. Go to Sentry dashboard
2. Check **Issues** tab
3. You should see the test error

---

## Usage Examples

### Basic Error Capture

```javascript
const { captureError } = require('./lib/sentry');

try {
  await riskyOperation();
} catch (error) {
  captureError(error, {
    context: 'payment-processing',
    tags: { payment_method: 'qris' },
    extra: { transaction_id: txId },
  });
  throw error;
}
```

### Set User Context (After Login)

```javascript
const { setUser } = require('./lib/sentry');

// In auth middleware or login route
setUser({
  id: user.id,
  username: user.username,
  email: user.email,
  tenant_id: user.tenant_id,
  outlet_id: user.outlet_id,
});
```

### Clear User Context (On Logout)

```javascript
const { clearUser } = require('./lib/sentry');

// In logout route
clearUser();
```

### Add Breadcrumbs

```javascript
const { addBreadcrumb } = require('./lib/sentry');

addBreadcrumb({
  message: 'User initiated checkout',
  category: 'action',
  level: 'info',
  data: { cart_items: 5, total: 150000 },
});
```

### Custom Tags

```javascript
const { setTag, setTags } = require('./lib/sentry');

// Single tag
setTag('payment_method', 'qris');

// Multiple tags
setTags({
  tenant_id: '123',
  outlet_id: '456',
  environment: 'production',
});
```

### Capture Message

```javascript
const { captureMessage } = require('./lib/sentry');

captureMessage('Low stock alert', 'warning', {
  tags: { product_id: '789' },
  extra: { stock_level: 5, min_stock: 10 },
});
```

### Performance Monitoring

```javascript
const { startTransaction } = require('./lib/sentry');

const transaction = startTransaction('process-payment', 'payment');

try {
  // Your code here
  const result = await processPayment();

  transaction.setStatus('ok');
  return result;
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

### Wrap Async Functions

```javascript
const { wrapAsync } = require('./lib/sentry');

const syncInventory = wrapAsync(
  async () => {
    // Your code here
    await inventoryService.sync();
  },
  { context: 'inventory-sync' }
);

// Errors are automatically captured
await syncInventory();
```

---

## Integration Points

### 1. Application Startup (app.js)

Already integrated:

```javascript
const { initializeSentry } = require('./lib/sentry');
initializeSentry(); // Must be first, before require('express')
```

### 2. Express Middleware (app.js)

Already integrated:

```javascript
const {
  requestHandler,
  tracingHandler,
  errorHandler,
} = require('./lib/sentry');

app.use(requestHandler); // First middleware
app.use(tracingHandler); // Second middleware

// ... your routes ...

app.use(errorHandler); // Last middleware (after all routes)
```

### 3. Route Handlers

```javascript
// routes/payment.js
const { captureError, addBreadcrumb } = require('../lib/sentry');

router.post('/process', async (req, res) => {
  try {
    addBreadcrumb({
      message: 'Processing payment',
      category: 'payment',
      data: { amount: req.body.amount },
    });

    const result = await paymentService.process(req.body);
    res.json(result);
  } catch (error) {
    captureError(error, {
      context: 'payment-processing',
      tags: { method: req.body.method },
      extra: { amount: req.body.amount },
    });
    res.status(500).json({ error: 'Payment failed' });
  }
});
```

### 4. Database Operations

```javascript
// repositories/product.js
const { captureError } = require('../lib/sentry');

async function updateStock(productId, quantity) {
  try {
    return await db.product.update({
      where: { id: productId },
      data: { stock: quantity },
    });
  } catch (error) {
    captureError(error, {
      context: 'database-update',
      tags: { operation: 'update-stock' },
      extra: { product_id: productId, quantity },
    });
    throw error;
  }
}
```

### 5. Background Jobs

```javascript
// jobs/sync-inventory.js
const { captureError, addBreadcrumb } = require('../lib/sentry');

async function syncInventory() {
  addBreadcrumb({
    message: 'Starting inventory sync',
    category: 'job',
  });

  try {
    const result = await inventoryService.sync();
    addBreadcrumb({
      message: 'Inventory sync completed',
      category: 'job',
      data: { synced_items: result.count },
    });
  } catch (error) {
    captureError(error, { context: 'inventory-sync-job' });
    throw error;
  }
}
```

### 6. Graceful Shutdown

```javascript
// index.js
const { flush, close } = require('./lib/sentry');

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Flush pending Sentry events
  await flush(2000);
  await close(2000);

  process.exit(0);
});
```

---

## Best Practices

### ✅ DO

- ✅ Capture all unhandled errors
- ✅ Set user context after authentication
- ✅ Clear user context on logout
- ✅ Add breadcrumbs for important actions
- ✅ Use tags for error grouping
- ✅ Include relevant context (IDs, amounts, etc.)
- ✅ Test in staging before production
- ✅ Monitor error rates and trends

### ❌ DON'T

- ❌ Log sensitive data (passwords, tokens, credit cards)
- ❌ Log PII without user consent
- ❌ Capture 4xx client errors (use sparingly)
- ❌ Spam breadcrumbs (keep it meaningful)
- ❌ Ignore error patterns
- ❌ Forget to flush on shutdown

---

## Monitoring & Alerts

### Sentry Dashboard

1. **Issues**
   - View all errors
   - Group by error type
   - See affected users
   - Track error trends

2. **Performance**
   - Transaction traces
   - Slow queries
   - HTTP request latency
   - Database performance

3. **Releases**
   - Track errors by version
   - Compare release health
   - Identify regressions

### Setup Alerts

1. Go to **Alerts** → **Create Alert**
2. Configure:
   - **Issue Alert**: New error or spike
   - **Metric Alert**: Error rate > threshold
   - **Notification**: Email, Slack, PagerDuty

**Recommended Alerts:**

- New issue in production
- Error rate > 1% (5 minutes)
- Slow transaction > 1s (P95)
- Failed transaction rate > 5%

---

## Troubleshooting

### Errors Not Appearing

**Check DSN is set:**

```bash
echo $SENTRY_DSN
```

**Check initialization:**

```javascript
// Should see log on startup
[Sentry] Initialized (env=production, release=vipos-backend@1.0.0)
```

**Force send test error:**

```javascript
const { captureMessage } = require('./lib/sentry');
captureMessage('Test error', 'error');
```

**Check network:**

```bash
curl -I https://sentry.io
```

### Sensitive Data Leaking

**Check beforeSend hook** - Already configured to remove:

- Authorization headers
- Cookies
- Password fields
- Token fields
- API keys

**Add custom filtering:**

```javascript
// In lib/sentry.js beforeSend hook
if (event.extra && event.extra.credit_card) {
  event.extra.credit_card = '[REDACTED]';
}
```

### Performance Impact

Sentry has **minimal performance impact**:

- **Memory:** +10-20MB
- **CPU:** < 1%
- **Network:** Batched, async
- **Latency:** < 1ms per request

**Sampling rates:**

- Production: 10% (configurable)
- Staging: 100%
- Development: 100%

---

## Security & Privacy

### Data Collected

- Error stack traces
- Request URL and method
- User ID (you set this)
- Custom tags and context
- Breadcrumbs (you log these)

### Data NOT Collected

- Request body (unless you add it)
- Response body
- Authorization headers (filtered)
- Passwords (filtered)
- Credit card numbers (filtered)

### GDPR Compliance

- ✅ User can opt-out (don't set user context)
- ✅ Data retention: 90 days (configurable)
- ✅ Data deletion: Contact Sentry support
- ✅ Data export: Available in dashboard

---

## Integration with Other Tools

### Slack Notifications

1. Go to **Settings** → **Integrations**
2. Add **Slack**
3. Configure channels for alerts

### PagerDuty

1. Go to **Settings** → **Integrations**
2. Add **PagerDuty**
3. Configure escalation policies

### GitHub Issues

1. Go to **Settings** → **Integrations**
2. Add **GitHub**
3. Auto-create issues for new errors

---

## Cost Optimization

### Free Tier

- 5,000 errors/month
- 10,000 transactions/month
- 90-day retention

### Reduce Costs

1. **Sampling:**

   ```javascript
   tracesSampleRate: 0.1, // 10% of transactions
   ```

2. **Ignore errors:**

   ```javascript
   ignoreErrors: ['ValidationError', 'NotFoundError'],
   ```

3. **Filter before send:**
   ```javascript
   beforeSend(event) {
     if (event.request.url.includes('/health')) {
       return null; // Don't send
     }
     return event;
   }
   ```

---

## Next Steps

1. ✅ Setup Sentry project
2. ✅ Configure SENTRY_DSN
3. ✅ Test integration
4. ⏳ Add error capture to all routes
5. ⏳ Setup alerts
6. ⏳ Monitor error rates
7. ⏳ Fix top errors

---

## Support

- **Sentry Docs:** https://docs.sentry.io/platforms/node/
- **Express Guide:** https://docs.sentry.io/platforms/node/guides/express/
- **Best Practices:** https://docs.sentry.io/platforms/node/best-practices/

---

**Last Updated:** May 12, 2026  
**Version:** 1.0.0  
**Status:** Ready for Production ✅
