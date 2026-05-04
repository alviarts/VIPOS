// Schema untuk endpoint /api/v1/online-order/*, /api/v1/marketplace/*,
// /api/v1/storefront-settings, /api/v1/consumer-app-config, dan settlement report.
// P1-12: queue pesanan online + marketplace mock OAuth + storefront +
// consumer app config.

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

// --- Enums --------------------------------------------------------------

export const OnlineOrderChannelSchema = z.enum([
  'emenu',
  'consumer_app',
  'gofood',
  'grabfood',
  'shopeefood',
  'grabmart',
  'tokopedia',
]);
export type OnlineOrderChannel = z.infer<typeof OnlineOrderChannelSchema>;

export const MarketplaceProviderSchema = z.enum([
  'gofood',
  'grabfood',
  'shopeefood',
  'grabmart',
  'tokopedia',
]);
export type MarketplaceProvider = z.infer<typeof MarketplaceProviderSchema>;

export const OnlineOrderStatusSchema = z.enum([
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
]);
export type OnlineOrderStatus = z.infer<typeof OnlineOrderStatusSchema>;

export const OnlineOrderTypeSchema = z.enum(['dine_in', 'takeaway', 'delivery']);

export const OnlinePaymentStatusSchema = z.enum(['unpaid', 'paid', 'cod', 'refunded']);

export const MarketplaceConnectionStatusSchema = z.enum(['connected', 'disconnected', 'paused']);

// --- Online order item -------------------------------------------------

export const OnlineOrderItemSchema = z
  .object({
    id: z.number().int().positive().optional(),
    product_id: z.number().int().positive().nullable().optional(),
    product_name: z.string(),
    qty: z.number().int().positive(),
    price: z.number().nonnegative(),
    modifiers: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    subtotal: z.number().nonnegative(),
  })
  .openapi('OnlineOrderItem');
export type OnlineOrderItem = z.infer<typeof OnlineOrderItemSchema>;

// --- Online order -------------------------------------------------------

export const OnlineOrderSchema = z
  .object({
    id: z.number().int().positive(),
    ref_no: z.string(),
    channel: OnlineOrderChannelSchema,
    external_ref: z.string().nullable().optional(),
    order_type: OnlineOrderTypeSchema,
    table_no: z.string().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    customer_phone: z.string().nullable().optional(),
    customer_address: z.string().nullable().optional(),
    delivery_zone: z.string().nullable().optional(),
    delivery_fee: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
    discount: z.number().nonnegative(),
    service_charge: z.number().nonnegative(),
    tax: z.number().nonnegative(),
    total: z.number().nonnegative(),
    payment_method: z.string().nullable().optional(),
    payment_status: OnlinePaymentStatusSchema,
    status: OnlineOrderStatusSchema,
    reject_reason: z.string().nullable().optional(),
    cancel_reason: z.string().nullable().optional(),
    sla_minutes: z.number().int().nonnegative().nullable().optional(),
    accepted_at: DateTimeStringSchema.nullable().optional(),
    ready_at: DateTimeStringSchema.nullable().optional(),
    completed_at: DateTimeStringSchema.nullable().optional(),
    cancelled_at: DateTimeStringSchema.nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
    items: z.array(OnlineOrderItemSchema).optional(),
  })
  .openapi('OnlineOrder');
export type OnlineOrder = z.infer<typeof OnlineOrderSchema>;

