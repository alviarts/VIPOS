-- P2-02: convert per-tenant data tables' UNIQUE constraints to composite
-- (tenant_id, original_columns) so the same human-friendly code/name/sku
-- can be reused across tenants without colliding. Without this, two
-- different merchants could not both have a customer "PLG0001" or a
-- product SKU "C-COFFEE", because the original UNIQUE indexes are global.
--
-- We leave alone:
-- * Already-composite indexes that include a tenant-scoped FK (e.g.
--   schedule_assignments(employee_id, schedule_date)) — they are
--   transitively per tenant.
-- * Token / system-only tables (refresh_tokens, password_reset_tokens).
-- * users.username — global so login can locate a user by username only.
-- * tenants.slug — naturally global by definition.

-- single-column → (tenant_id, col) composite uniques
DROP INDEX IF EXISTS "appointments_ref_no_key";
CREATE UNIQUE INDEX "appointments_tenant_id_ref_no_key" ON "appointments"("tenant_id", "ref_no");

DROP INDEX IF EXISTS "b2b_delivery_orders_number_key";
CREATE UNIQUE INDEX "b2b_delivery_orders_tenant_id_number_key" ON "b2b_delivery_orders"("tenant_id", "number");

DROP INDEX IF EXISTS "b2b_invoices_number_key";
CREATE UNIQUE INDEX "b2b_invoices_tenant_id_number_key" ON "b2b_invoices"("tenant_id", "number");

DROP INDEX IF EXISTS "b2b_quotations_number_key";
CREATE UNIQUE INDEX "b2b_quotations_tenant_id_number_key" ON "b2b_quotations"("tenant_id", "number");

DROP INDEX IF EXISTS "b2b_receipts_number_key";
CREATE UNIQUE INDEX "b2b_receipts_tenant_id_number_key" ON "b2b_receipts"("tenant_id", "number");

DROP INDEX IF EXISTS "b2b_sales_orders_number_key";
CREATE UNIQUE INDEX "b2b_sales_orders_tenant_id_number_key" ON "b2b_sales_orders"("tenant_id", "number");

DROP INDEX IF EXISTS "cash_accounts_kode_key";
CREATE UNIQUE INDEX "cash_accounts_tenant_id_kode_key" ON "cash_accounts"("tenant_id", "kode");

DROP INDEX IF EXISTS "categories_name_key";
CREATE UNIQUE INDEX "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");

DROP INDEX IF EXISTS "coupons_code_key";
CREATE UNIQUE INDEX "coupons_tenant_id_code_key" ON "coupons"("tenant_id", "code");

DROP INDEX IF EXISTS "customer_groups_name_key";
CREATE UNIQUE INDEX "customer_groups_tenant_id_name_key" ON "customer_groups"("tenant_id", "name");

DROP INDEX IF EXISTS "customer_tags_name_key";
CREATE UNIQUE INDEX "customer_tags_tenant_id_name_key" ON "customer_tags"("tenant_id", "name");

DROP INDEX IF EXISTS "customers_kode_key";
CREATE UNIQUE INDEX "customers_tenant_id_kode_key" ON "customers"("tenant_id", "kode");

DROP INDEX IF EXISTS "departments_name_key";
CREATE UNIQUE INDEX "departments_tenant_id_name_key" ON "departments"("tenant_id", "name");

DROP INDEX IF EXISTS "employees_employee_no_key";
CREATE UNIQUE INDEX "employees_tenant_id_employee_no_key" ON "employees"("tenant_id", "employee_no");

DROP INDEX IF EXISTS "gl_accounts_code_key";
CREATE UNIQUE INDEX "gl_accounts_tenant_id_code_key" ON "gl_accounts"("tenant_id", "code");

DROP INDEX IF EXISTS "gl_expenses_ref_no_key";
CREATE UNIQUE INDEX "gl_expenses_tenant_id_ref_no_key" ON "gl_expenses"("tenant_id", "ref_no");

DROP INDEX IF EXISTS "gl_fixed_assets_code_key";
CREATE UNIQUE INDEX "gl_fixed_assets_tenant_id_code_key" ON "gl_fixed_assets"("tenant_id", "code");

