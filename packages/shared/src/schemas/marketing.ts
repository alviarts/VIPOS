// Marketing campaigns (P1-11). Mendukung 4 channel: WhatsApp Blast, SMS,
// Email, dan IG Feed (image generator). Provider eksternal di-abstract via
// field `provider` (default `mock`) — wiring resmi (WhatsApp Business API,
// SMS gateway, SendGrid, Meta Graph) ditunda; backend mensimulasi delivery
// supaya UI/UX flow utuh.

import { z, registry } from "../openapi";
import {
  DateTimeStringSchema,
  ErrorResponseSchema,
  IdStringSchema,
} from "./common";

export const MarketingChannelSchema = z.enum([
  "whatsapp",
  "sms",
  "email",
  "instagram",
]);
export type MarketingChannel = z.infer<typeof MarketingChannelSchema>;

export const MarketingScheduleTypeSchema = z.enum([
  "now",
  "scheduled",
  "recurring",
]);
export type MarketingScheduleType = z.infer<typeof MarketingScheduleTypeSchema>;

export const MarketingAudienceTypeSchema = z.enum([
  "all",
  "group",
  "tag",
  "custom",
]);
export type MarketingAudienceType = z.infer<typeof MarketingAudienceTypeSchema>;

export const MarketingCampaignStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "canceled",
]);
export type MarketingCampaignStatus = z.infer<
  typeof MarketingCampaignStatusSchema
>;

export const MarketingRecipientStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "failed",
]);
export type MarketingRecipientStatus = z.infer<
  typeof MarketingRecipientStatusSchema
>;

const IdArraySchema = z.array(z.coerce.number().int().positive());

const CustomRecipientSchema = z.object({
  contact: z.string().min(1),
  label: z.string().optional(),
});
export type MarketingCustomRecipient = z.infer<typeof CustomRecipientSchema>;

const TemplateButtonSchema = z.object({
  type: z.enum(["url", "phone"]),
  label: z.string().min(1).max(40),
  value: z.string().min(1),
});
export type MarketingTemplateButton = z.infer<typeof TemplateButtonSchema>;

export const MarketingTemplateSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    channel: MarketingChannelSchema,
    header: z.string().nullable(),
    body: z.string(),
    footer: z.string().nullable(),
    subject: z.string().nullable(),
    caption: z.string().nullable(),
    buttons: z.array(TemplateButtonSchema),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi("MarketingTemplate");
export type MarketingTemplate = z.infer<typeof MarketingTemplateSchema>;

export const MarketingTemplateCreateSchema = z
  .object({
    name: z.string().min(1, "Nama template wajib diisi").max(120),
    channel: MarketingChannelSchema,
    header: z.string().max(500).optional().nullable(),
    body: z.string().min(1, "Body template wajib diisi").max(4096),
    footer: z.string().max(500).optional().nullable(),
    subject: z.string().max(200).optional().nullable(),
    caption: z.string().max(2200).optional().nullable(),
    buttons: z.array(TemplateButtonSchema).max(3).default([]),
  })
  .openapi("MarketingTemplateCreateRequest");
export type MarketingTemplateCreate = z.infer<
  typeof MarketingTemplateCreateSchema
>;

export const MarketingTemplateUpdateSchema =
  MarketingTemplateCreateSchema.partial().openapi(
    "MarketingTemplateUpdateRequest"
  );
export type MarketingTemplateUpdate = z.infer<
  typeof MarketingTemplateUpdateSchema
>;

const TemplateSnapshotSchema = z.object({
  header: z.string().nullable().optional(),
  body: z.string(),
  footer: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  buttons: z.array(TemplateButtonSchema).default([]),
});

