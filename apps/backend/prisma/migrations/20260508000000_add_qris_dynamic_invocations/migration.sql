-- CreateTable
CREATE TABLE "qris_dynamic_invocations" (
    "id" BIGSERIAL NOT NULL,
    "ref_id" VARCHAR(64) NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant'::text, true))::integer,
    "user_id" INTEGER,
    "amount" BIGINT NOT NULL,
    "transaction_id" INTEGER,
    "status" VARCHAR(16) NOT NULL DEFAULT 'AWAITING',
    "qr_code_url" TEXT,
    "polling_url" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qris_dynamic_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qris_dynamic_invocations_ref_id_key" ON "qris_dynamic_invocations"("ref_id");

-- CreateIndex
CREATE INDEX "idx_qris_invocations_tenant_created" ON "qris_dynamic_invocations"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_qris_invocations_tenant_status" ON "qris_dynamic_invocations"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "qris_dynamic_invocations" ADD CONSTRAINT "qris_invocations_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Enable RLS (consistent with existing tables)
ALTER TABLE "qris_dynamic_invocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qris_dynamic_invocations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "qris_dynamic_invocations"
    USING (tenant_id = (current_setting('app.current_tenant', true))::integer);
