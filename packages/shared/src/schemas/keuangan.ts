// Schemas untuk P1-15 (Keuangan: Buku Kas + Penerimaan + Pengeluaran +
// Aset Tetap + Laporan Keuangan + Chart of Accounts).
//
// Endpoint:
//   /api/account              — Chart of Accounts CRUD + tree
//   /api/journal              — General journal (manual + system) CRUD with balance check
//   /api/cash-transfer        — Transfer between cash/bank accounts (auto-journal)
//   /api/income               — Manual income entry (auto-journal Dr Cash, Cr Revenue)
//   /api/expense              — Manual expense entry (auto-journal Dr Expense, Cr Cash)
//   /api/recurring-bill       — Recurring bill template
//   /api/vendor               — Vendor master (mitra)
//   /api/fixed-asset          — Fixed asset register + depreciation + disposal
//   /api/financial-report     — 7 standard reports (jurnal/neraca/laba-rugi/buku-besar/arus-kas/hutang/piutang)

import { z, registry } from "../openapi";
import { DateOnlySchema, ErrorResponseSchema, IdStringSchema } from "./common";

// ================== ENUMS ==================
export const GlAccountTypeSchema = z.enum([
  "ASET",
  "KEWAJIBAN",
  "MODAL",
  "PENDAPATAN",
  "BEBAN",
]);
export type GlAccountType = z.infer<typeof GlAccountTypeSchema>;

export const GlNormalBalanceSchema = z.enum(["debit", "credit"]);
export type GlNormalBalance = z.infer<typeof GlNormalBalanceSchema>;

export const GlJournalSourceTypeSchema = z.enum([
  "manual",
  "sale",
  "income",
  "expense",
  "transfer",
  "payroll",
  "depreciation",
  "disposal",
  "opening",
]);

export const RecurringFrequencySchema = z.enum([
  "monthly",
  "quarterly",
  "annually",
]);

export const DepreciationMethodSchema = z.enum([
  "STRAIGHT_LINE",
  "DOUBLE_DECLINING",
]);

export const FixedAssetStatusSchema = z.enum(["active", "disposed"]);

export const DisposalTypeSchema = z.enum([
  "SOLD",
  "SCRAPPED",
  "DONATED",
  "LOST",
]);

// ================== CHART OF ACCOUNTS ==================
export const GlAccountSchema = z
  .object({
    id: z.number().int().positive(),
    code: z.string(),
    name: z.string(),
    type: GlAccountTypeSchema,
    subtype: z.string().nullable(),
    parent_id: z.number().int().nullable(),
    normal_balance: GlNormalBalanceSchema,
    opening_balance: z.number(),
    is_active: z.union([z.literal(0), z.literal(1)]),
    description: z.string().nullable(),
  })
  .openapi("GlAccount");
export type GlAccount = z.infer<typeof GlAccountSchema>;

export const GlAccountCreateSchema = z
  .object({
    code: z.string().min(1).max(16),
    name: z.string().min(1).max(128),
    type: GlAccountTypeSchema,
    subtype: z.string().max(64).optional().nullable(),
    parent_id: z.coerce.number().int().positive().optional().nullable(),
    opening_balance: z.coerce.number().optional().default(0),
    description: z.string().max(512).optional().nullable(),
    is_active: z.coerce.number().int().min(0).max(1).optional().default(1),
  })
  .openapi("GlAccountCreateRequest");
export type GlAccountCreate = z.infer<typeof GlAccountCreateSchema>;

export const GlAccountUpdateSchema = GlAccountCreateSchema.partial().openapi(
  "GlAccountUpdateRequest"
);
export type GlAccountUpdate = z.infer<typeof GlAccountUpdateSchema>;

// ================== JOURNAL ==================
export const GlJournalLineCreateSchema = z
  .object({
    account_id: z.coerce.number().int().positive(),
    debit: z.coerce.number().nonnegative().optional().default(0),
    credit: z.coerce.number().nonnegative().optional().default(0),
    description: z.string().max(256).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.debit > 0 && v.credit > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debit"],
        message: "Line tidak boleh punya debit DAN credit sekaligus",
      });
    }
    if ((v.debit ?? 0) === 0 && (v.credit ?? 0) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debit"],
        message: "Line harus punya debit ATAU credit > 0",
      });
    }
  });

