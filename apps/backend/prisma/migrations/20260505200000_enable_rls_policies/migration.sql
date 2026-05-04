-- P2-02 multi-tenant RLS policies + auto-default tenant_id from session GUC.
--
-- For every business-data table that has a tenant_id column, this migration:
--   1. Sets the column DEFAULT to current_setting('app.current_tenant', true)::int
--      so any INSERT that omits tenant_id picks up the current request scope.
--   2. Enables ROW LEVEL SECURITY.
--   3. Creates a single policy `tenant_isolation` that allows access when:
--        - app.current_tenant = '0'  (system bypass for seeders, login lookup,
--          public /tenant/register, etc.)
--      OR
--        - tenant_id = current_setting('app.current_tenant', true)::int
--          (regular tenant scope set by authenticateToken).
--
-- The connection driver wraps every query() / tx() in BEGIN / SET LOCAL ... /
-- COMMIT, so the GUC is per-transaction and safe for PgBouncer transaction-mode.

-- Also enable RLS on tenants + tenant_users so cross-tenant reads are blocked.
-- The system bypass branch keeps super_admin / signup / init.js code paths working.

ALTER TABLE "app_settings" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_app_settings" ON "app_settings"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "appointment_resources" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "appointment_resources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_appointment_resources" ON "appointment_resources"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "appointment_services" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "appointment_services" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_appointment_services" ON "appointment_services"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "appointments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_appointments" ON "appointments"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "approval_chains" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "approval_chains" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_approval_chains" ON "approval_chains"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "attendance_geofences" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "attendance_geofences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_attendance_geofences" ON "attendance_geofences"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "attendance_logs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "attendance_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_attendance_logs" ON "attendance_logs"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_delivery_order_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_delivery_order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_delivery_order_items" ON "b2b_delivery_order_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_delivery_orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_delivery_orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_delivery_orders" ON "b2b_delivery_orders"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_invoice_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_invoice_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_invoice_items" ON "b2b_invoice_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_invoices" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_invoices" ON "b2b_invoices"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_quotation_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_quotation_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_quotation_items" ON "b2b_quotation_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_quotations" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_quotations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_quotations" ON "b2b_quotations"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_receipts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_receipts" ON "b2b_receipts"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_sales_order_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_sales_order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_sales_order_items" ON "b2b_sales_order_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "b2b_sales_orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "b2b_sales_orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_b2b_sales_orders" ON "b2b_sales_orders"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "capital_applications" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "capital_applications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_capital_applications" ON "capital_applications"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "cash_accounts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "cash_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_cash_accounts" ON "cash_accounts"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "cash_transactions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "cash_transactions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_cash_transactions" ON "cash_transactions"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "categories" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_categories" ON "categories"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "commission_assignments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "commission_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_commission_assignments" ON "commission_assignments"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "commission_groups" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "commission_groups" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_commission_groups" ON "commission_groups"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "consumer_app_config" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "consumer_app_config" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_consumer_app_config" ON "consumer_app_config"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "coupon_redemptions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "coupon_redemptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_coupon_redemptions" ON "coupon_redemptions"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "coupons" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_coupons" ON "coupons"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "customer_groups" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "customer_groups" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customer_groups" ON "customer_groups"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "customer_tag_map" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "customer_tag_map" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customer_tag_map" ON "customer_tag_map"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "customer_tags" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "customer_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customer_tags" ON "customer_tags"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "customers" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_customers" ON "customers"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "departments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_departments" ON "departments"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "employee_documents" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "employee_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_employee_documents" ON "employee_documents"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "employees" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_employees" ON "employees"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_accounts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_accounts" ON "gl_accounts"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_expenses" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_expenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_expenses" ON "gl_expenses"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_fixed_asset_depreciations" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_fixed_asset_depreciations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_fixed_asset_depreciations" ON "gl_fixed_asset_depreciations"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_fixed_asset_disposals" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_fixed_asset_disposals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_fixed_asset_disposals" ON "gl_fixed_asset_disposals"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_fixed_assets" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_fixed_assets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_fixed_assets" ON "gl_fixed_assets"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_incomes" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_incomes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_incomes" ON "gl_incomes"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_journal_lines" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_journal_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_journal_lines" ON "gl_journal_lines"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_journals" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_journals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_journals" ON "gl_journals"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_recurring_bills" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_recurring_bills" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_recurring_bills" ON "gl_recurring_bills"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "gl_vendors" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "gl_vendors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gl_vendors" ON "gl_vendors"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "help_feedback" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "help_feedback" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_help_feedback" ON "help_feedback"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "help_topics" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "help_topics" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_help_topics" ON "help_topics"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "informasi_updates" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "informasi_updates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_informasi_updates" ON "informasi_updates"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "inspirasi_articles" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "inspirasi_articles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_inspirasi_articles" ON "inspirasi_articles"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "inspirasi_event_rsvps" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "inspirasi_event_rsvps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_inspirasi_event_rsvps" ON "inspirasi_event_rsvps"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "inspirasi_events" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "inspirasi_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_inspirasi_events" ON "inspirasi_events"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "inspirasi_magazines" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "inspirasi_magazines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_inspirasi_magazines" ON "inspirasi_magazines"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "inventory_movements" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_inventory_movements" ON "inventory_movements"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "loyalty_rules" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "loyalty_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_loyalty_rules" ON "loyalty_rules"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "loyalty_transactions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "loyalty_transactions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_loyalty_transactions" ON "loyalty_transactions"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "marketing_campaign_recipients" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "marketing_campaign_recipients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_marketing_campaign_recipients" ON "marketing_campaign_recipients"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "marketing_campaigns" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "marketing_campaigns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_marketing_campaigns" ON "marketing_campaigns"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "marketing_credit_ledger" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "marketing_credit_ledger" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_marketing_credit_ledger" ON "marketing_credit_ledger"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "marketing_templates" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "marketing_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_marketing_templates" ON "marketing_templates"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "marketplace_connections" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "marketplace_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_marketplace_connections" ON "marketplace_connections"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "marketplace_product_overrides" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "marketplace_product_overrides" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_marketplace_product_overrides" ON "marketplace_product_overrides"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "notification_prefs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "notification_prefs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_notification_prefs" ON "notification_prefs"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "online_order_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "online_order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_online_order_items" ON "online_order_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "online_orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "online_orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_online_orders" ON "online_orders"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "outlet_floor_plans" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "outlet_floor_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_outlet_floor_plans" ON "outlet_floor_plans"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "outlets" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "outlets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_outlets" ON "outlets"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

