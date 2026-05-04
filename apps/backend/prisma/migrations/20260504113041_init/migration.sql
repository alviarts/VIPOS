-- CreateTable
CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "outlet_id" INTEGER,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" TEXT NOT NULL,
    "updated_by" INTEGER,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_resources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL DEFAULT 'room',
    "capacity" INTEGER DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_services" (
    "id" SERIAL NOT NULL,
    "appointment_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "service_name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration_minutes" INTEGER DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "customer_id" INTEGER,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "staff_id" INTEGER,
    "resource_id" INTEGER,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "deposit_amount" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transaction_id" INTEGER,
    "checked_in_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "reminders_config" TEXT,
    "reminder_24h_sent_at" TIMESTAMPTZ(6),
    "reminder_1h_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_chains" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "threshold_amount" DOUBLE PRECISION DEFAULT 0,
    "steps" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_geofences" (
    "id" SERIAL NOT NULL,
    "outlet_id" INTEGER NOT NULL,
    "outlet_name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radius_m" INTEGER DEFAULT 100,
    "strict_mode" INTEGER DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "log_type" TEXT NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'manual',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photo_url" TEXT,
    "note" TEXT,
    "is_off_site" INTEGER DEFAULT 0,
    "approved_by" INTEGER,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_delivery_order_items" (
    "id" SERIAL NOT NULL,
    "delivery_order_id" INTEGER NOT NULL,
    "sales_order_item_id" INTEGER,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "b2b_delivery_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_delivery_orders" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "sales_order_id" INTEGER,
    "customer_id" INTEGER,
    "customer_name" TEXT NOT NULL,
    "delivery_date" TEXT NOT NULL,
    "expected_arrival" TEXT,
    "carrier" TEXT,
    "driver" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "notes" TEXT,
    "signature_url" TEXT,
    "stock_posted" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_invoice_items" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "sales_order_item_id" INTEGER,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "discount_percent" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "b2b_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_invoices" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "sales_order_id" INTEGER,
    "customer_id" INTEGER,
    "customer_name" TEXT NOT NULL,
    "invoice_date" TEXT NOT NULL,
    "due_date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "down_payment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstanding" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_quotation_items" (
    "id" SERIAL NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "discount_percent" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "b2b_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_quotations" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" INTEGER,
    "customer_name" TEXT NOT NULL,
    "quote_date" TEXT NOT NULL,
    "valid_until" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "converted_so_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_receipts" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "payment_date" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "amount" DOUBLE PRECISION NOT NULL,
    "bank_account_id" INTEGER,
    "ref_number" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_sales_order_items" (
    "id" SERIAL NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "qty_delivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_invoiced" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "discount_percent" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "b2b_sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_sales_orders" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "quotation_id" INTEGER,
    "customer_id" INTEGER,
    "customer_name" TEXT NOT NULL,
    "order_date" TEXT NOT NULL,
    "expected_delivery" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_applications" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "collateral" TEXT,
    "monthly_revenue" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "pre_qualification_score" INTEGER,
    "payload_json" TEXT,
    "submitted_by" INTEGER,
    "submitted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "capital_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "tipe" TEXT DEFAULT 'detail',
    "nama" TEXT NOT NULL,
    "kategori" TEXT DEFAULT 'Kas & Bank',
    "saldo_awal" DOUBLE PRECISION DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "tipe" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "account_to_id" INTEGER,
    "kategori" TEXT,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "keterangan" TEXT,
    "reference" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "urutan" INTEGER DEFAULT 0,
    "department_id" INTEGER,
    "color" TEXT,
    "icon_url" TEXT,
    "is_tampil_di_menu" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_assignments" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "commission_group_id" INTEGER NOT NULL,
    "basis_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basis_qty" INTEGER NOT NULL DEFAULT 0,
    "computed_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tier_percentage" DOUBLE PRECISION,
    "period_key" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "applies_to_scope" TEXT NOT NULL DEFAULT 'all',
    "applies_to_role_keys" TEXT,
    "applies_to_employee_ids" TEXT,
    "applies_to_products_scope" TEXT NOT NULL DEFAULT 'all',
    "applies_to_category_ids" TEXT,
    "applies_to_product_ids" TEXT,
    "amount" DOUBLE PRECISION,
    "amount_basis" TEXT DEFAULT 'PER_TRANSACTION',
    "tiers" TEXT,
    "calc_period" TEXT NOT NULL DEFAULT 'MONTH',
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumer_app_config" (
    "id" INTEGER NOT NULL,
    "app_name" TEXT,
    "app_icon_url" TEXT,
    "splash_image_url" TEXT,
    "primary_color" TEXT DEFAULT '#04C99E',
    "bundle_id_android" TEXT,
    "bundle_id_ios" TEXT,
    "play_store_url" TEXT,
    "app_store_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "provisioned_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "featured_promo_ids" TEXT,
    "hidden_product_ids" TEXT,
    "operating_hours" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" SERIAL NOT NULL,
    "coupon_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "customer_id" INTEGER,
    "amount" DOUBLE PRECISION DEFAULT 0,
    "redeemed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "promo_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "batch_id" TEXT,
    "max_uses" INTEGER DEFAULT 1,
    "used_count" INTEGER DEFAULT 0,
    "assigned_customer_id" INTEGER,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_percent" DOUBLE PRECISION DEFAULT 0,
    "points_multiplier" DOUBLE PRECISION DEFAULT 1,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tag_map" (
    "customer_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tag_map_pkey" PRIMARY KEY ("customer_id","tag_id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "kode" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gender" TEXT,
    "birth_date" DATE,
    "points" INTEGER DEFAULT 0,
    "deposit" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "customer_group_id" INTEGER,
    "npwp" TEXT,
    "id_card_no" TEXT,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "urutan" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "doc_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "uploaded_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "employee_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photo_url" TEXT,
    "nik_ktp" TEXT,
    "npwp" TEXT,
    "birth_date" DATE,
    "birth_place" TEXT,
    "gender" TEXT,
    "marital_status" TEXT,
    "religion" TEXT,
    "blood_type" TEXT,
    "nationality" TEXT DEFAULT 'Indonesia',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "address_ktp" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_relation" TEXT,
    "emergency_contact_phone" TEXT,
    "department_id" INTEGER,
    "position" TEXT,
    "employee_type" TEXT DEFAULT 'permanent',
    "date_joined" DATE,
    "date_resigned" DATE,
    "role" TEXT DEFAULT 'cashier',
    "payroll_structure_id" INTEGER,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_account_name" TEXT,
    "base_salary" DOUBLE PRECISION DEFAULT 0,
    "pin_code" TEXT,
    "attendance_methods" TEXT,
    "allowed_outlet_ids" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "parent_id" INTEGER,
    "normal_balance" TEXT NOT NULL,
    "opening_balance" DOUBLE PRECISION DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_expenses" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "vendor_id" INTEGER,
    "expense_account_id" INTEGER NOT NULL,
    "payment_account_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tax_amount" DOUBLE PRECISION DEFAULT 0,
    "description" TEXT,
    "attachment" TEXT,
    "is_recurring" INTEGER NOT NULL DEFAULT 0,
    "journal_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_fixed_asset_depreciations" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "journal_id" INTEGER,
    "run_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_fixed_asset_depreciations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_fixed_asset_disposals" (
    "id" SERIAL NOT NULL,
    "asset_id" INTEGER NOT NULL,
    "disposal_date" DATE NOT NULL,
    "disposal_type" TEXT NOT NULL,
    "proceeds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buyer" TEXT,
    "gain_loss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proceeds_account_id" INTEGER,
    "journal_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_fixed_asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_fixed_assets" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "acquisition_date" DATE NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "useful_life_years" INTEGER NOT NULL DEFAULT 1,
    "salvage_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depreciation_method" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "accumulated_depreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "location" TEXT,
    "vendor_id" INTEGER,
    "photo_url" TEXT,
    "asset_account_id" INTEGER NOT NULL,
    "accum_dep_account_id" INTEGER NOT NULL,
    "dep_expense_account_id" INTEGER NOT NULL,
    "payment_account_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "acquisition_journal_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_incomes" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "income_date" DATE NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'other',
    "customer_id" INTEGER,
    "source_other" TEXT,
    "category" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "cash_account_id" INTEGER NOT NULL,
    "revenue_account_id" INTEGER NOT NULL,
    "tax_amount" DOUBLE PRECISION DEFAULT 0,
    "description" TEXT,
    "attachment" TEXT,
    "journal_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_journal_lines" (
    "id" SERIAL NOT NULL,
    "journal_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gl_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_journals" (
    "id" SERIAL NOT NULL,
    "journal_no" TEXT NOT NULL,
    "journal_date" DATE NOT NULL,
    "description" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_id" INTEGER,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_locked" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_recurring_bills" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "vendor_id" INTEGER,
    "expense_account_id" INTEGER NOT NULL,
    "payment_account_id" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "due_day" INTEGER NOT NULL DEFAULT 1,
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_recurring_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_vendors" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "npwp" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "bank_account_holder" TEXT,
    "default_account_id" INTEGER,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_feedback" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshot_url" TEXT,
    "app_version" TEXT,
    "device_info" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "submitted_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_topics" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "excerpt" TEXT,
    "content" TEXT,
    "sort_order" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "informasi_updates" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "published_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "informasi_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspirasi_articles" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "cover_url" TEXT,
    "author" TEXT,
    "reading_minutes" INTEGER DEFAULT 3,
    "published_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_active" INTEGER DEFAULT 1,

    CONSTRAINT "inspirasi_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspirasi_event_rsvps" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'going',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspirasi_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspirasi_events" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "event_date" TIMESTAMPTZ(6) NOT NULL,
    "cover_url" TEXT,
    "capacity" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspirasi_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspirasi_magazines" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "pdf_url" TEXT,
    "published_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspirasi_magazines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "product_id" INTEGER NOT NULL,
    "tipe" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "stok_sebelum" INTEGER NOT NULL,
    "stok_sesudah" INTEGER NOT NULL,
    "unit_cost" DOUBLE PRECISION,
    "reason" TEXT,
    "ref_type" TEXT,
    "ref_id" INTEGER,
    "keterangan" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "earn_rate" DOUBLE PRECISION,
    "bonus_points" INTEGER,
    "target_product_ids" TEXT,
    "multiplier_per_group" TEXT,
    "excluded_payment_methods" TEXT,
    "excluded_categories" TEXT,
    "redemption_rate" DOUBLE PRECISION,
    "min_redeem_per_transaction" INTEGER,
    "max_redeem_per_transaction" INTEGER,
    "max_redeem_per_day_per_customer" INTEGER,
    "redemption_block" INTEGER,
    "points_expire_after_months" INTEGER,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "rule_id" INTEGER,
    "notes" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaign_recipients" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "contact" TEXT NOT NULL,
    "contact_label" TEXT,
    "rendered_message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provider_ref" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "audience_type" TEXT NOT NULL,
    "audience_group_ids" TEXT,
    "audience_tag_ids" TEXT,
    "audience_custom_recipients" TEXT,
    "template_id" INTEGER,
    "template_snapshot" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL DEFAULT 'now',
    "scheduled_at" TIMESTAMPTZ(6),
    "recurrence_rule" TEXT,
    "cost_per_message" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "opened_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_credit_ledger" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "campaign_id" INTEGER,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "header" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons" TEXT,
    "subject" TEXT,
    "caption" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_connections" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "merchant_id" TEXT,
    "outlet_id" TEXT,
    "oauth_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "auto_accept" INTEGER DEFAULT 0,
    "sla_accept_minutes" INTEGER DEFAULT 5,
    "sla_ready_minutes" INTEGER DEFAULT 15,
    "mdr_percent" DOUBLE PRECISION DEFAULT 20,
    "price_markup_percent" DOUBLE PRECISION DEFAULT 0,
    "settings" TEXT,
    "connected_at" TIMESTAMPTZ(6),
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_product_overrides" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "override_name" TEXT,
    "override_price" DOUBLE PRECISION,
    "override_image_url" TEXT,
    "is_enabled" INTEGER NOT NULL DEFAULT 1,
    "synced_at" TIMESTAMPTZ(6),
    "sync_status" TEXT DEFAULT 'pending',
    "sync_error" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_product_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_key" TEXT NOT NULL,
    "via_push" INTEGER DEFAULT 1,
    "via_wa" INTEGER DEFAULT 0,
    "via_sms" INTEGER DEFAULT 0,
    "via_email" INTEGER DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modifiers" TEXT,
    "notes" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "online_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_orders" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "external_ref" TEXT,
    "order_type" TEXT NOT NULL DEFAULT 'delivery',
    "table_no" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_address" TEXT,
    "delivery_zone" TEXT,
    "delivery_fee" DOUBLE PRECISION DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "service_charge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reject_reason" TEXT,
    "cancel_reason" TEXT,
    "sla_minutes" INTEGER DEFAULT 30,
    "accepted_at" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "online_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_floor_plans" (
    "id" SERIAL NOT NULL,
    "outlet_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER DEFAULT 1000,
    "height" INTEGER DEFAULT 700,
    "tables_json" TEXT NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlet_floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlets" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_url" TEXT,
    "tax_npwp" TEXT,
    "timezone" TEXT DEFAULT 'Asia/Jakarta',
    "currency" TEXT DEFAULT 'IDR',
    "is_main" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "fee_percent" DOUBLE PRECISION DEFAULT 0,
    "fee_flat" DOUBLE PRECISION DEFAULT 0,
    "account_id" INTEGER,
    "is_active" INTEGER DEFAULT 1,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "payment_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total_gross" DOUBLE PRECISION DEFAULT 0,
    "total_deductions" DOUBLE PRECISION DEFAULT 0,
    "total_net" DOUBLE PRECISION DEFAULT 0,
    "employee_count" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "cutoff_day" INTEGER DEFAULT 25,
    "payment_day" INTEGER DEFAULT 1,
    "working_hours_per_month" DOUBLE PRECISION DEFAULT 173,
    "overtime_multiplier" DOUBLE PRECISION DEFAULT 1.5,
    "tax_method" TEXT DEFAULT 'gross',
    "bpjs_kesehatan_employee" DOUBLE PRECISION DEFAULT 1.0,
    "bpjs_jht_employee" DOUBLE PRECISION DEFAULT 2.0,
    "bpjs_jp_employee" DOUBLE PRECISION DEFAULT 1.0,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_structures" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basic_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowances" TEXT,
    "deductions" TEXT,
    "overtime_rate" DOUBLE PRECISION DEFAULT 0,
    "include_bpjs" INTEGER DEFAULT 1,
    "include_pph21" INTEGER DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" SERIAL NOT NULL,
    "payroll_run_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "employee_no" TEXT,
    "employee_name" TEXT,
    "structure_id" INTEGER,
    "basic_salary" DOUBLE PRECISION DEFAULT 0,
    "total_allowances" DOUBLE PRECISION DEFAULT 0,
    "total_deductions" DOUBLE PRECISION DEFAULT 0,
    "overtime_hours" DOUBLE PRECISION DEFAULT 0,
    "overtime_amount" DOUBLE PRECISION DEFAULT 0,
    "bpjs_kesehatan" DOUBLE PRECISION DEFAULT 0,
    "bpjs_jht" DOUBLE PRECISION DEFAULT 0,
    "bpjs_jp" DOUBLE PRECISION DEFAULT 0,
    "pph21" DOUBLE PRECISION DEFAULT 0,
    "gross_salary" DOUBLE PRECISION DEFAULT 0,
    "net_salary" DOUBLE PRECISION DEFAULT 0,
    "breakdown" TEXT,
    "bank_name" TEXT,
    "bank_account_no" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_overrides" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "permission_key" TEXT NOT NULL,
    "granted" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recipe_items" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "group_name" TEXT NOT NULL,
    "option_label" TEXT NOT NULL,
    "price_modifier" DOUBLE PRECISION DEFAULT 0,
    "sku_suffix" TEXT,
    "stock" INTEGER DEFAULT 0,
    "is_default" INTEGER DEFAULT 0,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "harga_modal" DOUBLE PRECISION DEFAULT 0,
    "harga_beli" DOUBLE PRECISION DEFAULT 0,
    "stock" INTEGER DEFAULT 0,
    "satuan" TEXT DEFAULT 'pcs',
    "description" TEXT,
    "category_id" INTEGER,
    "image_url" TEXT,
    "is_active" INTEGER DEFAULT 1,
    "is_tampil_di_menu" INTEGER DEFAULT 1,
    "is_favorit" INTEGER DEFAULT 0,
    "monitor_stok" INTEGER DEFAULT 0,
    "stok_minimum" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "price_online" DOUBLE PRECISION,
    "is_online_active" INTEGER DEFAULT 0,
    "image_urls" TEXT,
    "has_variants" INTEGER DEFAULT 0,
    "has_recipe" INTEGER DEFAULT 0,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promos" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promo_type" TEXT NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_discount" DOUBLE PRECISION,
    "bundle_price" DOUBLE PRECISION,
    "qty_required" INTEGER DEFAULT 0,
    "give_qty" INTEGER DEFAULT 0,
    "discount_target" TEXT DEFAULT 'WHOLE_CART',
    "target_product_ids" TEXT,
    "target_category_ids" TEXT,
    "customer_group_ids" TEXT,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "day_of_week_mask" INTEGER DEFAULT 127,
    "time_of_day_start" TEXT,
    "time_of_day_end" TEXT,
    "min_purchase" DOUBLE PRECISION DEFAULT 0,
    "max_use_per_customer" INTEGER DEFAULT 0,
    "max_total_use" INTEGER DEFAULT 0,
    "current_use_count" INTEGER DEFAULT 0,
    "step_tiers" TEXT,
    "is_stackable" INTEGER DEFAULT 0,
    "requires_coupon" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "replaced_by" INTEGER,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" SERIAL NOT NULL,
    "report_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params_json" TEXT,
    "frequency" TEXT NOT NULL,
    "recipients" TEXT,
    "format" TEXT DEFAULT 'pdf',
    "is_active" INTEGER DEFAULT 1,
    "last_run_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "shift_id" INTEGER,
    "schedule_date" DATE NOT NULL,
    "is_off" INTEGER DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_swaps" (
    "id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "requester_assignment_id" INTEGER NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "partner_assignment_id" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by" INTEGER,
    "decided_at" TIMESTAMPTZ(6),
    "decision_note" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_swaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_applications" (
    "id" SERIAL NOT NULL,
    "service_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "payload_json" TEXT,
    "notes" TEXT,
    "submitted_by" INTEGER,
    "submitted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER DEFAULT 0,
    "color" TEXT DEFAULT '#04C99E',
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT,
    "color" TEXT DEFAULT '#04C99E',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "catatan" TEXT,
    "created_by" INTEGER,
    "finalized_by" INTEGER,
    "finalized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_opname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_items" (
    "id" SERIAL NOT NULL,
    "opname_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty_sistem" INTEGER NOT NULL DEFAULT 0,
    "qty_fisik" INTEGER,
    "catatan" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_opname_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_settings" (
    "id" INTEGER NOT NULL,
    "slug" TEXT,
    "custom_domain" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "brand_name" TEXT,
    "logo_url" TEXT,
    "cover_image_url" TEXT,
    "primary_color" TEXT DEFAULT '#04C99E',
    "accent_color" TEXT,
    "theme" TEXT DEFAULT 'light',
    "language" TEXT DEFAULT 'id',
    "currency" TEXT DEFAULT 'IDR',
    "tagline" TEXT,
    "about_text" TEXT,
    "contact_phone" TEXT,
    "contact_whatsapp" TEXT,
    "contact_email" TEXT,
    "contact_instagram" TEXT,
    "tos_text" TEXT,
    "privacy_text" TEXT,
    "faq_text" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_og_image_url" TEXT,
    "ga_id" TEXT,
    "fb_pixel_id" TEXT,
    "operating_hours" TEXT,
    "payment_methods" TEXT,
    "delivery_zones" TEXT,
    "min_order_amount" DOUBLE PRECISION DEFAULT 0,
    "service_charge_percent" DOUBLE PRECISION DEFAULT 0,
    "tax_percent" DOUBLE PRECISION DEFAULT 0,
    "supports_dine_in" INTEGER DEFAULT 1,
    "supports_takeaway" INTEGER DEFAULT 1,
    "supports_delivery" INTEGER DEFAULT 1,
    "banner_slides" TEXT,
    "featured_product_ids" TEXT,
    "hidden_category_ids" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_cart_items" (
    "id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplies_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_carts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplies_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_categories" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,

    CONSTRAINT "supplies_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "supplies_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_orders" (
    "id" SERIAL NOT NULL,
    "order_no" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT,
    "delivery_address" TEXT,
    "delivery_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "ordered_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "supplies_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplies_products" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "moq" INTEGER DEFAULT 1,
    "stock_status" TEXT NOT NULL DEFAULT 'in_stock',
    "supplier_name" TEXT,
    "category_id" INTEGER,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplies_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_access_grants" (
    "id" SERIAL NOT NULL,
    "grantee_email" TEXT NOT NULL,
    "reason" TEXT,
    "granted_by" INTEGER,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_inclusive" INTEGER DEFAULT 0,
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminals" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outlet_id" INTEGER,
    "model" TEXT,
    "serial_no" TEXT,
    "ip_address" TEXT,
    "mac_address" TEXT,
    "paired_user_id" INTEGER,
    "config_json" TEXT,
    "last_seen_at" TIMESTAMPTZ(6),
    "is_active" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "payment_amount" DOUBLE PRECISION NOT NULL,
    "change_amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT DEFAULT 'cash',
    "status" TEXT DEFAULT 'completed',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uoms" (
    "id" SERIAL NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "base_uom_id" INTEGER,
    "conversion_factor" DOUBLE PRECISION DEFAULT 1,
    "is_active" INTEGER DEFAULT 1,

    CONSTRAINT "uoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT DEFAULT 'cashier',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "totp_secret" TEXT,
    "totp_enabled" INTEGER DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(6),
    "photo_url" TEXT,
    "phone" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_outlet_id_category_key_key" ON "app_settings"("outlet_id", "category", "key");

-- CreateIndex
CREATE INDEX "idx_appointment_services_appt" ON "appointment_services"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_ref_no_key" ON "appointments"("ref_no");

-- CreateIndex
CREATE INDEX "idx_appointments_customer" ON "appointments"("customer_id");

-- CreateIndex
CREATE INDEX "idx_appointments_staff" ON "appointments"("staff_id");

-- CreateIndex
CREATE INDEX "idx_appointments_start" ON "appointments"("start_at");

-- CreateIndex
CREATE INDEX "idx_appointments_status" ON "appointments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_geofences_outlet_id_key" ON "attendance_geofences"("outlet_id");

-- CreateIndex
CREATE INDEX "idx_attendance_employee" ON "attendance_logs"("employee_id");

-- CreateIndex
CREATE INDEX "idx_attendance_logged" ON "attendance_logs"("logged_at");

-- CreateIndex
CREATE INDEX "idx_b2b_delivery_order_items_do" ON "b2b_delivery_order_items"("delivery_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_delivery_orders_number_key" ON "b2b_delivery_orders"("number");

-- CreateIndex
CREATE INDEX "idx_b2b_delivery_orders_so" ON "b2b_delivery_orders"("sales_order_id");

-- CreateIndex
CREATE INDEX "idx_b2b_invoice_items_inv" ON "b2b_invoice_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_invoices_number_key" ON "b2b_invoices"("number");

-- CreateIndex
CREATE INDEX "idx_b2b_invoices_customer" ON "b2b_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "idx_b2b_invoices_due" ON "b2b_invoices"("due_date");

-- CreateIndex
CREATE INDEX "idx_b2b_invoices_status" ON "b2b_invoices"("status");

-- CreateIndex
CREATE INDEX "idx_b2b_quotation_items_qid" ON "b2b_quotation_items"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_quotations_number_key" ON "b2b_quotations"("number");

-- CreateIndex
CREATE INDEX "idx_b2b_quotations_customer" ON "b2b_quotations"("customer_id");

-- CreateIndex
CREATE INDEX "idx_b2b_quotations_status" ON "b2b_quotations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_receipts_number_key" ON "b2b_receipts"("number");

-- CreateIndex
CREATE INDEX "idx_b2b_receipts_invoice" ON "b2b_receipts"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_b2b_sales_order_items_so" ON "b2b_sales_order_items"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_sales_orders_number_key" ON "b2b_sales_orders"("number");

-- CreateIndex
CREATE INDEX "idx_b2b_sales_orders_customer" ON "b2b_sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_b2b_sales_orders_status" ON "b2b_sales_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_kode_key" ON "cash_accounts"("kode");

-- CreateIndex
CREATE INDEX "idx_cash_transactions_account" ON "cash_transactions"("account_id");

-- CreateIndex
CREATE INDEX "idx_cash_transactions_tanggal" ON "cash_transactions"("tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "idx_commission_assign_employee" ON "commission_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "idx_commission_assign_period" ON "commission_assignments"("period_key");

-- CreateIndex
CREATE INDEX "idx_commission_assign_transaction" ON "commission_assignments"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_coupon_redemptions_coupon" ON "coupon_redemptions"("coupon_id");

-- CreateIndex
CREATE INDEX "idx_coupon_redemptions_customer" ON "coupon_redemptions"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "idx_coupons_active" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "idx_coupons_batch" ON "coupons"("batch_id");

-- CreateIndex
CREATE INDEX "idx_coupons_promo" ON "coupons"("promo_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_name_key" ON "customer_groups"("name");

-- CreateIndex
CREATE INDEX "idx_customer_tag_map_customer" ON "customer_tag_map"("customer_id");

-- CreateIndex
CREATE INDEX "idx_customer_tag_map_tag" ON "customer_tag_map"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_name_key" ON "customer_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_kode_key" ON "customers"("kode");

-- CreateIndex
CREATE INDEX "idx_customers_group" ON "customers"("customer_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_no_key" ON "employees"("employee_no");

-- CreateIndex
CREATE INDEX "idx_employees_dept" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "idx_employees_status" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");

-- CreateIndex
CREATE INDEX "idx_gl_accounts_parent" ON "gl_accounts"("parent_id");

-- CreateIndex
CREATE INDEX "idx_gl_accounts_type" ON "gl_accounts"("type");

-- CreateIndex
CREATE UNIQUE INDEX "gl_expenses_ref_no_key" ON "gl_expenses"("ref_no");

-- CreateIndex
CREATE INDEX "idx_gl_expenses_date" ON "gl_expenses"("expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "gl_fixed_asset_depreciations_asset_id_period_year_period_mo_key" ON "gl_fixed_asset_depreciations"("asset_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "gl_fixed_asset_disposals_asset_id_key" ON "gl_fixed_asset_disposals"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "gl_fixed_assets_code_key" ON "gl_fixed_assets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gl_incomes_ref_no_key" ON "gl_incomes"("ref_no");

-- CreateIndex
CREATE INDEX "idx_gl_incomes_date" ON "gl_incomes"("income_date");

-- CreateIndex
CREATE INDEX "idx_gl_journal_lines_account" ON "gl_journal_lines"("account_id");

-- CreateIndex
CREATE INDEX "idx_gl_journal_lines_journal" ON "gl_journal_lines"("journal_id");

-- CreateIndex
CREATE UNIQUE INDEX "gl_journals_journal_no_key" ON "gl_journals"("journal_no");

-- CreateIndex
CREATE INDEX "idx_gl_journals_date" ON "gl_journals"("journal_date");

-- CreateIndex
CREATE INDEX "idx_gl_journals_source" ON "gl_journals"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "gl_vendors_code_key" ON "gl_vendors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "help_topics_slug_key" ON "help_topics"("slug");

-- CreateIndex
CREATE INDEX "idx_help_topics_category" ON "help_topics"("category");

-- CreateIndex
CREATE UNIQUE INDEX "inspirasi_articles_slug_key" ON "inspirasi_articles"("slug");

-- CreateIndex
CREATE INDEX "idx_inspirasi_articles_category" ON "inspirasi_articles"("category");

-- CreateIndex
CREATE UNIQUE INDEX "inspirasi_event_rsvps_event_id_user_id_key" ON "inspirasi_event_rsvps"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspirasi_events_slug_key" ON "inspirasi_events"("slug");

-- CreateIndex
CREATE INDEX "idx_inspirasi_events_date" ON "inspirasi_events"("event_date");

-- CreateIndex
CREATE UNIQUE INDEX "inspirasi_magazines_year_month_key" ON "inspirasi_magazines"("year", "month");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_product" ON "inventory_movements"("product_id");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_ref" ON "inventory_movements"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "idx_inventory_movements_tanggal" ON "inventory_movements"("tanggal");

-- CreateIndex
CREATE INDEX "idx_loyalty_rules_active" ON "loyalty_rules"("is_active");

-- CreateIndex
CREATE INDEX "idx_loyalty_rules_type" ON "loyalty_rules"("rule_type");

-- CreateIndex
CREATE INDEX "idx_loyalty_tx_customer" ON "loyalty_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "idx_loyalty_tx_type" ON "loyalty_transactions"("type");

-- CreateIndex
CREATE INDEX "idx_marketing_recipients_campaign" ON "marketing_campaign_recipients"("campaign_id");

-- CreateIndex
CREATE INDEX "idx_marketing_recipients_status" ON "marketing_campaign_recipients"("status");

-- CreateIndex
CREATE INDEX "idx_marketing_campaigns_channel" ON "marketing_campaigns"("channel");

-- CreateIndex
CREATE INDEX "idx_marketing_campaigns_scheduled" ON "marketing_campaigns"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_marketing_campaigns_status" ON "marketing_campaigns"("status");

-- CreateIndex
CREATE INDEX "idx_marketing_credit_channel" ON "marketing_credit_ledger"("channel");

-- CreateIndex
CREATE INDEX "idx_marketing_templates_channel" ON "marketing_templates"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_connections_provider_key" ON "marketplace_connections"("provider");

-- CreateIndex
CREATE INDEX "idx_marketplace_overrides_product" ON "marketplace_product_overrides"("product_id");

-- CreateIndex
CREATE INDEX "idx_marketplace_overrides_provider" ON "marketplace_product_overrides"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_product_overrides_provider_product_id_key" ON "marketplace_product_overrides"("provider", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_prefs_user_id_event_key_key" ON "notification_prefs"("user_id", "event_key");

-- CreateIndex
CREATE INDEX "idx_online_order_items_order" ON "online_order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "online_orders_ref_no_key" ON "online_orders"("ref_no");

-- CreateIndex
CREATE INDEX "idx_online_orders_channel" ON "online_orders"("channel");

-- CreateIndex
CREATE INDEX "idx_online_orders_created" ON "online_orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_online_orders_status" ON "online_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_code_key" ON "outlets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_password_reset_user" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_ref_no_key" ON "payroll_runs"("ref_no");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_structures_name_key" ON "payroll_structures"("name");

-- CreateIndex
CREATE INDEX "idx_payslips_employee" ON "payslips"("employee_id");

-- CreateIndex
CREATE INDEX "idx_payslips_run" ON "payslips"("payroll_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_overrides_employee_id_permission_key_key" ON "permission_overrides"("employee_id", "permission_key");

-- CreateIndex
CREATE INDEX "idx_product_recipe_product" ON "product_recipe_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_variants_product" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_promos_active" ON "promos"("is_active");

-- CreateIndex
CREATE INDEX "idx_promos_type" ON "promos"("promo_type");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_schedule_date" ON "schedule_assignments"("schedule_date");

-- CreateIndex
CREATE INDEX "idx_schedule_employee" ON "schedule_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_assignments_employee_id_schedule_date_key" ON "schedule_assignments"("employee_id", "schedule_date");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_name_key" ON "shifts"("name");

-- CreateIndex
CREATE INDEX "idx_staff_active" ON "staff"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_kode_key" ON "stock_opname"("kode");

-- CreateIndex
CREATE INDEX "idx_stock_opname_status" ON "stock_opname"("status");

-- CreateIndex
CREATE INDEX "idx_stock_opname_items_opname" ON "stock_opname_items"("opname_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_items_opname_id_product_id_key" ON "stock_opname_items"("opname_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_cart_items_cart_id_product_id_key" ON "supplies_cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_carts_user_id_key" ON "supplies_carts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_categories_slug_key" ON "supplies_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_orders_order_no_key" ON "supplies_orders"("order_no");

-- CreateIndex
CREATE INDEX "idx_supplies_orders_user" ON "supplies_orders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplies_products_sku_key" ON "supplies_products"("sku");

-- CreateIndex
CREATE INDEX "idx_supplies_products_category" ON "supplies_products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_code_key" ON "tax_rates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "terminals_code_key" ON "terminals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_invoice_number_key" ON "transactions"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "uoms_code_key" ON "uoms"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "appointment_resources"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_delivery_order_items" ADD CONSTRAINT "b2b_delivery_order_items_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "b2b_delivery_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_delivery_order_items" ADD CONSTRAINT "b2b_delivery_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_delivery_order_items" ADD CONSTRAINT "b2b_delivery_order_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "b2b_sales_order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_delivery_orders" ADD CONSTRAINT "b2b_delivery_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_delivery_orders" ADD CONSTRAINT "b2b_delivery_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_delivery_orders" ADD CONSTRAINT "b2b_delivery_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "b2b_sales_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_invoice_items" ADD CONSTRAINT "b2b_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "b2b_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_invoice_items" ADD CONSTRAINT "b2b_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_invoice_items" ADD CONSTRAINT "b2b_invoice_items_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "b2b_sales_order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_invoices" ADD CONSTRAINT "b2b_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_invoices" ADD CONSTRAINT "b2b_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_invoices" ADD CONSTRAINT "b2b_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "b2b_sales_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_quotation_items" ADD CONSTRAINT "b2b_quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_quotation_items" ADD CONSTRAINT "b2b_quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "b2b_quotations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_quotations" ADD CONSTRAINT "b2b_quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_quotations" ADD CONSTRAINT "b2b_quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_receipts" ADD CONSTRAINT "b2b_receipts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "cash_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_receipts" ADD CONSTRAINT "b2b_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_receipts" ADD CONSTRAINT "b2b_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_receipts" ADD CONSTRAINT "b2b_receipts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "b2b_invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_sales_order_items" ADD CONSTRAINT "b2b_sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_sales_order_items" ADD CONSTRAINT "b2b_sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "b2b_sales_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_sales_orders" ADD CONSTRAINT "b2b_sales_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_sales_orders" ADD CONSTRAINT "b2b_sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "b2b_sales_orders" ADD CONSTRAINT "b2b_sales_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "b2b_quotations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "capital_applications" ADD CONSTRAINT "capital_applications_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "cash_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_account_to_id_fkey" FOREIGN KEY ("account_to_id") REFERENCES "cash_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_commission_group_id_fkey" FOREIGN KEY ("commission_group_id") REFERENCES "commission_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "commission_assignments" ADD CONSTRAINT "commission_assignments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_assigned_customer_id_fkey" FOREIGN KEY ("assigned_customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_tag_map" ADD CONSTRAINT "customer_tag_map_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_tag_map" ADD CONSTRAINT "customer_tag_map_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "customer_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_expenses" ADD CONSTRAINT "gl_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_expenses" ADD CONSTRAINT "gl_expenses_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_expenses" ADD CONSTRAINT "gl_expenses_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "gl_journals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_expenses" ADD CONSTRAINT "gl_expenses_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_expenses" ADD CONSTRAINT "gl_expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "gl_vendors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_asset_depreciations" ADD CONSTRAINT "gl_fixed_asset_depreciations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "gl_fixed_assets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_asset_depreciations" ADD CONSTRAINT "gl_fixed_asset_depreciations_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "gl_journals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_asset_disposals" ADD CONSTRAINT "gl_fixed_asset_disposals_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "gl_fixed_assets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_asset_disposals" ADD CONSTRAINT "gl_fixed_asset_disposals_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "gl_journals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_asset_disposals" ADD CONSTRAINT "gl_fixed_asset_disposals_proceeds_account_id_fkey" FOREIGN KEY ("proceeds_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_accum_dep_account_id_fkey" FOREIGN KEY ("accum_dep_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_acquisition_journal_id_fkey" FOREIGN KEY ("acquisition_journal_id") REFERENCES "gl_journals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_dep_expense_account_id_fkey" FOREIGN KEY ("dep_expense_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_fixed_assets" ADD CONSTRAINT "gl_fixed_assets_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "gl_vendors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_incomes" ADD CONSTRAINT "gl_incomes_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_incomes" ADD CONSTRAINT "gl_incomes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_incomes" ADD CONSTRAINT "gl_incomes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_incomes" ADD CONSTRAINT "gl_incomes_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "gl_journals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_incomes" ADD CONSTRAINT "gl_incomes_revenue_account_id_fkey" FOREIGN KEY ("revenue_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "gl_journals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_journals" ADD CONSTRAINT "gl_journals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_recurring_bills" ADD CONSTRAINT "gl_recurring_bills_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_recurring_bills" ADD CONSTRAINT "gl_recurring_bills_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_recurring_bills" ADD CONSTRAINT "gl_recurring_bills_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "gl_vendors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gl_vendors" ADD CONSTRAINT "gl_vendors_default_account_id_fkey" FOREIGN KEY ("default_account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_feedback" ADD CONSTRAINT "help_feedback_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inspirasi_event_rsvps" ADD CONSTRAINT "inspirasi_event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "inspirasi_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inspirasi_event_rsvps" ADD CONSTRAINT "inspirasi_event_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "loyalty_rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_campaign_recipients" ADD CONSTRAINT "marketing_campaign_recipients_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "marketing_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_credit_ledger" ADD CONSTRAINT "marketing_credit_ledger_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_credit_ledger" ADD CONSTRAINT "marketing_credit_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketplace_product_overrides" ADD CONSTRAINT "marketplace_product_overrides_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "online_order_items" ADD CONSTRAINT "online_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "online_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "online_order_items" ADD CONSTRAINT "online_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "outlet_floor_plans" ADD CONSTRAINT "outlet_floor_plans_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "gl_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permission_overrides" ADD CONSTRAINT "permission_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_recipe_items" ADD CONSTRAINT "product_recipe_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_recipe_items" ADD CONSTRAINT "product_recipe_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_fkey" FOREIGN KEY ("replaced_by") REFERENCES "refresh_tokens"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_swaps" ADD CONSTRAINT "schedule_swaps_partner_assignment_id_fkey" FOREIGN KEY ("partner_assignment_id") REFERENCES "schedule_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_swaps" ADD CONSTRAINT "schedule_swaps_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_swaps" ADD CONSTRAINT "schedule_swaps_requester_assignment_id_fkey" FOREIGN KEY ("requester_assignment_id") REFERENCES "schedule_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "schedule_swaps" ADD CONSTRAINT "schedule_swaps_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_applications" ADD CONSTRAINT "service_applications_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_opname_id_fkey" FOREIGN KEY ("opname_id") REFERENCES "stock_opname"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_cart_items" ADD CONSTRAINT "supplies_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "supplies_carts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_cart_items" ADD CONSTRAINT "supplies_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supplies_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_carts" ADD CONSTRAINT "supplies_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_order_items" ADD CONSTRAINT "supplies_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supplies_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_order_items" ADD CONSTRAINT "supplies_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supplies_products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_orders" ADD CONSTRAINT "supplies_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "supplies_products" ADD CONSTRAINT "supplies_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "supplies_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_paired_user_id_fkey" FOREIGN KEY ("paired_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "uoms" ADD CONSTRAINT "uoms_base_uom_id_fkey" FOREIGN KEY ("base_uom_id") REFERENCES "uoms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
