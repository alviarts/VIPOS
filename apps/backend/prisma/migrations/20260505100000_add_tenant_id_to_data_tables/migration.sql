-- P2-02 multi-tenant route refactor: add tenant_id INT FK -> tenants(id) to every
-- business-data table. Strategy is incremental and BACKWARDS-COMPATIBLE:
--   * tenant_id NOT NULL DEFAULT 1 (legacy queries that omit tenant_id still
--     write to default tenant id=1 and keep working unchanged).
--   * FK to tenants(id) ON DELETE RESTRICT.
--   * Index (tenant_id) for query planner.
-- A follow-up migration will DROP DEFAULT once all 25 route files inject
-- req.tenantId explicitly into every INSERT (P2-02b).

ALTER TABLE "app_settings" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_app_settings_tenant" ON "app_settings"("tenant_id");

ALTER TABLE "appointment_resources" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "appointment_resources" ADD CONSTRAINT "appointment_resources_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_appointment_resources_tenant" ON "appointment_resources"("tenant_id");

ALTER TABLE "appointment_services" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_appointment_services_tenant" ON "appointment_services"("tenant_id");

ALTER TABLE "appointments" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_appointments_tenant" ON "appointments"("tenant_id");

ALTER TABLE "approval_chains" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "approval_chains" ADD CONSTRAINT "approval_chains_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_approval_chains_tenant" ON "approval_chains"("tenant_id");

ALTER TABLE "attendance_geofences" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "attendance_geofences" ADD CONSTRAINT "attendance_geofences_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_attendance_geofences_tenant" ON "attendance_geofences"("tenant_id");

ALTER TABLE "attendance_logs" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_attendance_logs_tenant" ON "attendance_logs"("tenant_id");

ALTER TABLE "b2b_delivery_order_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_delivery_order_items" ADD CONSTRAINT "b2b_delivery_order_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_delivery_order_items_tenant" ON "b2b_delivery_order_items"("tenant_id");

ALTER TABLE "b2b_delivery_orders" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_delivery_orders" ADD CONSTRAINT "b2b_delivery_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_delivery_orders_tenant" ON "b2b_delivery_orders"("tenant_id");

ALTER TABLE "b2b_invoice_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_invoice_items" ADD CONSTRAINT "b2b_invoice_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_invoice_items_tenant" ON "b2b_invoice_items"("tenant_id");

ALTER TABLE "b2b_invoices" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_invoices" ADD CONSTRAINT "b2b_invoices_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_invoices_tenant" ON "b2b_invoices"("tenant_id");

ALTER TABLE "b2b_quotation_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_quotation_items" ADD CONSTRAINT "b2b_quotation_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_quotation_items_tenant" ON "b2b_quotation_items"("tenant_id");

ALTER TABLE "b2b_quotations" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_quotations" ADD CONSTRAINT "b2b_quotations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_quotations_tenant" ON "b2b_quotations"("tenant_id");

ALTER TABLE "b2b_receipts" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_receipts" ADD CONSTRAINT "b2b_receipts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_receipts_tenant" ON "b2b_receipts"("tenant_id");

ALTER TABLE "b2b_sales_order_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_sales_order_items" ADD CONSTRAINT "b2b_sales_order_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_sales_order_items_tenant" ON "b2b_sales_order_items"("tenant_id");

ALTER TABLE "b2b_sales_orders" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "b2b_sales_orders" ADD CONSTRAINT "b2b_sales_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_b2b_sales_orders_tenant" ON "b2b_sales_orders"("tenant_id");

ALTER TABLE "capital_applications" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "capital_applications" ADD CONSTRAINT "capital_applications_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_capital_applications_tenant" ON "capital_applications"("tenant_id");

ALTER TABLE "cash_accounts" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_cash_accounts_tenant" ON "cash_accounts"("tenant_id");

ALTER TABLE "cash_transactions" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_cash_transactions_tenant" ON "cash_transactions"("tenant_id");

