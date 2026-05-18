-- CreateTable: production_orders
CREATE TABLE "production_orders" (
    "id" SERIAL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "scheduled_date" TIMESTAMPTZ(6),
    "started_date" TIMESTAMPTZ(6),
    "completed_date" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "production_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "production_orders_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: production_order_materials
CREATE TABLE "production_order_materials" (
    "id" SERIAL PRIMARY KEY,
    "production_order_id" INTEGER NOT NULL,
    "material_product_id" INTEGER NOT NULL,
    "required_quantity" DOUBLE PRECISION NOT NULL,
    "used_quantity" DOUBLE PRECISION DEFAULT 0,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "production_order_materials_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "production_order_materials_material_product_id_fkey" FOREIGN KEY ("material_product_id") REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "production_order_materials_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_tenant_id_order_number_key" ON "production_orders"("tenant_id", "order_number");
CREATE INDEX "idx_production_orders_tenant" ON "production_orders"("tenant_id");
CREATE INDEX "idx_production_orders_product" ON "production_orders"("product_id");
CREATE INDEX "idx_production_orders_status" ON "production_orders"("status");
CREATE INDEX "idx_production_orders_scheduled" ON "production_orders"("scheduled_date");

CREATE INDEX "idx_production_order_materials_tenant" ON "production_order_materials"("tenant_id");
CREATE INDEX "idx_production_order_materials_order" ON "production_order_materials"("production_order_id");
