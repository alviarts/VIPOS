// Schemas untuk endpoint /api/v1/appointment, /api/v1/staff,
// /api/v1/appointment-resource, /api/v1/calendar (P1-13 Appointment / Reservasi).

import { z, registry } from '../openapi';
import { DateTimeStringSchema, ErrorResponseSchema, IdStringSchema } from './common';

export const AppointmentStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const ResourceTypeSchema = z.enum(['room', 'table', 'chair', 'equipment', 'other']);

// ---------- STAFF ----------
export const StaffSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    role: z.string().nullable(),
    color: z.string().nullable(),
    is_active: z.coerce.number().int(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Staff');
export type Staff = z.infer<typeof StaffSchema>;

export const StaffCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  role: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  is_active: z.coerce.number().int().optional(),
});

export const StaffUpdateSchema = StaffCreateSchema.partial();

// ---------- RESOURCE ----------
export const AppointmentResourceSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    resource_type: ResourceTypeSchema,
    capacity: z.number().int(),
    is_active: z.coerce.number().int(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('AppointmentResource');
export type AppointmentResource = z.infer<typeof AppointmentResourceSchema>;

export const AppointmentResourceCreateSchema = z.object({
  name: z.string().min(1),
  resource_type: ResourceTypeSchema.optional().default('room'),
  capacity: z.coerce.number().int().positive().optional().default(1),
  is_active: z.coerce.number().int().optional(),
});
export const AppointmentResourceUpdateSchema = AppointmentResourceCreateSchema.partial();

// ---------- APPOINTMENT ----------
export const AppointmentServiceSchema = z.object({
  id: z.number().int().optional(),
  product_id: z.number().int().nullable().optional(),
  service_name: z.string(),
  qty: z.number().int().positive().default(1),
  price: z.number().nonnegative(),
  duration_minutes: z.number().int().nonnegative().default(0),
  subtotal: z.number().nonnegative().optional(),
});
export type AppointmentService = z.infer<typeof AppointmentServiceSchema>;

export const AppointmentServiceInputSchema = z.object({
  product_id: z.coerce.number().int().nullable().optional(),
  service_name: z.string().min(1),
  qty: z.coerce.number().int().positive().optional().default(1),
  price: z.coerce.number().nonnegative(),
  duration_minutes: z.coerce.number().int().nonnegative().optional().default(0),
});

export const AppointmentSchema = z
  .object({
    id: z.number().int().positive(),
    ref_no: z.string(),
    customer_id: z.number().int().nullable(),
    customer_name: z.string().nullable(),
    customer_phone: z.string().nullable(),
    staff_id: z.number().int().nullable(),
    staff_name: z.string().nullable().optional(),
    staff_color: z.string().nullable().optional(),
    resource_id: z.number().int().nullable(),
    resource_name: z.string().nullable().optional(),
    start_at: DateTimeStringSchema,
    end_at: DateTimeStringSchema,
    duration_minutes: z.number().int(),
    status: AppointmentStatusSchema,
    notes: z.string().nullable(),
    deposit_amount: z.number(),
    total: z.number(),
    transaction_id: z.number().int().nullable(),
    checked_in_at: DateTimeStringSchema.nullable(),
    completed_at: DateTimeStringSchema.nullable(),
    cancelled_at: DateTimeStringSchema.nullable(),
    cancel_reason: z.string().nullable(),
    reminders_config: z.unknown().nullable().optional(),
    reminder_24h_sent_at: DateTimeStringSchema.nullable(),
    reminder_1h_sent_at: DateTimeStringSchema.nullable(),
    services: z.array(AppointmentServiceSchema).optional(),
    created_at: DateTimeStringSchema.optional(),
    updated_at: DateTimeStringSchema.optional(),
  })
  .openapi('Appointment');
export type Appointment = z.infer<typeof AppointmentSchema>;

export const AppointmentCreateSchema = z.object({
  customer_id: z.coerce.number().int().nullable().optional(),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional().nullable(),
  staff_id: z.coerce.number().int().nullable().optional(),
  resource_id: z.coerce.number().int().nullable().optional(),
  start_at: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive().optional(),
  status: AppointmentStatusSchema.optional().default('PENDING'),
  notes: z.string().optional().nullable(),
  deposit_amount: z.coerce.number().nonnegative().optional().default(0),
  reminders_config: z.unknown().optional(),
  services: z.array(AppointmentServiceInputSchema).min(1, 'Minimal 1 layanan'),
});

export const AppointmentUpdateSchema = z.object({
  customer_id: z.coerce.number().int().nullable().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional().nullable(),
  staff_id: z.coerce.number().int().nullable().optional(),
  resource_id: z.coerce.number().int().nullable().optional(),
  start_at: z.string().optional(),
  duration_minutes: z.coerce.number().int().positive().optional(),
  notes: z.string().optional().nullable(),
  deposit_amount: z.coerce.number().nonnegative().optional(),
  reminders_config: z.unknown().optional(),
  services: z.array(AppointmentServiceInputSchema).optional(),
});

export const AppointmentRescheduleSchema = z.object({
  start_at: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive().optional(),
  staff_id: z.coerce.number().int().nullable().optional(),
  resource_id: z.coerce.number().int().nullable().optional(),
});

export const AppointmentCancelSchema = z.object({
  reason: z.string().optional().nullable(),
});

// ---------- CALENDAR ----------
export const CalendarSlotSchema = z.object({
  id: z.number().int(),
  ref_no: z.string(),
  start_at: DateTimeStringSchema,
  end_at: DateTimeStringSchema,
  status: AppointmentStatusSchema,
  customer_name: z.string().nullable(),
  staff_id: z.number().int().nullable(),
  staff_name: z.string().nullable(),
  staff_color: z.string().nullable(),
  resource_id: z.number().int().nullable(),
  resource_name: z.string().nullable(),
  service_summary: z.string().nullable(),
  total: z.number(),
});

export const CalendarResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  appointments: z.array(CalendarSlotSchema),
  staff: z.array(StaffSchema),
  resources: z.array(AppointmentResourceSchema),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;

// ============================================================
// OpenAPI registry
// ============================================================
const tags = ['Appointment'];

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

// Staff
registry.registerPath({
  method: 'get',
  path: '/api/v1/staff',
  tags,
  summary: 'List staff',
  responses: listResponse(StaffSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/staff',
  tags,
  summary: 'Create staff',
  request: {
    body: { content: { 'application/json': { schema: StaffCreateSchema } } },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: StaffSchema } },
    },
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/staff/{id}',
  tags,
  summary: 'Update staff',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { content: { 'application/json': { schema: StaffUpdateSchema } } },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: StaffSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/staff/{id}',
  tags,
  summary: 'Delete staff',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: 'Deleted' }, ...notFound() },
});