export const OnlineOrderItemInputSchema = z.object({
  product_id: z.coerce.number().int().positive().optional().nullable(),
  product_name: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  modifiers: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const OnlineOrderCreateSchema = z
  .object({
    channel: OnlineOrderChannelSchema,
    external_ref: z.string().max(100).optional().nullable(),
    order_type: OnlineOrderTypeSchema.default('delivery'),
    table_no: z.string().max(50).optional().nullable(),
    customer_name: z.string().max(120).optional().nullable(),
    customer_phone: z.string().max(50).optional().nullable(),
    customer_address: z.string().max(500).optional().nullable(),
    delivery_zone: z.string().max(120).optional().nullable(),
    delivery_fee: z.coerce.number().nonnegative().default(0),
    discount: z.coerce.number().nonnegative().default(0),
    service_charge: z.coerce.number().nonnegative().default(0),
    tax: z.coerce.number().nonnegative().default(0),
    payment_method: z.string().max(60).optional().nullable(),
    payment_status: OnlinePaymentStatusSchema.default('unpaid'),
    sla_minutes: z.coerce.number().int().positive().default(30),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(OnlineOrderItemInputSchema).min(1, 'Order minimal 1 item'),
  })
  .openapi('OnlineOrderCreate');
export type OnlineOrderCreate = z.infer<typeof OnlineOrderCreateSchema>;

export const OnlineOrderRejectSchema = z.object({
  reason: z.string().min(1, 'Alasan wajib diisi'),
});

export const OnlineOrderCancelSchema = z.object({
  reason: z.string().min(1, 'Alasan wajib diisi'),
});

// --- Marketplace connection --------------------------------------------

export const MarketplaceConnectionSchema = z
  .object({
    id: z.number().int().positive(),
    provider: MarketplaceProviderSchema,
    status: MarketplaceConnectionStatusSchema,
    merchant_id: z.string().nullable().optional(),
    outlet_id: z.string().nullable().optional(),
    oauth_token: z.string().nullable().optional(),
    refresh_token: z.string().nullable().optional(),
    token_expires_at: DateTimeStringSchema.nullable().optional(),
    auto_accept: z.union([z.literal(0), z.literal(1)]),
    sla_accept_minutes: z.number().int().positive(),
    sla_ready_minutes: z.number().int().positive(),
    mdr_percent: z.number().nonnegative(),
    price_markup_percent: z.number(),
    settings: z.string().nullable().optional(),
    connected_at: DateTimeStringSchema.nullable().optional(),
    last_sync_at: DateTimeStringSchema.nullable().optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('MarketplaceConnection');
export type MarketplaceConnection = z.infer<typeof MarketplaceConnectionSchema>;

// `provider` di-resolve dari path param di route — body tidak perlu kirim ulang.
export const MarketplaceConnectSchema = z
  .object({
    merchant_id: z.string().min(1, 'Merchant ID wajib diisi'),
    outlet_id: z.string().optional().nullable(),
    auto_accept: z.coerce.number().int().min(0).max(1).default(0),
    sla_accept_minutes: z.coerce.number().int().positive().default(5),
    sla_ready_minutes: z.coerce.number().int().positive().default(15),
    mdr_percent: z.coerce.number().nonnegative().default(20),
    price_markup_percent: z.coerce.number().default(0),
  })
  .openapi('MarketplaceConnectRequest');

export const MarketplaceUpdateSchema = z.object({
  auto_accept: z.coerce.number().int().min(0).max(1).optional(),
  sla_accept_minutes: z.coerce.number().int().positive().optional(),
  sla_ready_minutes: z.coerce.number().int().positive().optional(),
  mdr_percent: z.coerce.number().nonnegative().optional(),
  price_markup_percent: z.coerce.number().optional(),
  status: MarketplaceConnectionStatusSchema.optional(),
});

// --- Marketplace product overrides --------------------------------------

export const MarketplaceProductOverrideSchema = z
  .object({
    id: z.number().int().positive(),
    provider: MarketplaceProviderSchema,
    product_id: z.number().int().positive(),
    override_name: z.string().nullable().optional(),
    override_price: z.number().nonnegative().nullable().optional(),
    override_image_url: z.string().nullable().optional(),
    is_enabled: z.union([z.literal(0), z.literal(1)]),
    synced_at: DateTimeStringSchema.nullable().optional(),
    sync_status: z.enum(['pending', 'synced', 'failed']),
    sync_error: z.string().nullable().optional(),
  })
  .openapi('MarketplaceProductOverride');

export const MarketplaceOverrideUpsertSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  override_name: z.string().max(200).optional().nullable(),
  override_price: z.coerce.number().nonnegative().optional().nullable(),
  override_image_url: z.string().max(500).optional().nullable(),
  is_enabled: z.coerce.number().int().min(0).max(1).default(1),
});

// --- Storefront settings ------------------------------------------------

const OperatingHoursSchema = z
  .array(
    z.object({
      day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
      is_closed: z.boolean().default(false),
    })
  )
  .max(7);

const DeliveryZoneSchema = z.object({
  name: z.string(),
  fee: z.number().nonnegative(),
  min_order: z.number().nonnegative().default(0),
  radius_km: z.number().nonnegative().optional(),
});

const PaymentMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
});

