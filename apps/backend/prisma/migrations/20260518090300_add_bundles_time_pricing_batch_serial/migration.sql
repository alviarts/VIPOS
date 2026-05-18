-- CreateTable: product_bundles
CREATE TABLE "product_bundles" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "product_bundles_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: product_bundle_items
CREATE TABLE "product_bundle_items" (
    "id" SERIAL PRIMARY KEY,
    "bundle_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "product_bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "product_bundles" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "product_bundle_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "product_bundle_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: product_time_prices
CREATE TABLE "product_time_prices" (
    "id" SERIAL PRIMARY KEY,
    "product_id" INTEGER NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "time_start" TEXT NOT NULL,
    "time_end" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "product_time_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "product_time_prices_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: product_batches
CREATE TABLE "product_batches" (
    "id" SERIAL PRIMARY KEY,
    "product_id" INTEGER NOT NULL,
    "batch_number" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "expiry_date" TIMESTAMPTZ(6),
    "received_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "product_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "product_batches_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: product_serials
CREATE TABLE "product_serials" (
    "id" SERIAL PRIMARY KEY,
    "product_id" INTEGER NOT NULL,
    "serial_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "sold_date" TIMESTAMPTZ(6),
    "transaction_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "product_serials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "product_serials_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "product_serials_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "product_bundles_tenant_id_sku_key" ON "product_bundles"("tenant_id", "sku");
CREATE INDEX "idx_product_bundles_tenant" ON "product_bundles"("tenant_id");

CREATE INDEX "idx_product_bundle_items_tenant" ON "product_bundle_items"("tenant_id");
CREATE INDEX "idx_product_bundle_items_bundle" ON "product_bundle_items"("bundle_id");

CREATE INDEX "idx_product_time_prices_tenant" ON "product_time_prices"("tenant_id");
CREATE INDEX "idx_product_time_prices_product" ON "product_time_prices"("product_id");

CREATE UNIQUE INDEX "product_batches_tenant_id_product_id_batch_number_key" ON "product_batches"("tenant_id", "product_id", "batch_number");
CREATE INDEX "idx_product_batches_tenant" ON "product_batches"("tenant_id");
CREATE INDEX "idx_product_batches_product" ON "product_batches"("product_id");
CREATE INDEX "idx_product_batches_expiry" ON "product_batches"("expiry_date");

CREATE UNIQUE INDEX "product_serials_tenant_id_serial_number_key" ON "product_serials"("tenant_id", "serial_number");
CREATE INDEX "idx_product_serials_tenant" ON "product_serials"("tenant_id");
CREATE INDEX "idx_product_serials_product" ON "product_serials"("product_id");
CREATE INDEX "idx_product_serials_status" ON "product_serials"("status");