export const MarketingCampaignSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    channel: MarketingChannelSchema,
    provider: z.string(),
    audience_type: MarketingAudienceTypeSchema,
    audience_group_ids: IdArraySchema,
    audience_tag_ids: IdArraySchema,
    audience_custom_recipients: z.array(CustomRecipientSchema),
    template_id: z.number().int().positive().nullable(),
    template_snapshot: TemplateSnapshotSchema,
    schedule_type: MarketingScheduleTypeSchema,
    scheduled_at: DateTimeStringSchema.nullable(),
    recurrence_rule: z.string().nullable(),
    cost_per_message: z.number().nonnegative(),
    total_cost: z.number().nonnegative(),
    status: MarketingCampaignStatusSchema,
    sent_count: z.number().int().nonnegative(),
    delivered_count: z.number().int().nonnegative(),
    opened_count: z.number().int().nonnegative(),
    clicked_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    sent_at: DateTimeStringSchema.nullable(),
    completed_at: DateTimeStringSchema.nullable(),
    notes: z.string().nullable(),
    created_by: z.number().int().positive().nullable(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi("MarketingCampaign");
export type MarketingCampaign = z.infer<typeof MarketingCampaignSchema>;

export const MarketingCampaignCreateSchema = z
  .object({
    name: z.string().min(1, "Nama campaign wajib diisi").max(160),
    channel: MarketingChannelSchema,
    provider: z.string().min(1).max(40).default("mock"),
    audience_type: MarketingAudienceTypeSchema,
    audience_group_ids: IdArraySchema.default([]),
    audience_tag_ids: IdArraySchema.default([]),
    audience_custom_recipients: z
      .array(CustomRecipientSchema)
      .max(10000)
      .default([]),
    template_id: z.coerce.number().int().positive().optional().nullable(),
    template_snapshot: TemplateSnapshotSchema,
    schedule_type: MarketingScheduleTypeSchema.default("now"),
    scheduled_at: z.string().datetime().optional().nullable(),
    recurrence_rule: z.string().max(200).optional().nullable(),
    cost_per_message: z.coerce.number().nonnegative().default(0),
    notes: z.string().max(500).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (
      val.schedule_type === "scheduled" &&
      (!val.scheduled_at || val.scheduled_at.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduled_at"],
        message: "scheduled_at wajib diisi untuk schedule_type=scheduled",
      });
    }
    if (val.audience_type === "custom" && val.audience_custom_recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audience_custom_recipients"],
        message: "Minimal 1 recipient untuk audience_type=custom",
      });
    }
  })
  .openapi("MarketingCampaignCreateRequest");
export type MarketingCampaignCreate = z.infer<
  typeof MarketingCampaignCreateSchema
>;

export const MarketingCampaignUpdateSchema = z
  .object({
    name: z.string().min(1).max(160).optional(),
    notes: z.string().max(500).optional().nullable(),
    scheduled_at: z.string().datetime().optional().nullable(),
    schedule_type: MarketingScheduleTypeSchema.optional(),
    cost_per_message: z.coerce.number().nonnegative().optional(),
  })
  .openapi("MarketingCampaignUpdateRequest");
export type MarketingCampaignUpdate = z.infer<
  typeof MarketingCampaignUpdateSchema
>;

export const MarketingCampaignTestSendSchema = z
  .object({
    contact: z.string().min(1, "Tujuan test wajib diisi").max(200),
    contact_label: z.string().max(120).optional(),
  })
  .openapi("MarketingCampaignTestSendRequest");
export type MarketingCampaignTestSend = z.infer<
  typeof MarketingCampaignTestSendSchema
>;

export const MarketingRecipientSchema = z
  .object({
    id: z.number().int().positive(),
    campaign_id: z.number().int().positive(),
    customer_id: z.number().int().positive().nullable(),
    contact: z.string(),
    contact_label: z.string().nullable(),
    rendered_message: z.string().nullable(),
    status: MarketingRecipientStatusSchema,
    cost: z.number().nonnegative(),
    provider_ref: z.string().nullable(),
    error_message: z.string().nullable(),
    sent_at: DateTimeStringSchema.nullable(),
    delivered_at: DateTimeStringSchema.nullable(),
    opened_at: DateTimeStringSchema.nullable(),
    clicked_at: DateTimeStringSchema.nullable(),
    created_at: DateTimeStringSchema.optional(),
    customer_name: z.string().optional(),
  })
  .openapi("MarketingCampaignRecipient");