export const StorefrontSettingsSchema = z
  .object({
    slug: z.string().nullable().optional(),
    custom_domain: z.string().nullable().optional(),
    is_active: z.union([z.literal(0), z.literal(1)]),
    brand_name: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
    cover_image_url: z.string().nullable().optional(),
    primary_color: z.string().nullable().optional(),
    accent_color: z.string().nullable().optional(),
    theme: z.enum(['light', 'dark', 'auto']).nullable().optional(),
    language: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    tagline: z.string().nullable().optional(),
    about_text: z.string().nullable().optional(),
    contact_phone: z.string().nullable().optional(),
    contact_whatsapp: z.string().nullable().optional(),
    contact_email: z.string().nullable().optional(),
    contact_instagram: z.string().nullable().optional(),
    tos_text: z.string().nullable().optional(),
    privacy_text: z.string().nullable().optional(),
    faq_text: z.string().nullable().optional(),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
    seo_og_image_url: z.string().nullable().optional(),
    ga_id: z.string().nullable().optional(),
    fb_pixel_id: z.string().nullable().optional(),
    operating_hours: OperatingHoursSchema.nullable().optional(),
    payment_methods: z.array(PaymentMethodSchema).nullable().optional(),
    delivery_zones: z.array(DeliveryZoneSchema).nullable().optional(),
    min_order_amount: z.number().nonnegative(),
    service_charge_percent: z.number().nonnegative(),
    tax_percent: z.number().nonnegative(),
    supports_dine_in: z.union([z.literal(0), z.literal(1)]),
    supports_takeaway: z.union([z.literal(0), z.literal(1)]),
    supports_delivery: z.union([z.literal(0), z.literal(1)]),
    banner_slides: z.array(z.string()).nullable().optional(),
    featured_product_ids: z.array(z.number().int().positive()).nullable().optional(),
    hidden_category_ids: z.array(z.number().int().positive()).nullable().optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('StorefrontSettings');
export type StorefrontSettings = z.infer<typeof StorefrontSettingsSchema>;

export const StorefrontSettingsUpdateSchema = StorefrontSettingsSchema.partial()
  .extend({
    is_active: z.coerce.number().int().min(0).max(1).optional(),
    supports_dine_in: z.coerce.number().int().min(0).max(1).optional(),
    supports_takeaway: z.coerce.number().int().min(0).max(1).optional(),
    supports_delivery: z.coerce.number().int().min(0).max(1).optional(),
  })
  .openapi('StorefrontSettingsUpdate');

// --- Consumer app config -----------------------------------------------

export const ConsumerAppConfigSchema = z
  .object({
    app_name: z.string().nullable().optional(),
    app_icon_url: z.string().nullable().optional(),
    splash_image_url: z.string().nullable().optional(),
    primary_color: z.string().nullable().optional(),
    bundle_id_android: z.string().nullable().optional(),
    bundle_id_ios: z.string().nullable().optional(),
    play_store_url: z.string().nullable().optional(),
    app_store_url: z.string().nullable().optional(),
    status: z.enum(['draft', 'submitted', 'review', 'published', 'rejected']),
    provisioned_at: DateTimeStringSchema.nullable().optional(),
    published_at: DateTimeStringSchema.nullable().optional(),
    featured_promo_ids: z.array(z.number().int().positive()).nullable().optional(),
    hidden_product_ids: z.array(z.number().int().positive()).nullable().optional(),
    operating_hours: OperatingHoursSchema.nullable().optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('ConsumerAppConfig');
export type ConsumerAppConfig = z.infer<typeof ConsumerAppConfigSchema>;

export const ConsumerAppConfigUpdateSchema =
  ConsumerAppConfigSchema.partial().openapi('ConsumerAppConfigUpdate');

// --- Settlement report -------------------------------------------------

export const SettlementReportRowSchema = z
  .object({
    provider: OnlineOrderChannelSchema,
    completed_orders: z.number().int().nonnegative(),
    gross_revenue: z.number().nonnegative(),
    mdr: z.number().nonnegative(),
    net_revenue: z.number().nonnegative(),
  })
  .openapi('SettlementReportRow');
export type SettlementReportRow = z.infer<typeof SettlementReportRowSchema>;

// --- OpenAPI registrations ---------------------------------------------

const json = (schema: z.ZodTypeAny) => ({
  'application/json': { schema },
});
const okMessage = z.object({ message: z.string() });

registry.registerPath({
  method: 'get',
  path: '/api/v1/online-order',
  description: 'List online orders (filter status, channel, date range).',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      status: OnlineOrderStatusSchema.optional(),
      channel: OnlineOrderChannelSchema.optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List orders',
      content: json(
        z.object({
          items: z.array(OnlineOrderSchema),
          total: z.number().int().nonnegative(),
        })
      ),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/online-order/{id}',
  description: 'Detail order + items.',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Order', content: json(OnlineOrderSchema) },
    404: {
      description: 'Tidak ditemukan',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order',
  description: 'Buat online order baru (biasanya dari frontend e-menu / consumer app).',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(OnlineOrderCreateSchema) } },
  responses: {
    201: { description: 'Order dibuat', content: json(OnlineOrderSchema) },
    400: {
      description: 'Validation error',
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order/{id}/accept',
  description: 'Terima order: NEW → PREPARING.',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Order accepted', content: json(OnlineOrderSchema) },
    400: { description: 'Invalid transition', content: json(ErrorResponseSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order/{id}/reject',
  description: 'Tolak order dengan alasan.',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(OnlineOrderRejectSchema) },
  },
  responses: {
    200: { description: 'Order rejected', content: json(OnlineOrderSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order/{id}/ready',
  description: 'Tandai siap: PREPARING → READY.',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Order ready', content: json(OnlineOrderSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order/{id}/complete',
  description: 'Tandai selesai: READY → COMPLETED.',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: 'Order completed', content: json(OnlineOrderSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order/{id}/cancel',
  description: 'Batalkan order.',
  tags: ['OrderOnline'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(OnlineOrderCancelSchema) },
  },
  responses: {
    200: { description: 'Order cancelled', content: json(OnlineOrderSchema) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/online-order/webhook/{provider}',
  description:
    'Endpoint webhook untuk marketplace (mock simulator). Untuk testing: terima payload dan buat order baru.',
  tags: ['OrderOnline'],
  request: {
    params: z.object({ provider: MarketplaceProviderSchema }),
    body: { required: true, content: json(OnlineOrderCreateSchema) },
  },
  responses: {
    201: { description: 'Order ingested', content: json(OnlineOrderSchema) },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace',
  description: 'List koneksi marketplace (semua provider terdaftar).',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Array koneksi',
      content: json(z.array(MarketplaceConnectionSchema)),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/marketplace/{provider}/connect',
  description: 'Connect marketplace (mock OAuth — generate fake oauth_token + simpan kredensial).',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ provider: MarketplaceProviderSchema }),
    body: { required: true, content: json(MarketplaceConnectSchema) },
  },
  responses: {
    200: {
      description: 'Connected',
      content: json(MarketplaceConnectionSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/marketplace/{provider}/disconnect',
  description: 'Disconnect marketplace.',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ provider: MarketplaceProviderSchema }) },
  responses: {
    200: { description: 'Disconnected', content: json(okMessage) },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/marketplace/{provider}',
  description: 'Update setting marketplace (auto-accept, SLA, MDR, markup).',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ provider: MarketplaceProviderSchema }),
    body: { required: true, content: json(MarketplaceUpdateSchema) },
  },
  responses: {
    200: {
      description: 'Updated',
      content: json(MarketplaceConnectionSchema),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/marketplace/{provider}/sync-products',
  description:
    "Sync produk ke marketplace (mock — mark sync_status='synced' + update last_sync_at).",
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ provider: MarketplaceProviderSchema }) },
  responses: {
    200: {
      description: 'Sync result',
      content: json(
        z.object({
          synced: z.number().int().nonnegative(),
          failed: z.number().int().nonnegative(),
          last_sync_at: DateTimeStringSchema,
        })
      ),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/{provider}/products',
  description: 'List override produk untuk provider tertentu.',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ provider: MarketplaceProviderSchema }) },
  responses: {
    200: {
      description: 'Array overrides',
      content: json(z.array(MarketplaceProductOverrideSchema)),
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/marketplace/{provider}/products',
  description: 'Upsert override produk (price markup, name, image).',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ provider: MarketplaceProviderSchema }),
    body: { required: true, content: json(MarketplaceOverrideUpsertSchema) },
  },
  responses: {
    200: {
      description: 'Override upserted',
      content: json(MarketplaceProductOverrideSchema),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/settlement',
  description: 'Settlement report per provider (filter date range).',
  tags: ['Marketplace'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Aggregate per provider',
      content: json(
        z.object({
          rows: z.array(SettlementReportRowSchema),
          total_gross: z.number().nonnegative(),
          total_net: z.number().nonnegative(),
          total_mdr: z.number().nonnegative(),
        })
      ),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/storefront-settings',
  description: 'Get storefront (e-menu) config.',
  tags: ['Storefront'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Settings',
      content: json(StorefrontSettingsSchema),
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/storefront-settings',
  description: 'Update storefront config.',
  tags: ['Storefront'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(StorefrontSettingsUpdateSchema) },
  },
  responses: {
    200: {
      description: 'Updated',
      content: json(StorefrontSettingsSchema),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/consumer-app-config',
  description: 'Get consumer app config.',
  tags: ['ConsumerApp'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Config', content: json(ConsumerAppConfigSchema) },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/consumer-app-config',
  description: 'Update consumer app config.',
  tags: ['ConsumerApp'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(ConsumerAppConfigUpdateSchema) },
  },
  responses: {
    200: { description: 'Updated', content: json(ConsumerAppConfigSchema) },
  },
});