export const GlJournalCreateSchema = z
  .object({
    journal_date: DateOnlySchema,
    description: z.string().max(512).optional().nullable(),
    source_type: GlJournalSourceTypeSchema.optional().default("manual"),
    lines: z.array(GlJournalLineCreateSchema).min(2),
  })
  .superRefine((v, ctx) => {
    const totalDebit = v.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredit = v.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: `Total debit (${totalDebit}) harus sama dengan total credit (${totalCredit})`,
      });
    }
  })
  .openapi("GlJournalCreateRequest");
export type GlJournalCreate = z.infer<typeof GlJournalCreateSchema>;

// ================== CASH TRANSFER ==================
export const CashTransferCreateSchema = z
  .object({
    transfer_date: DateOnlySchema,
    from_account_id: z.coerce.number().int().positive(),
    to_account_id: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    fee: z.coerce.number().nonnegative().optional().default(0),
    fee_account_id: z.coerce.number().int().positive().optional().nullable(),
    description: z.string().max(512).optional().nullable(),
    reference: z.string().max(128).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.from_account_id === v.to_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to_account_id"],
        message: "Akun asal & tujuan harus berbeda",
      });
    }
    if ((v.fee ?? 0) > 0 && !v.fee_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fee_account_id"],
        message: "fee_account_id wajib jika fee > 0",
      });
    }
  })
  .openapi("CashTransferCreateRequest");
export type CashTransferCreate = z.infer<typeof CashTransferCreateSchema>;

// ================== INCOME ==================
export const IncomeCreateSchema = z
  .object({
    income_date: DateOnlySchema,
    source_type: z.enum(["customer", "other"]).optional().default("other"),
    customer_id: z.coerce.number().int().positive().optional().nullable(),
    source_other: z.string().max(256).optional().nullable(),
    category: z.string().max(64).optional().nullable(),
    amount: z.coerce.number().positive(),
    cash_account_id: z.coerce.number().int().positive(),
    revenue_account_id: z.coerce.number().int().positive(),
    tax_amount: z.coerce.number().nonnegative().optional().default(0),
    description: z.string().max(512).optional().nullable(),
    attachment: z.string().url().optional().nullable(),
  })
  .openapi("IncomeCreateRequest");
export type IncomeCreate = z.infer<typeof IncomeCreateSchema>;

// ================== EXPENSE ==================
export const ExpenseCreateSchema = z
  .object({
    expense_date: DateOnlySchema,
    vendor_id: z.coerce.number().int().positive().optional().nullable(),
    expense_account_id: z.coerce.number().int().positive(),
    payment_account_id: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive(),
    tax_amount: z.coerce.number().nonnegative().optional().default(0),
    description: z.string().max(512).optional().nullable(),
    attachment: z.string().url().optional().nullable(),
    is_recurring: z.coerce.number().int().min(0).max(1).optional().default(0),
  })
  .openapi("ExpenseCreateRequest");
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;

// ================== RECURRING BILL ==================
export const RecurringBillCreateSchema = z
  .object({
    name: z.string().min(1).max(128),
    vendor_id: z.coerce.number().int().positive().optional().nullable(),
    expense_account_id: z.coerce.number().int().positive(),
    payment_account_id: z.coerce.number().int().positive().optional().nullable(),
    amount: z.coerce.number().positive(),
    frequency: RecurringFrequencySchema.optional().default("monthly"),
    due_day: z.coerce.number().int().min(1).max(31),
    is_active: z.coerce.number().int().min(0).max(1).optional().default(1),
  })
  .openapi("RecurringBillCreateRequest");
export type RecurringBillCreate = z.infer<typeof RecurringBillCreateSchema>;

export const RecurringBillUpdateSchema = RecurringBillCreateSchema.partial().openapi(
  "RecurringBillUpdateRequest"
);

// ================== VENDOR ==================
export const VendorCreateSchema = z
  .object({
    code: z.string().max(32).optional().nullable(),
    name: z.string().min(1).max(128),
    npwp: z.string().max(32).optional().nullable(),
    address: z.string().max(512).optional().nullable(),
    phone: z.string().max(32).optional().nullable(),
    email: z.string().email().optional().nullable(),
    bank_name: z.string().max(64).optional().nullable(),
    bank_account_no: z.string().max(64).optional().nullable(),
    bank_account_holder: z.string().max(128).optional().nullable(),
    default_account_id: z.coerce.number().int().positive().optional().nullable(),
    payment_terms_days: z.coerce.number().int().min(0).max(365).optional().default(0),
    is_active: z.coerce.number().int().min(0).max(1).optional().default(1),
    note: z.string().max(512).optional().nullable(),
  })
  .openapi("VendorCreateRequest");