export type MarketingRecipient = z.infer<typeof MarketingRecipientSchema>;

export const MarketingRecipientEventSchema = z
  .object({
    event: z.enum(["delivered", "opened", "clicked", "failed"]),
    error_message: z.string().max(500).optional(),
  })
  .openapi("MarketingRecipientEventRequest");
export type MarketingRecipientEvent = z.infer<
  typeof MarketingRecipientEventSchema
>;

export const MarketingCampaignReportSchema = z
  .object({
    campaign_id: z.number().int().positive(),
    total_recipients: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    opened: z.number().int().nonnegative(),
    clicked: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    delivery_rate: z.number().min(0).max(1),
    open_rate: z.number().min(0).max(1),
    click_rate: z.number().min(0).max(1),
    cost_total: z.number().nonnegative(),
  })
  .openapi("MarketingCampaignReport");
export type MarketingCampaignReport = z.infer<
  typeof MarketingCampaignReportSchema
>;

export const MarketingCreditTopupSchema = z
  .object({
    channel: MarketingChannelSchema,
    amount: z.coerce.number().positive(),
    notes: z.string().max(255).optional(),
  })
  .openapi("MarketingCreditTopupRequest");
export type MarketingCreditTopup = z.infer<typeof MarketingCreditTopupSchema>;

export const MarketingCreditEntrySchema = z
  .object({
    id: z.number().int().positive(),
    channel: MarketingChannelSchema,
    delta: z.number(),
    balance_after: z.number(),
    type: z.enum(["topup", "spend", "refund", "adjust"]),
    campaign_id: z.number().int().positive().nullable(),
    notes: z.string().nullable(),
    created_by: z.number().int().positive().nullable(),
    created_at: DateTimeStringSchema,
  })
  .openapi("MarketingCreditEntry");
export type MarketingCreditEntry = z.infer<typeof MarketingCreditEntrySchema>;

export const MarketingCreditBalanceSchema = z
  .object({
    whatsapp: z.number(),
    sms: z.number(),
    email: z.number(),
    instagram: z.number(),
  })
  .openapi("MarketingCreditBalance");
export type MarketingCreditBalance = z.infer<
  typeof MarketingCreditBalanceSchema
>;

// --- OpenAPI registrations -----------------------------------------------

const json = (schema: z.ZodTypeAny) => ({
  "application/json": { schema },
});
const okMessage = z.object({ message: z.string() });

