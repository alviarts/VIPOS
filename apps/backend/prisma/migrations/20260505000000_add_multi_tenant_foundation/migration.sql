-- P2-02 Multi-tenant foundation: introduce tenants + tenant_users join table
-- and add tenant_id to users. Existing data is backfilled into a single
-- "default" tenant (id=1) so the upgrade is non-destructive.

-- 1. tenants table
CREATE TABLE "tenants" (
  "id"          SERIAL          PRIMARY KEY,
  "slug"        TEXT            NOT NULL,
  "name"        TEXT            NOT NULL,
  "tier"        TEXT            NOT NULL DEFAULT 'lite',
  "status"      TEXT            NOT NULL DEFAULT 'active',
  "metadata"    JSONB,
  "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- 2. seed default tenant for existing data so we can backfill users.tenant_id
INSERT INTO "tenants" ("id", "slug", "name", "tier", "status")
VALUES (1, 'default', 'Default Tenant', 'advance', 'active');

-- align serial cursor so future inserts don't collide with id=1
SELECT setval(pg_get_serial_sequence('tenants', 'id'), 1, true);

-- 3. tenant_users mapping table (supports multi-tenant users in the future,
--    e.g. a support engineer impersonating multiple merchants).
CREATE TABLE "tenant_users" (
  "id"          SERIAL          PRIMARY KEY,
  "tenant_id"   INTEGER         NOT NULL,
  "user_id"     INTEGER         NOT NULL,
  "role"        TEXT            NOT NULL DEFAULT 'member',
  "is_default"  BOOLEAN         NOT NULL DEFAULT FALSE,
  "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_users_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "tenant_users_user_fk"
    FOREIGN KEY ("user_id")   REFERENCES "users"("id")   ON DELETE CASCADE
);
CREATE UNIQUE INDEX "tenant_users_tenant_user_key"
  ON "tenant_users"("tenant_id", "user_id");
CREATE INDEX "idx_tenant_users_user" ON "tenant_users"("user_id");

-- 4. users.tenant_id (NOT NULL, FK -> tenants.id). Default 1 used for backfill;
--    after migration we drop the default so future inserts must specify it.
ALTER TABLE "users"
  ADD COLUMN "tenant_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users"
  ADD CONSTRAINT "users_tenant_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT;
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP DEFAULT;
CREATE INDEX "idx_users_tenant" ON "users"("tenant_id");

-- 5. backfill tenant_users mapping for existing users (1 row per user, default).
INSERT INTO "tenant_users" ("tenant_id", "user_id", "role", "is_default")
SELECT u."tenant_id", u."id", COALESCE(u."role", 'cashier'), TRUE
FROM "users" u;