-- skip password_reset_tokens (no tenant_id column)
ALTER TABLE "payment_methods" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payment_methods" ON "payment_methods"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "payroll_runs" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payroll_runs" ON "payroll_runs"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "payroll_settings" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "payroll_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payroll_settings" ON "payroll_settings"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "payroll_structures" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "payroll_structures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payroll_structures" ON "payroll_structures"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "payslips" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payslips" ON "payslips"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "permission_overrides" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "permission_overrides" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_permission_overrides" ON "permission_overrides"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "product_recipe_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "product_recipe_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_product_recipe_items" ON "product_recipe_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "product_variants" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_product_variants" ON "product_variants"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "products" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_products" ON "products"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "promos" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "promos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_promos" ON "promos"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

-- skip refresh_tokens (no tenant_id column)
ALTER TABLE "report_schedules" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_report_schedules" ON "report_schedules"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "schedule_assignments" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "schedule_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_schedule_assignments" ON "schedule_assignments"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "schedule_swaps" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "schedule_swaps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_schedule_swaps" ON "schedule_swaps"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "service_applications" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "service_applications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_service_applications" ON "service_applications"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "shifts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_shifts" ON "shifts"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "staff" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_staff" ON "staff"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "stock_opname" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "stock_opname" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_stock_opname" ON "stock_opname"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "stock_opname_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "stock_opname_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_stock_opname_items" ON "stock_opname_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "storefront_settings" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "storefront_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_storefront_settings" ON "storefront_settings"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "supplies_cart_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "supplies_cart_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_supplies_cart_items" ON "supplies_cart_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "supplies_carts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "supplies_carts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_supplies_carts" ON "supplies_carts"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "supplies_categories" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "supplies_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_supplies_categories" ON "supplies_categories"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "supplies_order_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "supplies_order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_supplies_order_items" ON "supplies_order_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "supplies_orders" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "supplies_orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_supplies_orders" ON "supplies_orders"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "supplies_products" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "supplies_products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_supplies_products" ON "supplies_products"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "support_access_grants" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "support_access_grants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_support_access_grants" ON "support_access_grants"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "tax_rates" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "tax_rates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tax_rates" ON "tax_rates"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "terminals" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "terminals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_terminals" ON "terminals"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "transaction_items" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "transaction_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_transaction_items" ON "transaction_items"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "transactions" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_transactions" ON "transactions"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "uoms" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "uoms" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_uoms" ON "uoms"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "users" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_users" ON "users"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tenants" ON "tenants"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );

ALTER TABLE "tenant_users" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.current_tenant', true)::int;
ALTER TABLE "tenant_users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tenant_users" ON "tenant_users"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );
