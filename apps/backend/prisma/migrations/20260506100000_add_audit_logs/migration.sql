-- P2-03 Audit logging foundation.
--
-- Records mutation + auth + permission events on important entities.
-- Stores both before and after JSON snapshots so the client can render
-- a diff. RLS enforced per-tenant so a tenant only ever sees its own
-- audit trail. Inserts inherit `tenant_id` from `app.current_tenant`
-- (the same per-transaction GUC the rest of the schema uses) so call
-- sites do not need to pass it explicitly.

CREATE TABLE "audit_logs" (
  "id"          BIGSERIAL       PRIMARY KEY,
  "tenant_id"   INTEGER         NOT NULL DEFAULT (current_setting('app.current_tenant', true))::int,
  "user_id"     INTEGER         NULL,
  "entity"      TEXT            NOT NULL,
  "entity_id"   TEXT            NULL,
  "action"      TEXT            NOT NULL,
  "before_json" JSONB           NULL,
  "after_json"  JSONB           NULL,
  "ip"          INET            NULL,
  "user_agent"  TEXT            NULL,
  "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
  CONSTRAINT "audit_logs_user_fk"   FOREIGN KEY ("user_id")   REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_audit_logs_tenant_created" ON "audit_logs" ("tenant_id", "created_at" DESC);
CREATE INDEX "idx_audit_logs_tenant_entity"  ON "audit_logs" ("tenant_id", "entity", "entity_id");
CREATE INDEX "idx_audit_logs_tenant_user"    ON "audit_logs" ("tenant_id", "user_id", "created_at" DESC);
CREATE INDEX "idx_audit_logs_tenant_action"  ON "audit_logs" ("tenant_id", "action", "created_at" DESC);

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_audit_logs" ON "audit_logs"
  FOR ALL
  USING (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  )
  WITH CHECK (
    current_setting('app.current_tenant', true) = '0'
    OR "tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::int
  );
