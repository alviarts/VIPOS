// P2-05 PR-A: Sentry MUST be initialised before requiring `express` so its
// auto-instrumentation can patch the prototype. `initSentry()` is a no-op
// when SENTRY_DSN is unset (tests, local dev).
const {
  initSentry,
  attachSentryUserMiddleware,
  attachSentryErrorHandler,
} = require('./lib/sentry');
initSentry();

// P2-05 PR-B: OpenTelemetry init also runs before `require('express')`
// so the auto-instrumentations can patch the framework prototype. The
// call is a no-op when no OTLP exporter is configured.
const { initOtel, currentTraceId } = require('./lib/otel');
initOtel();

const express = require('express');
const pinoHttp = require('pino-http');
const path = require('path');
const { legacyDeprecationMiddleware } = require('./api-version');
const { authenticateToken } = require('./middleware/auth');
const { requireTier } = require('./middleware/tier');
const { requestIdMiddleware } = require('./middleware/request-id');
const { globalErrorHandler } = require('./middleware/error-handler');
const { metricsMiddleware } = require('./middleware/metrics');
const { configureTrustProxy, helmetMiddleware, corsMiddleware } = require('./lib/security');
const { apiRateLimit } = require('./lib/rate-limit');
const { logger } = require('./lib/logger');
const { router: healthRouter } = require('./routes/health');
const { router: healthBackupRouter } = require('./routes/health-backup');
const { router: healthDiskRouter } = require('./routes/health-disk');
const { router: metricsRouter } = require('./routes/metrics');

/**
 * Mount every API resource onto the supplied router/app. The function is
 * called twice from `buildApp` — once with a `/api/v1` parent (canonical)
 * and once with a `/api` parent (legacy alias with deprecation headers).
 *
 * Keeping route registration in one place guarantees the v1 surface and the
 * legacy alias stay byte-identical.
 *
 * @param {import('express').Router | import('express').Express} parent
 */
