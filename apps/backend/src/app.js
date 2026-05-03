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
  app.use('/api/promo', require('./routes/promo'));
  app.use('/api/coupon', require('./routes/coupon'));
  const {
    ruleRouter: loyaltyRuleRouter,
    ledgerRouter: loyaltyLedgerRouter,
  } = require('./routes/loyalty');
  app.use('/api/loyalty-rule', loyaltyRuleRouter);
  app.use('/api/loyalty', loyaltyLedgerRouter);
  app.use('/api/commission-group', require('./routes/commission-group'));
  app.use('/api/commission-assignment', require('./routes/commission-assignment'));
  app.use('/api/commission-report', require('./routes/commission-report'));
  app.use('/api/quotation', require('./routes/quotation'));
  app.use('/api/sales-order', require('./routes/sales-order'));
  app.use('/api/delivery-order', require('./routes/delivery-order'));
  app.use('/api/invoice', require('./routes/invoice'));
  app.use('/api/receipt', require('./routes/receipt'));
  app.use('/api/aging-report', require('./routes/aging-report'));

  // P1-14: Karyawan + Payroll + Absensi + Schedule + Approval.
  app.use('/api/employee', require('./routes/employee'));
  const {
    settingsRouter: payrollSettingsRouter,
    structureRouter: payrollStructureRouter,
    runRouter: payrollRunRouter,
  } = require('./routes/payroll');
  app.use('/api/payroll-settings', payrollSettingsRouter);
  app.use('/api/payroll-structure', payrollStructureRouter);
  app.use('/api/payroll-run', payrollRunRouter);
  const {
    logRouter: attendanceLogRouter,
    fenceRouter: attendanceFenceRouter,
  } = require('./routes/attendance');
  app.use('/api/attendance', attendanceLogRouter);
  app.use('/api/attendance-geofence', attendanceFenceRouter);
  const { shiftRouter, scheduleRouter, swapRouter } = require('./routes/schedule');
  app.use('/api/shift', shiftRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/schedule-swap', swapRouter);
  app.use('/api/approval-chain', require('./routes/approval-chain'));

  // P1-15: Keuangan (CoA, Journal, Cash Transfer, Income, Expense, Vendor,
  //                  Recurring Bill, Fixed Asset, Financial Report).
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
  app.use('/api/account', accountRouter);
  app.use('/api/journal', journalRouter);
  app.use('/api/cash-transfer', cashTransferRouter);
  app.use('/api/income', incomeRouter);
  app.use('/api/expense', expenseRouter);
  app.use('/api/recurring-bill', recurringBillRouter);
  app.use('/api/vendor', vendorRouter);
  app.use('/api/fixed-asset', fixedAssetRouter);
  app.use('/api/financial-report', reportRouter);

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
  app.use('/api/outlet', outletRouter);
  app.use('/api/terminal', terminalRouter);
  app.use('/api/setting', settingRouter);
  app.use('/api/notification-pref', notifRouter);
  app.use('/api/support-access', supportAccessRouter);
  app.use('/api/payment-method', paymentMethodRouter);
  app.use('/api/tax-rate', taxRateRouter);
  app.use('/api/uom', uomRouter);
  app.use('/api/account-profile', profileRouter);
  app.use('/api/import-export', importExportRouter);

  // P1-17 Reports (Laporan) — /api/reports/*.
  app.use('/api/reports', require('./routes/reports'));

  // P1-18 LAINNYA: Bantuan + LAYANAN + INSPIRASI + Capital + SUPPLIES.
  const {
    helpRouter,
    servicesRouter,
    inspirasiRouter,
    capitalRouter,
    suppliesRouter,
  } = require('./routes/lainnya');
  app.use('/api/help', helpRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/inspirasi', inspirasiRouter);
  app.use('/api/capital', capitalRouter);
  app.use('/api/supplies', suppliesRouter);

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
