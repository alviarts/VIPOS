-- P3-14: Cashier shift sessions + cash movements

-- CreateTable: cashier_shifts
CREATE TABLE "cashier_shifts" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant'::text, true))::integer,
    "user_id" INTEGER NOT NULL,
    "opening_cash" BIGINT NOT NULL DEFAULT 0,
    "closing_cash_counted" BIGINT,
    "closing_cash_expected" BIGINT,
    "variance" BIGINT,
    "variance_reason" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cashier_shift_cash_movements
CREATE TABLE "cashier_shift_cash_movements" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT (current_setting('app.current_tenant'::text, true))::integer,
    "cashier_shift_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "amount" BIGINT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashier_shift_cash_movements_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add cashier_shift_id to transactions
ALTER TABLE "transactions" ADD COLUMN "cashier_shift_id" INTEGER;

-- CreateIndexes
CREATE INDEX "idx_cashier_shifts_tenant_status" ON "cashier_shifts"("tenant_id", "status");
CREATE INDEX "idx_cashier_shifts_tenant_user" ON "cashier_shifts"("tenant_id", "user_id", "opened_at" DESC);
CREATE INDEX "idx_cash_movements_shift" ON "cashier_shift_cash_movements"("cashier_shift_id");
CREATE INDEX "idx_cash_movements_tenant_created" ON "cashier_shift_cash_movements"("tenant_id", "created_at" DESC);
CREATE INDEX "idx_transactions_cashier_shift" ON "transactions"("cashier_shift_id");

-- AddForeignKeys
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "cashier_shift_cash_movements" ADD CONSTRAINT "cash_movements_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "cashier_shift_cash_movements" ADD CONSTRAINT "cash_movements_shift_fk" FOREIGN KEY ("cashier_shift_id") REFERENCES "cashier_shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_shift_fk" FOREIGN KEY ("cashier_shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Enable RLS
ALTER TABLE "cashier_shifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cashier_shifts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cashier_shifts"
    USING (tenant_id = (current_setting('app.current_tenant', true))::integer);

ALTER TABLE "cashier_shift_cash_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cashier_shift_cash_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cashier_shift_cash_movements"
    USING (tenant_id = (current_setting('app.current_tenant', true))::integer);