function mountVersionedRoutes(parent) {
  parent.use('/auth', require('./routes/auth'));
  parent.use('/tenant', require('./routes/tenant').router);
  parent.use('/products', require('./routes/products'));
  // product-variants/product-recipe declare their own `/products/:id/...`
  // sub-paths, so they mount at the resource root.
  parent.use('/', require('./routes/product-variants'));
  parent.use('/', require('./routes/product-recipe'));
  parent.use('/uploads', require('./routes/uploads').router);
  parent.use('/categories', require('./routes/categories'));
  parent.use('/departments', require('./routes/departments'));
  parent.use('/customers', require('./routes/customers'));
  parent.use('/customer-groups', require('./routes/customer-groups'));
  parent.use('/customer-tags', require('./routes/customer-tags'));
  parent.use('/transactions', require('./routes/transactions'));
  // P3-08 stub for QRIS Dynamic mint + status poll. Per
  // `docs/v2/14_PAYMENT_METHODS.md` §6, the Android cashier flow needs
  // these endpoints to seed `QrisDynamicInput.refId` and poll until
  // PAID. The implementation in `routes/payment-qris.js` is an
  // in-memory stub — sufficient to unblock slice 5 integration; real
  // gateway plug-in is a Tier-2 founder decision.
  parent.use('/payment/qris', require('./routes/payment-qris'));
  parent.use('/dashboard', require('./routes/dashboard'));
  parent.use('/finance', require('./routes/finance'));
  parent.use('/inventory', require('./routes/inventory'));
  parent.use('/stock-opname', require('./routes/stock-opname'));
  parent.use('/promo', require('./routes/promo'));
  parent.use('/coupon', require('./routes/coupon'));
  const {
    ruleRouter: loyaltyRuleRouter,
    ledgerRouter: loyaltyLedgerRouter,
  } = require('./routes/loyalty');
  // P2-02 tier gating — Advance+ features per docs/v2/06_FEATURE_TIERS.md.
  // We attach `authenticateToken` first so `requireTier` has `req.tenantId`
  // available; downstream routes can still call `authenticateToken` again
  // (Express middlewares are idempotent for our purposes here).
  const advanceGate = [authenticateToken, requireTier('advance')];
  parent.use('/loyalty-rule', advanceGate, loyaltyRuleRouter);
  parent.use('/loyalty', advanceGate, loyaltyLedgerRouter);
  parent.use('/commission-group', advanceGate, require('./routes/commission-group'));
  parent.use('/commission-assignment', advanceGate, require('./routes/commission-assignment'));
  parent.use('/commission-report', advanceGate, require('./routes/commission-report'));
  parent.use('/quotation', advanceGate, require('./routes/quotation'));
  parent.use('/sales-order', advanceGate, require('./routes/sales-order'));
  parent.use('/delivery-order', advanceGate, require('./routes/delivery-order'));
  parent.use('/invoice', advanceGate, require('./routes/invoice'));
  parent.use('/receipt', advanceGate, require('./routes/receipt'));
  parent.use('/aging-report', advanceGate, require('./routes/aging-report'));
  parent.use('/audit-log', advanceGate, require('./routes/audit-log'));

  // P1-13 Appointment.
  parent.use('/staff', require('./routes/staff'));
  parent.use('/appointment-resource', require('./routes/appointment-resource'));
  parent.use('/appointment', require('./routes/appointment'));
  parent.use('/calendar', require('./routes/calendar'));

  // P1-12 Order Online.
  parent.use('/online-order', require('./routes/order-online'));
  // P2-02: marketplace integration is Advance+.
  parent.use('/marketplace', advanceGate, require('./routes/marketplace'));
  // P2-04 PR-B: marketplace webhook ingress is intentionally public (no
  // JWT) so upstream providers can POST without per-tenant credentials —
  // tenant scope comes from the URL slug + (optional) HMAC signature.
  // Mounted *outside* `advanceGate` deliberately.
  parent.use('/marketplace-webhook', require('./routes/marketplace-webhook'));
  parent.use('/storefront-settings', require('./routes/storefront-settings'));
  parent.use('/consumer-app-config', require('./routes/consumer-app-config'));

  // P1-11 Marketing — P2-02: marketing campaigns are Advance+.
  parent.use('/marketing', advanceGate, require('./routes/marketing'));

  // P1-14 Karyawan + Payroll + Absensi + Schedule + Approval.
  parent.use('/employee', require('./routes/employee'));
  const {
    settingsRouter: payrollSettingsRouter,
    structureRouter: payrollStructureRouter,
    runRouter: payrollRunRouter,
  } = require('./routes/payroll');
  parent.use('/payroll-settings', payrollSettingsRouter);
  parent.use('/payroll-structure', payrollStructureRouter);
  parent.use('/payroll-run', payrollRunRouter);
  const {
    logRouter: attendanceLogRouter,
    fenceRouter: attendanceFenceRouter,
  } = require('./routes/attendance');
  parent.use('/attendance', attendanceLogRouter);
  parent.use('/attendance-geofence', attendanceFenceRouter);
  const { shiftRouter, scheduleRouter, swapRouter } = require('./routes/schedule');
  parent.use('/shift', shiftRouter);
  parent.use('/schedule', scheduleRouter);
  parent.use('/schedule-swap', swapRouter);
  parent.use('/approval-chain', require('./routes/approval-chain'));

  // P3-14 Cashier shift management.
  parent.use('/cashier-shift', require('./routes/cashier-shift'));

  // Note: Transaction void/refund already handled by the existing
  // /transactions route. The transaction-actions.js file adds
  // receipt reprint which is mounted separately.
  parent.use('/transactions', require('./routes/transaction-actions'));

  // Production readiness probe.
  parent.use('/health', require('./routes/health-ready'));

  // Stock alerts for low-stock monitoring.
  parent.use('/stock-alerts', require('./routes/stock-alerts'));

  // Daily sales summary report.
  parent.use('/reports', require('./routes/reports-daily'));

  // QRIS gateway webhook receiver.
  parent.use('/webhook', require('./routes/webhook-qris'));

  // Data export (CSV/JSON).
  parent.use('/export', require('./routes/export-data'));

  // Tenant onboarding / self-service signup (P6-02).
  parent.use('/onboarding', require('./routes/onboarding'));

  // Tenant configuration (key-value settings).
  parent.use('/config', require('./routes/tenant-config'));

  // Product search suggestions (typeahead).
  parent.use('/products', require('./routes/product-search'));

  // Note: Customer + product bulk import endpoints are already
  // available via the existing /customers and /products routes.
  // The dedicated import-customers.js and import-products.js files
  // provide alternative implementations but are not mounted to
  // avoid route conflicts with the existing CRUD handlers.

  // Dashboard summary for owner KPI (P4-07) — mounted at
  // /dashboard-kpi to avoid conflict with existing /dashboard routes.
  parent.use('/dashboard-kpi', require('./routes/dashboard-summary'));

  // Analytics event ingestion.
  parent.use('/analytics', require('./routes/analytics-events'));

  // P3-16 Loyalty point redemption.
  parent.use('/loyalty', require('./routes/loyalty-redeem'));

  // P4-01 Online order kasir actions (accept/reject/ready).
  parent.use('/online-orders', require('./routes/online-order-actions'));

  // P1-15 Keuangan.
  const {
    accountRouter,
    journalRouter,
    cashTransferRouter,
    incomeRouter,
    expenseRouter,
    recurringBillRouter,
    vendorRouter,
    fixedAssetRouter,
    reportRouter,
  } = require('./routes/keuangan');
  parent.use('/account', accountRouter);
  parent.use('/journal', journalRouter);
  parent.use('/cash-transfer', cashTransferRouter);
  parent.use('/income', incomeRouter);
  parent.use('/expense', expenseRouter);
  parent.use('/recurring-bill', recurringBillRouter);
  parent.use('/vendor', vendorRouter);
  parent.use('/fixed-asset', fixedAssetRouter);
  parent.use('/financial-report', reportRouter);

  // P1-16 Pengaturan / Settings.
  const {
    outletRouter,
    terminalRouter,
    settingRouter,
    notifRouter,
    supportAccessRouter,
    paymentMethodRouter,
    taxRateRouter,
    uomRouter,
    profileRouter,
    importExportRouter,
  } = require('./routes/pengaturan');
  parent.use('/outlet', outletRouter);
  parent.use('/terminal', terminalRouter);
  parent.use('/setting', settingRouter);
  parent.use('/notification-pref', notifRouter);
  parent.use('/support-access', supportAccessRouter);
  parent.use('/payment-method', paymentMethodRouter);
  parent.use('/tax-rate', taxRateRouter);
  parent.use('/uom', uomRouter);
  parent.use('/account-profile', profileRouter);
  parent.use('/import-export', importExportRouter);

  // P1-17 Reports.
  parent.use('/reports', require('./routes/reports'));

  // P2-04 PR-B: notification + email producer ingress (admin-only).
  // The actual delivery happens in worker processes — see
  // `apps/backend/src/jobs/notification.js` and `jobs/email.js`.
  parent.use('/notifications', require('./routes/notifications'));
  parent.use('/email', require('./routes/email'));

  // P1-18 LAINNYA.
  const {
    helpRouter,
    servicesRouter,
    inspirasiRouter,
    capitalRouter,
    suppliesRouter,
  } = require('./routes/lainnya');
  parent.use('/help', helpRouter);
  parent.use('/services', servicesRouter);
  parent.use('/inspirasi', inspirasiRouter);
  parent.use('/capital', capitalRouter);
  parent.use('/supplies', suppliesRouter);

  // Deploy provenance probe — returns the git sha + build timestamp
  // baked into the running pm2 process. Used by deploy-vps.yml's smoke
  // step to assert pm2 actually picked up the latest code (defence in
  // depth from loop #6 — see
  // `docs/handoff/2026-05-07-tier1-loop-6-deploy-rca-errata.md`).
  // Public, no auth, no DB.
  parent.use('/version', require('./routes/version'));

  // P2-05 PR-A: extended health probe (DB + Redis with latency).
  // Exposed under each version namespace plus the legacy alias so
  // external monitors keep working without modification.
  parent.use('/health', healthRouter);
  // Backup-freshness probe (separate path so monitors can poll it
  // independently and treat a stale-backup alert distinctly from
  // the application-up alert).
  parent.use('/health/backup', healthBackupRouter);
  // Disk-usage probe on the BACKUP_DIR mount. Pairs with /health/backup:
  // that one catches "the job stopped firing", this one catches "the
  // disk filled up so the next job will fail".
  parent.use('/health/disk', healthDiskRouter);
}