// Resource
registry.registerPath({
  method: 'get',
  path: '/api/v1/appointment-resource',
  tags,
  summary: 'List appointment resources',
  responses: listResponse(AppointmentResourceSchema),
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment-resource',
  tags,
  summary: 'Create resource',
  request: {
    body: {
      content: {
        'application/json': { schema: AppointmentResourceCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: AppointmentResourceSchema } },
    },
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/appointment-resource/{id}',
  tags,
  summary: 'Update resource',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        'application/json': { schema: AppointmentResourceUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: AppointmentResourceSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/appointment-resource/{id}',
  tags,
  summary: 'Delete resource',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: 'Deleted' }, ...notFound() },
});

// Appointment
registry.registerPath({
  method: 'get',
  path: '/api/v1/appointment',
  tags,
  summary: 'List appointments',
  request: {
    query: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      status: AppointmentStatusSchema.optional(),
      staff_id: z.string().optional(),
      customer_id: z.string().optional(),
    }),
  },
  responses: listResponse(AppointmentSchema),
});
registry.registerPath({
  method: 'get',
  path: '/api/v1/appointment/{id}',
  tags,
  summary: 'Get appointment detail',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment',
  tags,
  summary: 'Create appointment',
  request: {
    body: {
      content: { 'application/json': { schema: AppointmentCreateSchema } },
    },
  },
  responses: {
    201: {
      description: 'Created',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'put',
  path: '/api/v1/appointment/{id}',
  tags,
  summary: 'Update appointment',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { 'application/json': { schema: AppointmentUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: 'Updated',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: 'delete',
  path: '/api/v1/appointment/{id}',
  tags,
  summary: 'Delete appointment',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: 'Deleted' }, ...notFound() },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/confirm',
  tags,
  summary: 'Confirm appointment (PENDING → CONFIRMED)',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/checkin',
  tags,
  summary: 'Check-in appointment (CONFIRMED → IN_PROGRESS)',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/complete',
  tags,
  summary: 'Complete appointment',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/cancel',
  tags,
  summary: 'Cancel appointment',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { 'application/json': { schema: AppointmentCancelSchema } },
    },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/no-show',
  tags,
  summary: 'Mark no-show',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/reschedule',
  tags,
  summary: 'Reschedule appointment',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        'application/json': { schema: AppointmentRescheduleSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/send-reminder',
  tags,
  summary: 'Send reminder (24h or 1h)',
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ window: z.enum(['24h', '1h']) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});
registry.registerPath({
  method: 'post',
  path: '/api/v1/appointment/{id}/convert',
  tags,
  summary: 'Convert appointment to transaction',
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: AppointmentSchema } },
    },
  },
});

// Calendar
registry.registerPath({
  method: 'get',
  path: '/api/v1/calendar',
  tags,
  summary: 'Calendar view (appointments + staff + resources within range)',
  request: {
    query: z.object({
      from: z.string(),
      to: z.string(),
      staff_id: z.string().optional(),
      resource_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: CalendarResponseSchema } },
    },
  },
});
