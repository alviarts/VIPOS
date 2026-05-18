-- CreateTable: outlet_transfers
CREATE TABLE "outlet_transfers" (
    "id" SERIAL PRIMARY KEY,
    "transfer_number" TEXT NOT NULL,
    "from_outlet_id" INTEGER NOT NULL,
    "to_outlet_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "shipping_date" TIMESTAMPTZ(6),
    "received_date" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "approved_by" INTEGER,
    "received_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "outlet_transfers_from_outlet_id_fkey" FOREIGN KEY ("from_outlet_id") REFERENCES "outlets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfers_to_outlet_id_fkey" FOREIGN KEY ("to_outlet_id") REFERENCES "outlets" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfers_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfers_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: outlet_transfer_items
CREATE TABLE "outlet_transfer_items" (
    "id" SERIAL PRIMARY KEY,
    "transfer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_cost" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "received_quantity" DOUBLE PRECISION DEFAULT 0,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "outlet_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "outlet_transfers" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfer_items_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: outlet_transfer_status_history
CREATE TABLE "outlet_transfer_status_history" (
    "id" SERIAL PRIMARY KEY,
    "transfer_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "outlet_transfer_status_history_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "outlet_transfers" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfer_status_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "outlet_transfer_status_history_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "outlet_transfers_tenant_id_transfer_number_key" ON "outlet_transfers"("tenant_id", "transfer_number");
CREATE INDEX "idx_outlet_transfers_tenant" ON "outlet_transfers"("tenant_id");
CREATE INDEX "idx_outlet_transfers_from" ON "outlet_transfers"("from_outlet_id");
CREATE INDEX "idx_outlet_transfers_to" ON "outlet_transfers"("to_outlet_id");
CREATE INDEX "idx_outlet_transfers_status" ON "outlet_transfers"("status");

CREATE INDEX "idx_outlet_transfer_items_tenant" ON "outlet_transfer_items"("tenant_id");
CREATE INDEX "idx_outlet_transfer_items_transfer" ON "outlet_transfer_items"("transfer_id");

CREATE INDEX "idx_outlet_transfer_status_history_tenant" ON "outlet_transfer_status_history"("tenant_id");
CREATE INDEX "idx_outlet_transfer_status_history_transfer" ON "outlet_transfer_status_history"("transfer_id");
