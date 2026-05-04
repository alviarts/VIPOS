// P1-17 — Reports (Laporan).
//
// Schemas untuk endpoint /api/v1/reports/* + report scheduler (Prime+).
// Filter standar: date range (from, to), outlet, kasir, channel, kategori.
// Format: csv|xlsx|pdf|json (export dilakukan di client; backend hanya kirim
// JSON, tapi schema kita siapkan kalau ke depan butuh server-side rendering).

import { z, registry } from '../openapi';
import { DateOnlySchema, ErrorResponseSchema } from './common';

// ---------------------------------------------------------------------------
// Filter umum
// ---------------------------------------------------------------------------

export const ReportFilterQuerySchema = z
  .object({
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
    outlet_id: z.coerce.number().int().positive().optional(),
    cashier_id: z.coerce.number().int().positive().optional(),
    payment_method: z.string().optional(),
    category_id: z.coerce.number().int().positive().optional(),
    department_id: z.coerce.number().int().positive().optional(),
    product_id: z.coerce.number().int().positive().optional(),
    customer_id: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    group_by: z.enum(['day', 'week', 'month']).optional(),
  })
  .openapi('ReportFilterQuery');

export type ReportFilterQuery = z.infer<typeof ReportFilterQuerySchema>;

// ---------------------------------------------------------------------------
// Report metadata — daftar report yang available
// ---------------------------------------------------------------------------

export const REPORT_KEYS = [
  // Sales
  'sales-summary',
  'sales-detail',
  'sales-daily',
  'sales-by-outlet',
  'sales-by-category',
  'sales-by-department',
  'sales-by-product',
  'sales-by-cashier',
  'sales-by-payment-method',
  // Cash & shift
  'cash-drawer',
  'shift-close',
  // Adjustments
  'void',
  'refund',
  'promo',
  'loyalty',
  'coupon',
  // Tax & customer
  'tax',
  'customer',
  // Inventory
  'inventory-stock',
  'inventory-movement',
  'inventory-turnover',
  'inventory-value',
  // Employee
  'employee-attendance',
  'employee-shift',
  'employee-commission',
  // Financial (delegate ke /api/v1/financial-report; expose di hub)
  'financial-pnl',
  'financial-balance-sheet',
  'financial-cashflow',
  // Marketing (placeholder kalau campaign belum tersedia)
  'marketing-campaign',
] as const;

export const ReportKeySchema = z.enum(REPORT_KEYS).openapi('ReportKey');
export type ReportKey = (typeof REPORT_KEYS)[number];

// ---------------------------------------------------------------------------
// Sales summary response (dipakai sebagai contoh shape JSON return)
// ---------------------------------------------------------------------------

export const SalesSummaryResponseSchema = z
  .object({
    period: z.object({
      from: z.string(),
      to: z.string(),
    }),
    kpi: z.object({
      gross_revenue: z.number(),
      discount: z.number(),
      tax: z.number(),
      service_charge: z.number(),
      net_revenue: z.number(),
      transaction_count: z.number().int(),
      avg_ticket: z.number(),
      item_count: z.number().int(),
      unique_customers: z.number().int(),
      voided_count: z.number().int(),
      voided_value: z.number(),
    }),
    daily_trend: z.array(
      z.object({
        date: z.string(),
        revenue: z.number(),
        transactions: z.number().int(),
      })
    ),
    top_products: z.array(
      z.object({
        product_id: z.number().int().nullable(),
        product_name: z.string(),
        qty: z.number(),
        revenue: z.number(),
      })
    ),
    payment_breakdown: z.array(
      z.object({
        method: z.string(),
        count: z.number().int(),
        total: z.number(),
      })
    ),
  })
  .openapi('SalesSummaryResponse');

export type SalesSummaryResponse = z.infer<typeof SalesSummaryResponseSchema>;

// ---------------------------------------------------------------------------
// Schedule report (Prime+)
// ---------------------------------------------------------------------------

export const ReportFrequencySchema = z
  .enum(['daily', 'weekly', 'monthly'])
  .openapi('ReportFrequency');

export const ReportScheduleSchema = z
  .object({
    id: z.number().int().positive(),
    report_key: ReportKeySchema,
    name: z.string(),
    params_json: z.string().nullable(),
    frequency: ReportFrequencySchema,
    recipients: z.string().nullable(),
    format: z.enum(['csv', 'xlsx', 'pdf']).default('pdf'),
    is_active: z.union([z.literal(0), z.literal(1)]),
    last_run_at: z.string().nullable(),
    created_by: z.number().int().nullable(),
    created_at: z.string().optional(),
  })
  .openapi('ReportSchedule');
export type ReportSchedule = z.infer<typeof ReportScheduleSchema>;

export const ReportScheduleCreateSchema = z
  .object({
    report_key: ReportKeySchema,
    name: z.string().min(1, 'Nama jadwal wajib diisi').max(128),
    params_json: z.string().max(2000).optional().nullable(),
    frequency: ReportFrequencySchema,
    recipients: z.string().max(512, 'Maks 512 karakter daftar penerima').optional().nullable(),
    format: z.enum(['csv', 'xlsx', 'pdf']).optional().default('pdf'),
    is_active: z.coerce.number().int().min(0).max(1).optional().default(1),
  })
  .openapi('ReportScheduleCreateRequest');
export type ReportScheduleCreate = z.infer<typeof ReportScheduleCreateSchema>;

export const ReportScheduleUpdateSchema = ReportScheduleCreateSchema.partial().openapi(
  'ReportScheduleUpdateRequest'
);
export type ReportScheduleUpdate = z.infer<typeof ReportScheduleUpdateSchema>;

// ---------------------------------------------------------------------------
// Register paths — dokumentasi OpenAPI minimal (untuk Swagger UI)
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/v1/reports/sales-summary',
  description: 'Sales summary KPI + daily trend + top products + payment breakdown.',
  tags: ['Reports'],
  request: { query: ReportFilterQuerySchema },
  responses: {
    200: {
      description: 'Sales summary',
      content: {
        'application/json': { schema: SalesSummaryResponseSchema },
      },
    },
    400: {
      description: 'Invalid filter',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/reports/schedule',
  description: 'List scheduled reports (Prime+ subscription).',
  tags: ['Reports'],
  responses: {
    200: {
      description: 'List of schedules',
      content: {
        'application/json': {
          schema: z.array(ReportScheduleSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/reports/schedule',
  description: 'Create a new scheduled report.',
  tags: ['Reports'],
  request: {
    body: {
      content: {
        'application/json': { schema: ReportScheduleCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: ReportScheduleSchema } },
    },
    400: {
      description: 'Invalid payload',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