ALTER TABLE "categories" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_categories_tenant" ON "categories"("tenant_id");

ALTER TABLE "commission_assignments" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_commission_assignments_tenant" ON "commission_assignments"("tenant_id");

ALTER TABLE "commission_groups" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "commission_groups" ADD CONSTRAINT "commission_groups_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_commission_groups_tenant" ON "commission_groups"("tenant_id");

ALTER TABLE "consumer_app_config" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "consumer_app_config" ADD CONSTRAINT "consumer_app_config_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_consumer_app_config_tenant" ON "consumer_app_config"("tenant_id");

ALTER TABLE "coupon_redemptions" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_coupon_redemptions_tenant" ON "coupon_redemptions"("tenant_id");

ALTER TABLE "coupons" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_coupons_tenant" ON "coupons"("tenant_id");

ALTER TABLE "customer_groups" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_customer_groups_tenant" ON "customer_groups"("tenant_id");

ALTER TABLE "customer_tag_map" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "customer_tag_map" ADD CONSTRAINT "customer_tag_map_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_customer_tag_map_tenant" ON "customer_tag_map"("tenant_id");

ALTER TABLE "customer_tags" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_customer_tags_tenant" ON "customer_tags"("tenant_id");

ALTER TABLE "customers" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_customers_tenant" ON "customers"("tenant_id");

ALTER TABLE "departments" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_departments_tenant" ON "departments"("tenant_id");

ALTER TABLE "employee_documents" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_employee_documents_tenant" ON "employee_documents"("tenant_id");

ALTER TABLE "employees" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_employees_tenant" ON "employees"("tenant_id");

ALTER TABLE "gl_accounts" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_accounts_tenant" ON "gl_accounts"("tenant_id");

ALTER TABLE "gl_expenses" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_expenses" ADD CONSTRAINT "gl_expenses_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_expenses_tenant" ON "gl_expenses"("tenant_id");

ALTER TABLE "gl_fixed_asset_depreciations" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_fixed_asset_depreciations" ADD CONSTRAINT "gl_fixed_asset_depreciations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_fixed_asset_depreciations_tenant" ON "gl_fixed_asset_depreciations"("tenant_id");

ALTER TABLE "gl_fixed_asset_disposals" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_fixed_asset_disposals" ADD CONSTRAINT "gl_fixed_asset_disposals_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_fixed_asset_disposals_tenant" ON "gl_fixed_asset_disposals"("tenant_id");

ALTER TABLE "gl_fixed_assets" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_fixed_assets_tenant" ON "gl_fixed_assets"("tenant_id");

ALTER TABLE "gl_incomes" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_incomes" ADD CONSTRAINT "gl_incomes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_incomes_tenant" ON "gl_incomes"("tenant_id");

ALTER TABLE "gl_journal_lines" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_journal_lines_tenant" ON "gl_journal_lines"("tenant_id");

ALTER TABLE "gl_journals" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_journals" ADD CONSTRAINT "gl_journals_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_journals_tenant" ON "gl_journals"("tenant_id");

ALTER TABLE "gl_recurring_bills" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_recurring_bills" ADD CONSTRAINT "gl_recurring_bills_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_recurring_bills_tenant" ON "gl_recurring_bills"("tenant_id");

ALTER TABLE "gl_vendors" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "gl_vendors" ADD CONSTRAINT "gl_vendors_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_gl_vendors_tenant" ON "gl_vendors"("tenant_id");

ALTER TABLE "help_feedback" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_help_feedback_tenant" ON "help_feedback"("tenant_id");

ALTER TABLE "help_topics" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "help_topics" ADD CONSTRAINT "help_topics_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_help_topics_tenant" ON "help_topics"("tenant_id");

ALTER TABLE "informasi_updates" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "informasi_updates" ADD CONSTRAINT "informasi_updates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_informasi_updates_tenant" ON "informasi_updates"("tenant_id");

