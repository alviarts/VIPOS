-- P4-09: Multi-payment support (split bill)
-- Allows a single transaction to be settled with multiple
-- payment methods (e.g. 50% cash + 50% QRIS).

CREATE TABLE "transaction_payments" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant'::text, true))::integer,
    "transaction_id" INTEGER NOT NULL,
    "payment_method" VARCHAR(32) NOT NULL,
    "amount" BIGINT NOT NULL,
    "approval_ref" TEXT,
    "qris_ref_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_payments_pkey" PRIMARY KEY ("id")
);

-- Add tip + service charge columns to transactions
ALTER TABLE "transactions" ADD COLUMN "tip_amount" BIGINT DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN "service_charge" BIGINT DEFAULT 0;

-- Indexes
CREATE INDEX "idx_tx_payments_transaction" ON "transaction_payments"("transaction_id");
CREATE INDEX "idx_tx_payments_tenant" ON "transaction_payments"("tenant_id", "created_at" DESC);

-- Foreign keys
ALTER TABLE "transaction_payments" ADD CONSTRAINT "tx_payments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "transaction_payments" ADD CONSTRAINT "tx_payments_transaction_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- RLS
ALTER TABLE "transaction_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "transaction_payments"
    USING (tenant_id = (current_setting('app.current_tenant', true))::integer);
