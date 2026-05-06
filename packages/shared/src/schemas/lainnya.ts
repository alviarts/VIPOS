// VIPOS — P1-18 LAINNYA Schemas
//
// Combined schemas untuk Bantuan + LAYANAN + INSPIRASI + Capital + SUPPLIES.
// Tiap section di-namespace per kategori. Semua endpoint registered ke
// OpenAPIRegistry sebagai `Lainnya/{Kategori}` untuk gampang dibrowse.

import { z } from '../openapi';

// -----------------------------------------------------------------------------
// Bantuan / Help center
// -----------------------------------------------------------------------------

export const HelpTopicSchema = z
  .object({
    id: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    category: z.string().nullable(),
    excerpt: z.string().nullable(),
    content: z.string().nullable(),
    sort_order: z.number().int().default(0),
    is_active: z.union([z.literal(0), z.literal(1)]).default(1),
  })
  .openapi('HelpTopic');
export type HelpTopic = z.infer<typeof HelpTopicSchema>;

export const HelpFeedbackTypeSchema = z.enum(['bug', 'feature', 'general']);
export const HelpFeedbackStatusSchema = z.enum(['open', 'in_review', 'resolved', 'closed']);

export const HelpFeedbackSchema = z
  .object({
    id: z.number().int().positive(),
    type: HelpFeedbackTypeSchema,
    title: z.string(),
    description: z.string(),
    screenshot_url: z.string().url().nullable().optional(),
    app_version: z.string().nullable().optional(),
    device_info: z.string().nullable().optional(),
    status: HelpFeedbackStatusSchema,
    created_at: z.string().optional(),
  })
  .openapi('HelpFeedback');
export type HelpFeedback = z.infer<typeof HelpFeedbackSchema>;

export const HelpFeedbackCreateSchema = z
  .object({
    type: HelpFeedbackTypeSchema,
    title: z.string().min(3).max(150),
    description: z.string().min(10).max(5000),
    screenshot_url: z.string().url().optional(),
    app_version: z.string().optional(),
    device_info: z.string().optional(),
  })
  .openapi('HelpFeedbackCreate');
export type HelpFeedbackCreate = z.infer<typeof HelpFeedbackCreateSchema>;

// -----------------------------------------------------------------------------
// LAYANAN
// -----------------------------------------------------------------------------

export const ServiceKeySchema = z.enum(['majoopay', 'edc', 'satu_sehat', 'aura']);
export type ServiceKey = z.infer<typeof ServiceKeySchema>;

export const ServiceApplicationStatusSchema = z.enum([
  'submitted',
  'review',
  'approved',
  'rejected',
]);

export const ServiceApplicationSchema = z
  .object({
    id: z.number().int().positive(),
    service_key: ServiceKeySchema,
    status: ServiceApplicationStatusSchema,
    payload_json: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    submitted_by: z.number().int().nullable().optional(),
    submitted_at: z.string().optional(),
    reviewed_at: z.string().nullable().optional(),
  })
  .openapi('ServiceApplication');
export type ServiceApplication = z.infer<typeof ServiceApplicationSchema>;

export const ServiceApplicationCreateSchema = z
  .object({
    service_key: ServiceKeySchema,
    payload: z.record(z.unknown()).optional(),
  })
  .openapi('ServiceApplicationCreate');
export type ServiceApplicationCreate = z.infer<typeof ServiceApplicationCreateSchema>;

// -----------------------------------------------------------------------------
// INSPIRASI
// -----------------------------------------------------------------------------

export const InspirasiArticleCategorySchema = z.enum([
  'home',
  'berbagi',
  'tren-bisnis',
  'trivia',
  'kisah-sukses',
  'tips',
  'inspirasi',
  'edukasi',
]);

export const InspirasiArticleSchema = z
  .object({
    id: z.number().int().positive(),
    slug: z.string(),
    category: z.string(),
    title: z.string(),
    excerpt: z.string().nullable(),
    content: z.string().nullable(),
    cover_url: z.string().nullable(),
    author: z.string().nullable(),
    reading_minutes: z.number().int().nonnegative().default(3),
    published_at: z.string().optional(),
    is_active: z.union([z.literal(0), z.literal(1)]).default(1),
  })
  .openapi('InspirasiArticle');
export type InspirasiArticle = z.infer<typeof InspirasiArticleSchema>;

export const InspirasiEventSchema = z
  .object({
    id: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    event_date: z.string(),
    cover_url: z.string().nullable(),
    capacity: z.number().int().nullable(),
    rsvp_count: z.number().int().nonnegative().default(0),
    user_rsvp_status: z.string().nullable().optional(),
  })
  .openapi('InspirasiEvent');

export const RsvpStatusSchema = z.enum(['going', 'interested', 'cancelled']);

export const RsvpRequestSchema = z
  .object({
    status: RsvpStatusSchema.default('going'),
  })
  .openapi('RsvpRequest');

export const InspirasiMagazineSchema = z
  .object({
    id: z.number().int().positive(),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    title: z.string(),
    cover_url: z.string().nullable(),
    pdf_url: z.string().nullable(),
    published_at: z.string().optional(),
  })
  .openapi('InspirasiMagazine');

