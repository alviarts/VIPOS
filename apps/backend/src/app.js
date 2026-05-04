const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { legacyDeprecationMiddleware } = require('./api-version');

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
  parent.use('/loyalty-rule', loyaltyRuleRouter);
  parent.use('/loyalty', loyaltyLedgerRouter);
  parent.use('/commission-group', require('./routes/commission-group'));
  parent.use('/commission-assignment', require('./routes/commission-assignment'));
  parent.use('/commission-report', require('./routes/commission-report'));
  parent.use('/quotation', require('./routes/quotation'));
  parent.use('/sales-order', require('./routes/sales-order'));
  parent.use('/delivery-order', require('./routes/delivery-order'));
  parent.use('/invoice', require('./routes/invoice'));
  parent.use('/receipt', require('./routes/receipt'));
  parent.use('/aging-report', require('./routes/aging-report'));

  // P1-13 Appointment.
  parent.use('/staff', require('./routes/staff'));
  parent.use('/appointment-resource', require('./routes/appointment-resource'));
  parent.use('/appointment', require('./routes/appointment'));
  parent.use('/calendar', require('./routes/calendar'));

  // P1-12 Order Online.
  parent.use('/online-order', require('./routes/order-online'));
  parent.use('/marketplace', require('./routes/marketplace'));
  parent.use('/storefront-settings', require('./routes/storefront-settings'));
  parent.use('/consumer-app-config', require('./routes/consumer-app-config'));

  // P1-11 Marketing.
  parent.use('/marketing', require('./routes/marketing'));

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

  // Health probe is exposed under each version namespace plus the legacy
  // alias so external monitors keep working without modification.
  parent.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

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

  const app = express();
  app.use(cors());
  app.use(express.json());
  if (morganEnabled) {
    app.use(morgan('dev'));
  }

  // Serve uploaded files publicly (no auth — they're public URLs). This is
  // intentionally outside the API surface.
  app.use(
    '/uploads',
    express.static(path.join(__dirname, '..', 'uploads'), {
      maxAge: '7d',
    })
  );

  // Canonical API surface: /api/v1/*.
  const v1Router = express.Router();
  mountVersionedRoutes(v1Router);
  app.use('/api/v1', v1Router);

  // Cross-tenant admin surface (super_admin only — never exposed via
  // legacy `/api` alias on purpose).
  app.use('/api/admin/tenant', require('./routes/tenant').adminRouter);

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

module.exports = { buildApp, mountVersionedRoutes };