registry.registerPath({
  method: "get",
  path: "/api/marketing/template",
  description: "List marketing templates (filter channel).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({ channel: MarketingChannelSchema.optional() }),
  },
  responses: {
    200: {
      description: "Array template",
      content: json(z.array(MarketingTemplateSchema)),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/marketing/template",
  description: "Buat template marketing baru.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(MarketingTemplateCreateSchema) },
  },
  responses: {
    201: {
      description: "Template dibuat",
      content: json(MarketingTemplateSchema),
    },
    400: {
      description: "Validation error",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/marketing/template/{id}",
  description: "Update template.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(MarketingTemplateUpdateSchema) },
  },
  responses: {
    200: {
      description: "Template diupdate",
      content: json(MarketingTemplateSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/marketing/template/{id}",
  description: "Hapus template.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: "Berhasil", content: json(okMessage) },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/marketing/campaign",
  description: "List campaigns (filter channel/status).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      channel: MarketingChannelSchema.optional(),
      status: MarketingCampaignStatusSchema.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Array campaign",
      content: json(
        z.object({
          items: z.array(MarketingCampaignSchema),
          total: z.number().int().nonnegative(),
        })
      ),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/marketing/campaign",
  description:
    "Buat campaign + resolve audience + render message per recipient. Status awal `draft` (atau `scheduled` kalau schedule_type=scheduled).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(MarketingCampaignCreateSchema) },
  },
  responses: {
    201: {
      description: "Campaign dibuat",
      content: json(MarketingCampaignSchema),
    },
    400: {
      description: "Validation error / audience kosong",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/marketing/campaign/{id}",
  description: "Detail campaign.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "Detail",
      content: json(MarketingCampaignSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/marketing/campaign/{id}",
  description: "Update campaign (hanya status draft/scheduled).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { required: true, content: json(MarketingCampaignUpdateSchema) },
  },
  responses: {
    200: {
      description: "Campaign diupdate",
      content: json(MarketingCampaignSchema),
    },
    400: {
      description: "Tidak bisa diupdate (status terkunci)",
      content: json(ErrorResponseSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/marketing/campaign/{id}",
  description: "Hapus / cancel campaign yang belum di-send.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: { description: "Berhasil", content: json(okMessage) },
    400: {
      description: "Tidak bisa dihapus",
      content: json(ErrorResponseSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/marketing/campaign/{id}/send",
  description:
    "Eksekusi kirim campaign (mark recipient sent + deduct credit + emit ledger). Tidak panggil provider eksternal — provider=mock akan transition ke status delivered langsung.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "Campaign sent",
      content: json(MarketingCampaignSchema),
    },
    400: {
      description: "Tidak bisa dikirim (saldo / status / dll)",
      content: json(ErrorResponseSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/marketing/campaign/{id}/test-send",
  description:
    "Test send 1 message ke nomor/email tester. Tidak deduct credit balance.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      required: true,
      content: json(MarketingCampaignTestSendSchema),
    },
  },
  responses: {
    200: {
      description: "Test send result",
      content: json(
        z.object({
          contact: z.string(),
          rendered_message: z.string(),
          provider: z.string(),
        })
      ),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/marketing/campaign/{id}/recipients",
  description: "List recipients per campaign.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema }),
    query: z.object({
      status: MarketingRecipientStatusSchema.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Array recipient",
      content: json(
        z.object({
          items: z.array(MarketingRecipientSchema),
          total: z.number().int().nonnegative(),
        })
      ),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/marketing/campaign/{id}/recipient/{recipientId}/event",
  description:
    "Catat event delivery per recipient (delivered / opened / clicked / failed). Dipanggil provider webhook (atau manual untuk testing).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: IdStringSchema, recipientId: IdStringSchema }),
    body: { required: true, content: json(MarketingRecipientEventSchema) },
  },
  responses: {
    200: {
      description: "Event tersimpan",
      content: json(MarketingRecipientSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/marketing/campaign/{id}/report",
  description: "Aggregate delivery/open/click rate + total cost.",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "Report",
      content: json(MarketingCampaignReportSchema),
    },
    404: {
      description: "Tidak ditemukan",
      content: json(ErrorResponseSchema),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/marketing/credit/balance",
  description: "Saldo kredit per channel (computed dari ledger).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Balance per channel",
      content: json(MarketingCreditBalanceSchema),
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/marketing/credit/ledger",
  description: "List ledger entries (filter channel).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      channel: MarketingChannelSchema.optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Array entries",
      content: json(
        z.object({
          items: z.array(MarketingCreditEntrySchema),
          total: z.number().int().nonnegative(),
        })
      ),
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/marketing/credit/topup",
  description: "Top up kredit untuk channel tertentu (admin).",
  tags: ["Marketing"],
  security: [{ bearerAuth: [] }],
  request: {
    body: { required: true, content: json(MarketingCreditTopupSchema) },
  },
  responses: {
    200: {
      description: "Top up berhasil + saldo baru",
      content: json(
        z.object({
          channel: MarketingChannelSchema,
          balance: z.number(),
          entry: MarketingCreditEntrySchema,
        })
      ),
    },
    400: {
      description: "Validation error",
      content: json(ErrorResponseSchema),
    },
  },
});