export const InformasiUpdateSchema = z
  .object({
    id: z.number().int().positive(),
    version: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    published_at: z.string().optional(),
  })
  .openapi('InformasiUpdate');

// -----------------------------------------------------------------------------
// Capital
// -----------------------------------------------------------------------------

export const CapitalApplicationStatusSchema = z.enum([
  'submitted',
  'review',
  'approved',
  'rejected',
  'disbursed',
]);

export const CapitalApplicationSchema = z
  .object({
    id: z.number().int().positive(),
    amount: z.number().nonnegative(),
    tenure_months: z.number().int().min(1),
    purpose: z.string(),
    collateral: z.string().nullable(),
    monthly_revenue: z.number().nullable(),
    status: CapitalApplicationStatusSchema,
    pre_qualification_score: z.number().int().nullable(),
    payload_json: z.string().nullable().optional(),
    submitted_at: z.string().optional(),
    reviewed_at: z.string().nullable().optional(),
  })
  .openapi('CapitalApplication');
export type CapitalApplication = z.infer<typeof CapitalApplicationSchema>;

export const CapitalApplicationCreateSchema = z
  .object({
    amount: z.coerce.number().min(1_000_000, 'Minimal Rp 1.000.000'),
    tenure_months: z.coerce.number().int().min(1).max(60),
    purpose: z.string().min(3).max(500),
    collateral: z.string().optional(),
    monthly_revenue: z.coerce.number().nonnegative().optional(),
    payload: z.record(z.unknown()).optional(),
  })
  .openapi('CapitalApplicationCreate');
export type CapitalApplicationCreate = z.infer<typeof CapitalApplicationCreateSchema>;

export const CapitalPreQualificationSchema = z
  .object({
    is_eligible: z.boolean(),
    pre_approved_limit: z.number().nonnegative(),
    score: z.number().int().min(0).max(100),
    factors: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        passed: z.boolean(),
        message: z.string().optional(),
      })
    ),
    avg_monthly_revenue: z.number().nonnegative(),
    months_active: z.number().int().nonnegative(),
  })
  .openapi('CapitalPreQualification');
export type CapitalPreQualification = z.infer<typeof CapitalPreQualificationSchema>;

// -----------------------------------------------------------------------------
// SUPPLIES
// -----------------------------------------------------------------------------

export const SupplyCategorySchema = z
  .object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    sort_order: z.number().int().default(0),
  })
  .openapi('SupplyCategory');

export const SupplyStockStatusSchema = z.enum(['in_stock', 'low', 'out_of_stock']);

export const SupplyProductSchema = z
  .object({
    id: z.number().int().positive(),
    sku: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    image_url: z.string().nullable(),
    price: z.number().nonnegative(),
    moq: z.number().int().min(1).default(1),
    stock_status: SupplyStockStatusSchema,
    supplier_name: z.string().nullable(),
    category_id: z.number().int().nullable(),
    category_slug: z.string().nullable().optional(),
    category_name: z.string().nullable().optional(),
    is_active: z.union([z.literal(0), z.literal(1)]).default(1),
  })
  .openapi('SupplyProduct');

export const SupplyCartItemSchema = z
  .object({
    id: z.number().int().positive(),
    product_id: z.number().int().positive(),
    qty: z.number().int().min(1),
    product: SupplyProductSchema.optional(),
    subtotal: z.number().nonnegative().optional(),
  })
  .openapi('SupplyCartItem');

export const SupplyCartSchema = z
  .object({
    id: z.number().int().positive(),
    items: z.array(SupplyCartItemSchema),
    total_amount: z.number().nonnegative(),
    item_count: z.number().int().nonnegative(),
  })
  .openapi('SupplyCart');

export const SupplyCartItemCreateSchema = z
  .object({
    product_id: z.coerce.number().int().positive(),
    qty: z.coerce.number().int().min(1).default(1),
  })
  .openapi('SupplyCartItemCreate');

export const SupplyCheckoutSchema = z
  .object({
    payment_method: z.enum(['bank_transfer', 'majoopay', 'capital_credit']),
    delivery_address: z.string().min(10).max(500),
    delivery_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .openapi('SupplyCheckout');

export const SupplyOrderStatusSchema = z.enum([
  'ordered',
  'confirmed',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
]);

export const SupplyOrderItemSchema = z
  .object({
    id: z.number().int().positive(),
    product_id: z.number().int().positive(),
    product_name: z.string().optional(),
    qty: z.number().int().min(1),
    price: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
  })
  .openapi('SupplyOrderItem');

export const SupplyOrderSchema = z
  .object({
    id: z.number().int().positive(),
    order_no: z.string(),
    user_id: z.number().int().positive(),
    total_amount: z.number().nonnegative(),
    payment_method: z.string().nullable(),
    delivery_address: z.string().nullable(),
    delivery_date: z.string().nullable(),
    status: SupplyOrderStatusSchema,
    ordered_at: z.string().optional(),
    delivered_at: z.string().nullable().optional(),
    items: z.array(SupplyOrderItemSchema).optional(),
  })
  .openapi('SupplyOrder');
export type SupplyOrder = z.infer<typeof SupplyOrderSchema>;