ALTER TABLE "inspirasi_articles" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inspirasi_articles" ADD CONSTRAINT "inspirasi_articles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_inspirasi_articles_tenant" ON "inspirasi_articles"("tenant_id");

ALTER TABLE "inspirasi_event_rsvps" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inspirasi_event_rsvps" ADD CONSTRAINT "inspirasi_event_rsvps_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_inspirasi_event_rsvps_tenant" ON "inspirasi_event_rsvps"("tenant_id");

ALTER TABLE "inspirasi_events" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inspirasi_events" ADD CONSTRAINT "inspirasi_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_inspirasi_events_tenant" ON "inspirasi_events"("tenant_id");

ALTER TABLE "inspirasi_magazines" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inspirasi_magazines" ADD CONSTRAINT "inspirasi_magazines_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_inspirasi_magazines_tenant" ON "inspirasi_magazines"("tenant_id");

ALTER TABLE "inventory_movements" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_inventory_movements_tenant" ON "inventory_movements"("tenant_id");

ALTER TABLE "loyalty_rules" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "loyalty_rules" ADD CONSTRAINT "loyalty_rules_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_loyalty_rules_tenant" ON "loyalty_rules"("tenant_id");

ALTER TABLE "loyalty_transactions" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_loyalty_transactions_tenant" ON "loyalty_transactions"("tenant_id");

ALTER TABLE "marketing_campaign_recipients" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_marketing_campaign_recipients_tenant" ON "marketing_campaign_recipients"("tenant_id");

ALTER TABLE "marketing_campaigns" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_marketing_campaigns_tenant" ON "marketing_campaigns"("tenant_id");

ALTER TABLE "marketing_credit_ledger" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "marketing_credit_ledger" ADD CONSTRAINT "marketing_credit_ledger_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_marketing_credit_ledger_tenant" ON "marketing_credit_ledger"("tenant_id");

ALTER TABLE "marketing_templates" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "marketing_templates" ADD CONSTRAINT "marketing_templates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_marketing_templates_tenant" ON "marketing_templates"("tenant_id");

ALTER TABLE "marketplace_connections" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "marketplace_connections" ADD CONSTRAINT "marketplace_connections_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_marketplace_connections_tenant" ON "marketplace_connections"("tenant_id");

ALTER TABLE "marketplace_product_overrides" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "marketplace_product_overrides" ADD CONSTRAINT "marketplace_product_overrides_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_marketplace_product_overrides_tenant" ON "marketplace_product_overrides"("tenant_id");

ALTER TABLE "notification_prefs" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_notification_prefs_tenant" ON "notification_prefs"("tenant_id");

ALTER TABLE "online_order_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "online_order_items" ADD CONSTRAINT "online_order_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_online_order_items_tenant" ON "online_order_items"("tenant_id");

ALTER TABLE "online_orders" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "online_orders" ADD CONSTRAINT "online_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_online_orders_tenant" ON "online_orders"("tenant_id");

ALTER TABLE "outlet_floor_plans" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "outlet_floor_plans" ADD CONSTRAINT "outlet_floor_plans_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_outlet_floor_plans_tenant" ON "outlet_floor_plans"("tenant_id");

ALTER TABLE "outlets" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_outlets_tenant" ON "outlets"("tenant_id");

-- skip password_reset_tokens (indirectly tenant-scoped via parent FK)
ALTER TABLE "payment_methods" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_payment_methods_tenant" ON "payment_methods"("tenant_id");

ALTER TABLE "payroll_runs" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_payroll_runs_tenant" ON "payroll_runs"("tenant_id");

ALTER TABLE "payroll_settings" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_payroll_settings_tenant" ON "payroll_settings"("tenant_id");

ALTER TABLE "payroll_structures" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payroll_structures" ADD CONSTRAINT "payroll_structures_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_payroll_structures_tenant" ON "payroll_structures"("tenant_id");

