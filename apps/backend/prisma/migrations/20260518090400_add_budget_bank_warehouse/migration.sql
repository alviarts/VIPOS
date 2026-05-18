-- CreateTable: budgets
CREATE TABLE "budgets" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "budgets_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: budget_items
CREATE TABLE "budget_items" (
    "id" SERIAL PRIMARY KEY,
    "budget_id" INTEGER NOT NULL,
    "account_id" INTEGER,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "actual_amount" DOUBLE PRECISION DEFAULT 0,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "budget_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "budget_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "gl_accounts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "budget_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: bank_reconciliations
CREATE TABLE "bank_reconciliations" (
    "id" SERIAL PRIMARY KEY,
    "account_id" INTEGER NOT NULL,
    "statement_date" TIMESTAMPTZ(6) NOT NULL,
    "statement_balance" DOUBLE PRECISION NOT NULL,
    "book_balance" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "bank_reconciliations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "gl_accounts" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "bank_reconciliations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "bank_reconciliations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: bank_reconciliation_items
CREATE TABLE "bank_reconciliation_items" (
    "id" SERIAL PRIMARY KEY,
    "reconciliation_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "is_matched" INTEGER NOT NULL DEFAULT 0,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "bank_reconciliation_items_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "bank_reconciliations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "bank_reconciliation_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: warehouses
CREATE TABLE "warehouses" (
    "id" SERIAL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "warehouses_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: warehouse_stock
CREATE TABLE "warehouse_stock" (
    "id" SERIAL PRIMARY KEY,
    "warehouse_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "warehouse_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "warehouse_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "warehouse_stock_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX "idx_budgets_tenant" ON "budgets"("tenant_id");
CREATE INDEX "idx_budgets_period" ON "budgets"("period_start", "period_end");

CREATE INDEX "idx_budget_items_tenant" ON "budget_items"("tenant_id");
CREATE INDEX "idx_budget_items_budget" ON "budget_items"("budget_id");

CREATE INDEX "idx_bank_reconciliations_tenant" ON "bank_reconciliations"("tenant_id");
CREATE INDEX "idx_bank_reconciliations_account" ON "bank_reconciliations"("account_id");
CREATE INDEX "idx_bank_reconciliations_status" ON "bank_reconciliations"("status");

CREATE INDEX "idx_bank_reconciliation_items_tenant" ON "bank_reconciliation_items"("tenant_id");
CREATE INDEX "idx_bank_reconciliation_items_reconciliation" ON "bank_reconciliation_items"("reconciliation_id");

CREATE UNIQUE INDEX "warehouses_tenant_id_code_key" ON "warehouses"("tenant_id", "code");
CREATE INDEX "idx_warehouses_tenant" ON "warehouses"("tenant_id");

CREATE UNIQUE INDEX "warehouse_stock_tenant_id_warehouse_id_product_id_key" ON "warehouse_stock"("tenant_id", "warehouse_id", "product_id");
CREATE INDEX "idx_warehouse_stock_tenant" ON "warehouse_stock"("tenant_id");
CREATE INDEX "idx_warehouse_stock_warehouse" ON "warehouse_stock"("warehouse_id");
CREATE INDEX "idx_warehouse_stock_product" ON "warehouse_stock"("product_id");