/**
 * Build & return the configured Express app.
 * Caller is responsible for app.listen(...).
 *
 * @param {object} [opts]
 * @param {boolean} [opts.morganEnabled] kept for backwards compat — when
 *   false, suppresses pino-http request logging too. Production paths
 *   should leave this true so structured request logs are emitted.
 * @returns {import('express').Express}
 */
function buildApp(opts = {}) {
  const {
    morganEnabled = true,
    // P2-06: tests fire dozens of requests against `/api/v1/*` per
    // file and would otherwise blow through the 100/min budget. Tests
    // that specifically exercise the limiter pass `rateLimitEnabled:
    // true` explicitly.
    rateLimitEnabled = process.env.NODE_ENV !== 'test',
  } = opts;

  const app = express();

  // P2-06: trust the upstream proxy chain so `req.ip` reflects the
  // real client IP (X-Forwarded-For). Required for per-IP rate
  // limiting to behave correctly behind nginx / Cloudflare.
  configureTrustProxy(app);

  // P2-06: Helmet first — cheap, sets the default response header
  // baseline for every downstream handler. CSP is auto-disabled
  // outside production to keep Vite HMR working.
  app.use(helmetMiddleware());

  // P2-05 PR-A: request id MUST run before any logging middleware so
  // pino-http picks up `req.id` automatically via genReqId.
  app.use(requestIdMiddleware);

  if (morganEnabled) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.id,
        // P2-05 PR-B: stamp the active OTel trace id onto every log
        // line so Sentry → log → trace correlation is one click in
        // dashboards. The mixin is a no-op when OTel is disabled
        // (currentTraceId returns undefined and pino drops the key).
        mixin() {
          const traceId = currentTraceId();
          return traceId ? { trace_id: traceId } : {};
        },
        // Silence noisy default request/response binding; keep just the
        // useful fields. Pino-http's default already covers method/url/
        // status; this keeps the JSON payload small.
        customLogLevel: function customLogLevel(_req, res, err) {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              tenant_id: req.raw?.tenantId,
              user_id: req.raw?.user?.user_id ?? req.raw?.user?.id,
            };
          },
          res(res) {
            return { status: res.statusCode };
          },
        },
      })
    );
  }

  // P2-05 PR-B: Prometheus RED metrics. Mounted before routes so
  // `res.on('finish')` sees every request — including 404s served by
  // the route fallthrough.
  app.use(metricsMiddleware());

  // P2-06: strict CORS allowlist (env-driven, fail-closed in prod).
  app.use(corsMiddleware());
  app.use(express.json());

  // P2-06: global API rate limiter. Skips /metrics and every /health
  // variant (handled inside the limiter). Disabled by passing
  // `rateLimitEnabled: false` from tests that need to fire many
  // requests without tripping the limit.
  if (rateLimitEnabled) {
    app.use(apiRateLimit());
  }

  // P2-05 PR-A: attach req.user / req.tenantId to Sentry scope after
  // auth runs. authenticateToken sets these per-request inside route
  // handlers, but mounting this here is a no-op without Sentry init.
  app.use(attachSentryUserMiddleware());

  // Serve uploaded files publicly (no auth — they're public URLs). This is
  // intentionally outside the API surface.
  app.use(
    '/uploads',
    express.static(path.join(__dirname, '..', 'uploads'), {
      maxAge: '7d',
    })
  );

  // P2-05 PR-B: Prometheus scrape endpoint. Mounted at the root,
  // outside the /api/v1 versioning umbrella, per the convention
  // documented at https://prometheus.io/docs/instrumenting/writing_exporters/.
  app.use('/metrics', metricsRouter);

  // Canonical API surface: /api/v1/*.
  const v1Router = express.Router();
  mountVersionedRoutes(v1Router);
  app.use('/api/v1', v1Router);

  // Cross-tenant admin surface (super_admin only — never exposed via
  // legacy `/api` alias on purpose).
  app.use('/api/admin/tenant', require('./routes/tenant').adminRouter);

  // P2-04 PR-B Bull Board (admin-only). Mounted at /api/admin/queues
  // alongside the tenant admin surface — never exposed via the legacy
  // /api alias. Returns 503 when REDIS_URL is unset.
  const { mountBullBoard } = require('./lib/bull-board');
  mountBullBoard(app);

  // Legacy alias: /api/* delegates to the same handlers but adds Deprecation
  // / Sunset / Link response headers per RFC 8594. Will be removed once the
  // sunset date passes (see api-version.js).
  const legacyRouter = express.Router();
  legacyRouter.use(legacyDeprecationMiddleware({ successorPrefix: '/api/v1' }));
  mountVersionedRoutes(legacyRouter);
  app.use('/api', legacyRouter);

  if (process.env.DISABLE_API_DOCS !== '1') {
    try {
      const { mountApiDocs } = require('./api-docs');
      mountApiDocs(app);
    } catch (err) {
      logger.warn({ component: 'api-docs', err: err.message }, 'Failed to mount Swagger UI');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../web/dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
    });
  }

  // P2-05 PR-A: Sentry's Express error handler must run *before* any
  // user-defined error middleware. No-op when Sentry is not enabled.
  attachSentryErrorHandler(app);
  // Global structured error handler — last in the stack.
  app.use(globalErrorHandler());

  return app;
}

module.exports = { buildApp, mountVersionedRoutes };
