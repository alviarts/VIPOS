-- CreateTable: product_recipes
CREATE TABLE "product_recipes" (
    "id" SERIAL PRIMARY KEY,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "yield_quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "yield_unit" TEXT NOT NULL DEFAULT 'pcs',
    "cost_per_unit" DOUBLE PRECISION DEFAULT 0,
    "preparation_time" INTEGER DEFAULT 0,
    "cooking_time" INTEGER DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "product_recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "product_recipes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "product_recipes_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: recipe_ingredients
CREATE TABLE "recipe_ingredients" (
    "id" SERIAL PRIMARY KEY,
    "recipe_id" INTEGER NOT NULL,
    "ingredient_product_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "cost" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "sort_order" INTEGER DEFAULT 0,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "product_recipes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "recipe_ingredients_ingredient_product_id_fkey" FOREIGN KEY ("ingredient_product_id") REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "recipe_ingredients_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateTable: recipe_steps
CREATE TABLE "recipe_steps" (
    "id" SERIAL PRIMARY KEY,
    "recipe_id" INTEGER NOT NULL,
    "step_number" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "duration_minutes" INTEGER DEFAULT 0,
    "image_url" TEXT,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant', true)::integer),
    CONSTRAINT "recipe_steps_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "product_recipes" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "recipe_steps_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "product_recipes_tenant_id_product_id_version_key" ON "product_recipes"("tenant_id", "product_id", "version");
CREATE INDEX "idx_product_recipes_tenant" ON "product_recipes"("tenant_id");
CREATE INDEX "idx_product_recipes_product" ON "product_recipes"("product_id");

CREATE INDEX "idx_recipe_ingredients_tenant" ON "recipe_ingredients"("tenant_id");
CREATE INDEX "idx_recipe_ingredients_recipe" ON "recipe_ingredients"("recipe_id");

CREATE UNIQUE INDEX "recipe_steps_recipe_id_step_number_key" ON "recipe_steps"("recipe_id", "step_number");
CREATE INDEX "idx_recipe_steps_tenant" ON "recipe_steps"("tenant_id");
CREATE INDEX "idx_recipe_steps_recipe" ON "recipe_steps"("recipe_id");
