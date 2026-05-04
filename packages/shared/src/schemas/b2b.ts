// Schemas untuk endpoint /api/v1/quotation, /api/v1/sales-order, /api/v1/delivery-order,
// /api/v1/invoice, /api/v1/receipt + /api/v1/aging-report (P1-10 Invoice B2B 5-stage).

import { z, registry } from '../openapi';
import {
  DateOnlySchema,
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from './common';

export const QuotationStatusSchema = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']);
export const SalesOrderStatusSchema = z.enum(['NEW', 'PARTIAL', 'FULFILLED', 'CANCELLED']);
export const DeliveryOrderStatusSchema = z.enum([
  'PREPARING',
  'IN_TRANSIT',
  'DELIVERED',
  'RETURNED',
]);
export const InvoiceStatusSchema = z.enum(['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']);
export const PaymentMethodSchema = z.enum(['cash', 'transfer', 'cheque']);

const baseItem = {
  product_id: z.number().int().nullable().optional(),
  product_name: z.string().min(1),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
};

export const B2BItemSchema = z.object({
  id: z.number().int().optional(),
  ...baseItem,
  subtotal: z.number().nonnegative().optional(),
});
export type B2BItem = z.infer<typeof B2BItemSchema>;

export const B2BItemCreateSchema = z.object({
  product_id: z.coerce.number().int().nullable().optional(),
  product_name: z.string().min(1),
  qty: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
});

// ---------- QUOTATION ----------
export const QuotationSchema = z
  .object({
    id: z.number().int().positive(),
    number: z.string(),
    customer_id: z.number().int().nullable(),
    customer_name: z.string(),
    quote_date: z.string(),
    valid_until: z.string().nullable(),
    status: QuotationStatusSchema,
    subtotal: z.number(),
    tax_percent: z.number(),
    tax_amount: z.number(),
    discount_amount: z.number(),
    total: z.number(),
    notes: z.string().nullable(),
    terms: z.string().nullable(),
    converted_so_id: z.number().int().nullable(),
    items: z.array(B2BItemSchema).optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Quotation');
export type Quotation = z.infer<typeof QuotationSchema>;

export const QuotationCreateSchema = z.object({
  customer_id: z.coerce.number().int().nullable().optional(),
  customer_name: z.string().min(1),
  quote_date: DateOnlySchema,
  valid_until: DateOnlySchema.nullable().optional(),
  status: QuotationStatusSchema.optional().default('DRAFT'),
  tax_percent: z.coerce.number().min(0).max(100).optional().default(0),
  discount_amount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  items: z.array(B2BItemCreateSchema).min(1, 'Minimal 1 item'),
});

export const QuotationUpdateSchema = QuotationCreateSchema.partial().extend({
  status: QuotationStatusSchema.optional(),
});

// ---------- SALES ORDER ----------
export const SalesOrderItemSchema = B2BItemSchema.extend({
  qty_delivered: z.number().nonnegative().default(0),
  qty_invoiced: z.number().nonnegative().default(0),
});
export type SalesOrderItem = z.infer<typeof SalesOrderItemSchema>;

export const SalesOrderSchema = z
  .object({
    id: z.number().int().positive(),
    number: z.string(),
    quotation_id: z.number().int().nullable(),
    customer_id: z.number().int().nullable(),
    customer_name: z.string(),
    order_date: z.string(),
    expected_delivery: z.string().nullable(),
    status: SalesOrderStatusSchema,
    subtotal: z.number(),
    tax_percent: z.number(),
    tax_amount: z.number(),
    discount_amount: z.number(),
    total: z.number(),
    notes: z.string().nullable(),
    items: z.array(SalesOrderItemSchema).optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('SalesOrder');
export type SalesOrder = z.infer<typeof SalesOrderSchema>;

export const SalesOrderCreateSchema = z.object({
  quotation_id: z.coerce.number().int().nullable().optional(),
  customer_id: z.coerce.number().int().nullable().optional(),
  customer_name: z.string().min(1),
  order_date: DateOnlySchema,
  expected_delivery: DateOnlySchema.nullable().optional(),
  status: SalesOrderStatusSchema.optional().default('NEW'),
  tax_percent: z.coerce.number().min(0).max(100).optional().default(0),
  discount_amount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().nullable().optional(),
  items: z.array(B2BItemCreateSchema).min(1, 'Minimal 1 item'),
});

export const SalesOrderUpdateSchema = SalesOrderCreateSchema.partial().extend({
  status: SalesOrderStatusSchema.optional(),
});

// ---------- DELIVERY ORDER ----------
export const DeliveryItemCreateSchema = z.object({
  sales_order_item_id: z.coerce.number().int().nullable().optional(),
  product_id: z.coerce.number().int().nullable().optional(),
  product_name: z.string().min(1),
  qty: z.coerce.number().positive(),
});

export const DeliveryItemSchema = z.object({
  id: z.number().int(),
  sales_order_item_id: z.number().int().nullable(),
  product_id: z.number().int().nullable(),
  product_name: z.string(),
  qty: z.number(),
});

export const DeliveryOrderSchema = z
  .object({
    id: z.number().int().positive(),
    number: z.string(),
    sales_order_id: z.number().int().nullable(),
    customer_id: z.number().int().nullable(),
    customer_name: z.string(),
    delivery_date: z.string(),
    expected_arrival: z.string().nullable(),
    carrier: z.string().nullable(),
    driver: z.string().nullable(),
    status: DeliveryOrderStatusSchema,
    notes: z.string().nullable(),
    signature_url: z.string().nullable(),
    stock_posted: z.union([z.literal(0), z.literal(1)]),
    items: z.array(DeliveryItemSchema).optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('DeliveryOrder');
export type DeliveryOrder = z.infer<typeof DeliveryOrderSchema>;

export const DeliveryOrderCreateSchema = z.object({
  sales_order_id: z.coerce.number().int(),
  delivery_date: DateOnlySchema,
  expected_arrival: DateOnlySchema.nullable().optional(),
  carrier: z.string().nullable().optional(),
  driver: z.string().nullable().optional(),
  status: DeliveryOrderStatusSchema.optional().default('PREPARING'),
  notes: z.string().nullable().optional(),
  signature_url: z.string().nullable().optional(),
  items: z.array(DeliveryItemCreateSchema).min(1, 'Minimal 1 item'),
});

export const DeliveryOrderUpdateSchema = z.object({
  delivery_date: DateOnlySchema.optional(),
  expected_arrival: DateOnlySchema.nullable().optional(),
  carrier: z.string().nullable().optional(),
  driver: z.string().nullable().optional(),
  status: DeliveryOrderStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  signature_url: z.string().nullable().optional(),
});

// ---------- INVOICE ----------
export const InvoiceSchema = z
  .object({
    id: z.number().int().positive(),
    number: z.string(),
    sales_order_id: z.number().int().nullable(),
    customer_id: z.number().int().nullable(),
    customer_name: z.string(),
    invoice_date: z.string(),
    due_date: z.string().nullable(),
    status: InvoiceStatusSchema,
    subtotal: z.number(),
    tax_percent: z.number(),
    tax_amount: z.number(),
    discount_amount: z.number(),
    total: z.number(),
    down_payment: z.number(),
    paid_amount: z.number(),
    outstanding: z.number(),
    notes: z.string().nullable(),
    items: z.array(B2BItemSchema).optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Invoice');
export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceCreateSchema = z.object({
  sales_order_id: z.coerce.number().int().nullable().optional(),
  customer_id: z.coerce.number().int().nullable().optional(),
  customer_name: z.string().min(1),
  invoice_date: DateOnlySchema,
  due_date: DateOnlySchema.nullable().optional(),
  status: InvoiceStatusSchema.optional().default('ISSUED'),
  tax_percent: z.coerce.number().min(0).max(100).optional().default(0),
  discount_amount: z.coerce.number().min(0).optional().default(0),
  down_payment: z.coerce.number().min(0).optional().default(0),
  notes: z.string().nullable().optional(),
  items: z.array(B2BItemCreateSchema).min(1, 'Minimal 1 item'),
});

export const InvoiceUpdateSchema = z.object({
  invoice_date: DateOnlySchema.optional(),
  due_date: DateOnlySchema.nullable().optional(),
  status: InvoiceStatusSchema.optional(),
  tax_percent: z.coerce.number().min(0).max(100).optional(),
  discount_amount: z.coerce.number().min(0).optional(),
  down_payment: z.coerce.number().min(0).optional(),
  notes: z.string().nullable().optional(),
  items: z.array(B2BItemCreateSchema).optional(),
});

// ---------- RECEIPT ----------
export const ReceiptSchema = z
  .object({
    id: z.number().int().positive(),
    number: z.string(),
    invoice_id: z.number().int(),
    customer_id: z.number().int().nullable(),
    payment_date: z.string(),
    method: PaymentMethodSchema,
    amount: z.number(),
    bank_account_id: z.number().int().nullable(),
    ref_number: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: DateTimeStringSchema.optional(),
  })
  .openapi('Receipt');
export type Receipt = z.infer<typeof ReceiptSchema>;

export const ReceiptCreateSchema = z.object({
  invoice_id: z.coerce.number().int(),
  payment_date: DateOnlySchema,
  method: PaymentMethodSchema.optional().default('cash'),
  amount: z.coerce.number().positive(),
  bank_account_id: z.coerce.number().int().nullable().optional(),
  ref_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---------- AGING REPORT ----------
export const AgingReportRowSchema = z.object({
  customer_id: z.number().int().nullable(),
  customer_name: z.string(),
  bucket_0_30: z.number(),
  bucket_31_60: z.number(),
  bucket_61_90: z.number(),
  bucket_90_plus: z.number(),
  total_outstanding: z.number(),
});
export type AgingReportRow = z.infer<typeof AgingReportRowSchema>;

export const AgingReportResponseSchema = z.object({
  rows: z.array(AgingReportRowSchema),
  totals: z.object({
    bucket_0_30: z.number(),
    bucket_31_60: z.number(),
    bucket_61_90: z.number(),
    bucket_90_plus: z.number(),
    total_outstanding: z.number(),
  }),
});

// ============================================================
// OpenAPI Registry
// ============================================================
const tags = ['B2B'];

function listResponse(itemSchema: z.ZodTypeAny) {
  return {
    200: {
      description: 'List',
      content: { 'application/json': { schema: z.array(itemSchema) } },
    },
  };
}

function notFound() {
  return {
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  };
}

// Quotation
registry.registerPath({
  method: 'get',
  path: '/api/v1/quotation',
  tags,
  summary: 'List quotations',
  responses: listResponse(QuotationSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/quotation',
  tags,
  summary: 'Create quotation',
  request: {
    body: {
      content: { 'application/json': { schema: QuotationCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: QuotationSchema } },
    },
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/quotation/{id}',
  tags,
  summary: 'Get quotation',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: QuotationSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/quotation/{id}',
  tags,
  summary: 'Update quotation',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { 'application/json': { schema: QuotationUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: QuotationSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/quotation/{id}',
  tags,
  summary: 'Delete quotation',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Deleted' },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/quotation/{id}/convert-to-so',
  tags,
  summary: 'Convert quotation to sales order',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    201: {
      description: 'Sales order created',
      content: { 'application/json': { schema: SalesOrderSchema } },
    },
    ...notFound(),
  },
});

// Sales Order
registry.registerPath({
  method: 'get',
  path: '/api/v1/sales-order',
  tags,
  summary: 'List sales orders',
  responses: listResponse(SalesOrderSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/sales-order',
  tags,
  summary: 'Create sales order',
  request: {
    body: {
      content: { 'application/json': { schema: SalesOrderCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: SalesOrderSchema } },
    },
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/sales-order/{id}',
  tags,
  summary: 'Get sales order',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: SalesOrderSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/sales-order/{id}',
  tags,
  summary: 'Update sales order',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { 'application/json': { schema: SalesOrderUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: SalesOrderSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/sales-order/{id}',
  tags,
  summary: 'Delete sales order',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Deleted' },
    ...notFound(),
  },
});

// Delivery Order
registry.registerPath({
  method: 'get',
  path: '/api/v1/delivery-order',
  tags,
  summary: 'List delivery orders',
  responses: listResponse(DeliveryOrderSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/delivery-order',
  tags,
  summary: 'Create delivery order from SO',
  request: {
    body: {
      content: { 'application/json': { schema: DeliveryOrderCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: DeliveryOrderSchema } },
    },
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/delivery-order/{id}',
  tags,
  summary: 'Get delivery order',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: DeliveryOrderSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/delivery-order/{id}',
  tags,
  summary: 'Update delivery order (status, etc)',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { 'application/json': { schema: DeliveryOrderUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: DeliveryOrderSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/delivery-order/{id}',
  tags,
  summary: 'Delete delivery order',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: 'Deleted' }, ...notFound() },
});

// Invoice
registry.registerPath({
  method: 'get',
  path: '/api/v1/invoice',
  tags,
  summary: 'List invoices',
  responses: listResponse(InvoiceSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/invoice',
  tags,
  summary: 'Create invoice',
  request: {
    body: {
      content: { 'application/json': { schema: InvoiceCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: InvoiceSchema } },
    },
  },
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/invoice/{id}',
  tags,
  summary: 'Get invoice',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: InvoiceSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/invoice/{id}',
  tags,
  summary: 'Update invoice',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { 'application/json': { schema: InvoiceUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: InvoiceSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/invoice/{id}',
  tags,
  summary: 'Delete (void) invoice',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: 'Deleted' }, ...notFound() },
});

// Receipt
registry.registerPath({
  method: 'get',
  path: '/api/v1/receipt',
  tags,
  summary: 'List receipts',
  responses: listResponse(ReceiptSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/receipt',
  tags,
  summary: 'Apply payment to invoice',
  request: {
    body: {
      content: { 'application/json': { schema: ReceiptCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: ReceiptSchema } },
    },
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/receipt/{id}',
  tags,
  summary: 'Delete (void) receipt',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: 'Deleted' }, ...notFound() },
});

// Aging report
registry.registerPath({
  method: 'get',
  path: '/api/v1/aging-report',
  tags,
  summary: 'Aging report (0-30 / 31-60 / 61-90 / >90 days)',
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AgingReportResponseSchema } },
    },
  },
});