DROP INDEX IF EXISTS "gl_incomes_ref_no_key";
CREATE UNIQUE INDEX "gl_incomes_tenant_id_ref_no_key" ON "gl_incomes"("tenant_id", "ref_no");

DROP INDEX IF EXISTS "gl_journals_journal_no_key";
CREATE UNIQUE INDEX "gl_journals_tenant_id_journal_no_key" ON "gl_journals"("tenant_id", "journal_no");

DROP INDEX IF EXISTS "gl_vendors_code_key";
CREATE UNIQUE INDEX "gl_vendors_tenant_id_code_key" ON "gl_vendors"("tenant_id", "code");

DROP INDEX IF EXISTS "help_topics_slug_key";
CREATE UNIQUE INDEX "help_topics_tenant_id_slug_key" ON "help_topics"("tenant_id", "slug");

DROP INDEX IF EXISTS "inspirasi_articles_slug_key";
CREATE UNIQUE INDEX "inspirasi_articles_tenant_id_slug_key" ON "inspirasi_articles"("tenant_id", "slug");

DROP INDEX IF EXISTS "inspirasi_events_slug_key";
CREATE UNIQUE INDEX "inspirasi_events_tenant_id_slug_key" ON "inspirasi_events"("tenant_id", "slug");

DROP INDEX IF EXISTS "inspirasi_magazines_year_month_key";
CREATE UNIQUE INDEX "inspirasi_magazines_tenant_id_year_month_key" ON "inspirasi_magazines"("tenant_id", "year", "month");

DROP INDEX IF EXISTS "marketplace_connections_provider_key";
CREATE UNIQUE INDEX "marketplace_connections_tenant_id_provider_key" ON "marketplace_connections"("tenant_id", "provider");

DROP INDEX IF EXISTS "online_orders_ref_no_key";
CREATE UNIQUE INDEX "online_orders_tenant_id_ref_no_key" ON "online_orders"("tenant_id", "ref_no");

DROP INDEX IF EXISTS "outlets_code_key";
CREATE UNIQUE INDEX "outlets_tenant_id_code_key" ON "outlets"("tenant_id", "code");

DROP INDEX IF EXISTS "payment_methods_code_key";
CREATE UNIQUE INDEX "payment_methods_tenant_id_code_key" ON "payment_methods"("tenant_id", "code");

DROP INDEX IF EXISTS "payroll_runs_ref_no_key";
CREATE UNIQUE INDEX "payroll_runs_tenant_id_ref_no_key" ON "payroll_runs"("tenant_id", "ref_no");

DROP INDEX IF EXISTS "payroll_structures_name_key";
CREATE UNIQUE INDEX "payroll_structures_tenant_id_name_key" ON "payroll_structures"("tenant_id", "name");

DROP INDEX IF EXISTS "products_sku_key";
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

DROP INDEX IF EXISTS "shifts_name_key";
CREATE UNIQUE INDEX "shifts_tenant_id_name_key" ON "shifts"("tenant_id", "name");

DROP INDEX IF EXISTS "stock_opname_kode_key";
CREATE UNIQUE INDEX "stock_opname_tenant_id_kode_key" ON "stock_opname"("tenant_id", "kode");

DROP INDEX IF EXISTS "supplies_categories_slug_key";
CREATE UNIQUE INDEX "supplies_categories_tenant_id_slug_key" ON "supplies_categories"("tenant_id", "slug");

DROP INDEX IF EXISTS "supplies_orders_order_no_key";
CREATE UNIQUE INDEX "supplies_orders_tenant_id_order_no_key" ON "supplies_orders"("tenant_id", "order_no");

DROP INDEX IF EXISTS "supplies_products_sku_key";
CREATE UNIQUE INDEX "supplies_products_tenant_id_sku_key" ON "supplies_products"("tenant_id", "sku");

DROP INDEX IF EXISTS "tax_rates_code_key";
CREATE UNIQUE INDEX "tax_rates_tenant_id_code_key" ON "tax_rates"("tenant_id", "code");

DROP INDEX IF EXISTS "transactions_invoice_number_key";
CREATE UNIQUE INDEX "transactions_tenant_id_invoice_number_key" ON "transactions"("tenant_id", "invoice_number");