export type VendorCreate = z.infer<typeof VendorCreateSchema>;

export const VendorUpdateSchema = VendorCreateSchema.partial().openapi(
  "VendorUpdateRequest"
);

// ================== FIXED ASSET ==================
export const FixedAssetCreateSchema = z
  .object({
    name: z.string().min(1).max(128),
    category: z.string().max(64).optional().nullable(),
    acquisition_date: DateOnlySchema,
    cost: z.coerce.number().positive(),
    useful_life_years: z.coerce.number().int().min(1).max(50),
    salvage_value: z.coerce.number().nonnegative().optional().default(0),
    depreciation_method: DepreciationMethodSchema.optional().default(
      "STRAIGHT_LINE"
    ),
    location: z.string().max(128).optional().nullable(),
    vendor_id: z.coerce.number().int().positive().optional().nullable(),
    photo_url: z.string().url().optional().nullable(),
    asset_account_id: z.coerce.number().int().positive(),
    accum_dep_account_id: z.coerce.number().int().positive(),
    dep_expense_account_id: z.coerce.number().int().positive(),
    payment_account_id: z.coerce.number().int().positive().optional().nullable(),
  })
  .openapi("FixedAssetCreateRequest");
export type FixedAssetCreate = z.infer<typeof FixedAssetCreateSchema>;

export const FixedAssetUpdateSchema = FixedAssetCreateSchema.partial().openapi(
  "FixedAssetUpdateRequest"
);

export const DepreciationRunSchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    asset_ids: z.array(z.coerce.number().int().positive()).optional(),
  })
  .openapi("DepreciationRunRequest");
export type DepreciationRun = z.infer<typeof DepreciationRunSchema>;

export const FixedAssetDisposalSchema = z
  .object({
    disposal_date: DateOnlySchema,
    disposal_type: DisposalTypeSchema,
    proceeds: z.coerce.number().nonnegative().optional().default(0),
    proceeds_account_id: z.coerce.number().int().positive().optional().nullable(),
    buyer: z.string().max(128).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.disposal_type === "SOLD" && v.proceeds <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proceeds"],
        message: "proceeds wajib > 0 untuk disposal_type=SOLD",
      });
    }
    if (v.proceeds > 0 && !v.proceeds_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proceeds_account_id"],
        message: "proceeds_account_id wajib jika proceeds > 0",
      });
    }
  })
  .openapi("FixedAssetDisposalRequest");
export type FixedAssetDisposal = z.infer<typeof FixedAssetDisposalSchema>;

// --- OpenAPI path registrations (sample for keuangan; full set covered by routes) ---

registry.registerPath({
  method: "get",
  path: "/api/account",
  description: "List Chart of Accounts (optionally filter by type).",
  tags: ["Keuangan"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ type: GlAccountTypeSchema.optional() }),
  },
  responses: {
    200: {
      description: "Array akun.",
      content: { "application/json": { schema: z.array(GlAccountSchema) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/account",
  description: "Buat akun CoA baru.",
  tags: ["Keuangan"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: GlAccountCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Akun dibuat.",
      content: { "application/json": { schema: GlAccountSchema } },
    },
    400: {
      description: "Validation error.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/journal",
  description:
    "Post manual general journal. Total debit harus sama dengan total credit (validasi).",
  tags: ["Keuangan"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: GlJournalCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Journal posted.",
      content: { "application/json": { schema: z.any() } },
    },
    400: {
      description: "Unbalanced or invalid.",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/financial-report/balance-sheet",
  description: "Laporan Neraca per as_of date (defaults to today).",
  tags: ["Keuangan"],
  security: [{ bearerAuth: [] }],
  request: { query: z.object({ as_of: DateOnlySchema.optional() }) },
  responses: {
    200: {
      description: "Balance sheet structure.",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/financial-report/income-statement",
  description: "Laporan Laba Rugi periode (from..to).",
  tags: ["Keuangan"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ from: DateOnlySchema, to: DateOnlySchema }),
  },
  responses: {
    200: {
      description: "Income statement structure.",
      content: { "application/json": { schema: z.any() } },
    },
  },
});

// Re-export OpenAPI helper namespace for callers — IdStringSchema used in path params.
export const _IdStringSchema = IdStringSchema;