ALTER TABLE "payslips" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_payslips_tenant" ON "payslips"("tenant_id");

ALTER TABLE "permission_overrides" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_permission_overrides_tenant" ON "permission_overrides"("tenant_id");

ALTER TABLE "product_recipe_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "product_recipe_items" ADD CONSTRAINT "product_recipe_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_product_recipe_items_tenant" ON "product_recipe_items"("tenant_id");

ALTER TABLE "product_variants" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_product_variants_tenant" ON "product_variants"("tenant_id");

ALTER TABLE "products" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_products_tenant" ON "products"("tenant_id");

ALTER TABLE "promos" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "promos" ADD CONSTRAINT "promos_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_promos_tenant" ON "promos"("tenant_id");

-- skip refresh_tokens (indirectly tenant-scoped via parent FK)
ALTER TABLE "report_schedules" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_report_schedules_tenant" ON "report_schedules"("tenant_id");

ALTER TABLE "schedule_assignments" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_schedule_assignments_tenant" ON "schedule_assignments"("tenant_id");

ALTER TABLE "schedule_swaps" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "schedule_swaps" ADD CONSTRAINT "schedule_swaps_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_schedule_swaps_tenant" ON "schedule_swaps"("tenant_id");

ALTER TABLE "service_applications" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "service_applications" ADD CONSTRAINT "service_applications_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_service_applications_tenant" ON "service_applications"("tenant_id");

ALTER TABLE "shifts" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_shifts_tenant" ON "shifts"("tenant_id");

ALTER TABLE "staff" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_staff_tenant" ON "staff"("tenant_id");

ALTER TABLE "stock_opname" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_stock_opname_tenant" ON "stock_opname"("tenant_id");

ALTER TABLE "stock_opname_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_stock_opname_items_tenant" ON "stock_opname_items"("tenant_id");

ALTER TABLE "storefront_settings" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "storefront_settings" ADD CONSTRAINT "storefront_settings_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_storefront_settings_tenant" ON "storefront_settings"("tenant_id");

ALTER TABLE "supplies_cart_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplies_cart_items" ADD CONSTRAINT "supplies_cart_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_supplies_cart_items_tenant" ON "supplies_cart_items"("tenant_id");

ALTER TABLE "supplies_carts" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplies_carts" ADD CONSTRAINT "supplies_carts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_supplies_carts_tenant" ON "supplies_carts"("tenant_id");

ALTER TABLE "supplies_categories" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplies_categories" ADD CONSTRAINT "supplies_categories_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_supplies_categories_tenant" ON "supplies_categories"("tenant_id");

ALTER TABLE "supplies_order_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplies_order_items" ADD CONSTRAINT "supplies_order_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_supplies_order_items_tenant" ON "supplies_order_items"("tenant_id");

ALTER TABLE "supplies_orders" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplies_orders" ADD CONSTRAINT "supplies_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_supplies_orders_tenant" ON "supplies_orders"("tenant_id");

ALTER TABLE "supplies_products" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplies_products" ADD CONSTRAINT "supplies_products_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_supplies_products_tenant" ON "supplies_products"("tenant_id");

ALTER TABLE "support_access_grants" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_support_access_grants_tenant" ON "support_access_grants"("tenant_id");

ALTER TABLE "tax_rates" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_tax_rates_tenant" ON "tax_rates"("tenant_id");

ALTER TABLE "terminals" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_terminals_tenant" ON "terminals"("tenant_id");

ALTER TABLE "transaction_items" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_transaction_items_tenant" ON "transaction_items"("tenant_id");

ALTER TABLE "transactions" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_transactions_tenant" ON "transactions"("tenant_id");

ALTER TABLE "uoms" ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "uoms" ADD CONSTRAINT "uoms_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
CREATE INDEX "idx_uoms_tenant" ON "uoms"("tenant_id");
