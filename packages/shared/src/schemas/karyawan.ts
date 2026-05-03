// Schemas untuk P1-14 (Karyawan + Payroll + Absensi + Schedule + Approval).
//
// Endpoint:
//   /api/employee, /api/employee/:id/document, /api/employee/:id/permissions
//   /api/payroll-settings (single-row), /api/payroll-structure (CRUD),
//     /api/payroll-run (CRUD + calculate + approve + paid),
//   /api/attendance (log + manual), /api/attendance-geofence,
//   /api/shift, /api/schedule (assign + swap),
//   /api/approval-chain.

import { z, registry } from "../openapi";
import { ErrorResponseSchema, IdStringSchema } from "./common";

// ================== ENUMS ==================
export const EmployeeStatusSchema = z.enum(["active", "resigned", "on_leave"]);
export const EmployeeTypeSchema = z.enum([
  "permanent",
  "contract",
  "intern",
  "freelance",
]);
export const EmployeeRoleSchema = z.enum([
  "admin",
  "manager",
  "cashier",
  "staff",
  "waiters",
]);
export const PayrollPeriodSchema = z.enum(["monthly", "biweekly", "weekly"]);
export const TaxMethodSchema = z.enum([
  "gross",
  "nett",
  "progressive",
  "gross-up",
]);
export const PayrollRunStatusSchema = z.enum([
  "DRAFT",
  "CALCULATED",
  "APPROVED",
  "PAID",
  "VOIDED",
]);
export const AttendanceLogTypeSchema = z.enum([
  "check_in",
  "check_out",
  "break_start",
  "break_end",
]);
export const AttendanceMethodSchema = z.enum([
  "gps",
  "selfie",
  "nfc",
  "manual",
  "qr",
]);
export const ApprovalDomainSchema = z.enum([
  "purchase",
  "finance",
  "leave",
  "overtime",
  "attendance_correction",
  "other",
]);
export const SwapStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

// ================== EMPLOYEE ==================
export const EmployeeSchema = z
  .object({
    id: z.number().int().positive(),
    user_id: z.number().int().nullable(),
    employee_no: z.string(),
    name: z.string(),
    photo_url: z.string().nullable(),
    nik_ktp: z.string().nullable(),
    npwp: z.string().nullable(),
    birth_date: z.string().nullable(),
    birth_place: z.string().nullable(),
    gender: z.enum(["M", "F"]).nullable(),
    marital_status: z.string().nullable(),
    religion: z.string().nullable(),
    blood_type: z.string().nullable(),
    nationality: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    address_ktp: z.string().nullable(),
    emergency_contact_name: z.string().nullable(),
    emergency_contact_relation: z.string().nullable(),
    emergency_contact_phone: z.string().nullable(),
    department_id: z.number().int().nullable(),
    department_name: z.string().nullable().optional(),
    position: z.string().nullable(),
    employee_type: EmployeeTypeSchema,
    date_joined: z.string().nullable(),
    date_resigned: z.string().nullable(),
    role: EmployeeRoleSchema,
    payroll_structure_id: z.number().int().nullable(),
    payroll_structure_name: z.string().nullable().optional(),
    bank_name: z.string().nullable(),
    bank_account_no: z.string().nullable(),
    bank_account_name: z.string().nullable(),
    base_salary: z.number(),
    pin_code: z.string().nullable(),
    attendance_methods: z.unknown().nullable().optional(),
    allowed_outlet_ids: z.unknown().nullable().optional(),
    status: EmployeeStatusSchema,
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("Employee");
export type Employee = z.infer<typeof EmployeeSchema>;

export const EmployeeCreateSchema = z.object({
  name: z.string().min(1),
  nik_ktp: z.string().optional().nullable(),
  npwp: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  birth_place: z.string().optional().nullable(),
  gender: z.enum(["M", "F"]).optional().nullable(),
  marital_status: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  blood_type: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  address_ktp: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_relation: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  department_id: z.coerce.number().int().nullable().optional(),
  position: z.string().optional().nullable(),
  employee_type: EmployeeTypeSchema.optional().default("permanent"),
  date_joined: z.string().optional().nullable(),
  date_resigned: z.string().optional().nullable(),
  role: EmployeeRoleSchema.optional().default("cashier"),
  payroll_structure_id: z.coerce.number().int().nullable().optional(),
  bank_name: z.string().optional().nullable(),
  bank_account_no: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  base_salary: z.coerce.number().nonnegative().optional().default(0),
  pin_code: z.string().optional().nullable(),
  attendance_methods: z.array(AttendanceMethodSchema).optional(),
  allowed_outlet_ids: z.array(z.number().int()).optional(),
  status: EmployeeStatusSchema.optional().default("active"),
  photo_url: z.string().optional().nullable(),
});
export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

// ================== EMPLOYEE DOCUMENT ==================
export const EmployeeDocumentSchema = z
  .object({
    id: z.number().int(),
    employee_id: z.number().int(),
    doc_type: z.string(),
    file_url: z.string(),
    file_name: z.string().nullable(),
    uploaded_at: z.string(),
  })
  .openapi("EmployeeDocument");

export const EmployeeDocumentCreateSchema = z.object({
  doc_type: z.string().min(1),
  file_url: z.string().min(1),
  file_name: z.string().optional().nullable(),
});

// ================== PERMISSION OVERRIDES ==================
export const PermissionOverrideSchema = z.object({
  id: z.number().int(),
  employee_id: z.number().int(),
  permission_key: z.string(),
  granted: z.coerce.number().int(),
  created_at: z.string().optional(),
});

export const PermissionAssignSchema = z.object({
  permissions: z.array(
    z.object({
      permission_key: z.string().min(1),
      granted: z.coerce.boolean(),
    })
  ),
});

// ================== PAYROLL SETTINGS ==================
export const PayrollSettingsSchema = z
  .object({
    id: z.number().int().optional(),
    period: PayrollPeriodSchema,
    cutoff_day: z.number().int(),
    payment_day: z.number().int(),
    working_hours_per_month: z.number(),
    overtime_multiplier: z.number(),
    tax_method: TaxMethodSchema,
    bpjs_kesehatan_employee: z.number(),
    bpjs_jht_employee: z.number(),
    bpjs_jp_employee: z.number(),
    updated_at: z.string().optional(),
  })
  .openapi("PayrollSettings");

export const PayrollSettingsUpdateSchema = z.object({
  period: PayrollPeriodSchema.optional(),
  cutoff_day: z.coerce.number().int().min(1).max(31).optional(),
  payment_day: z.coerce.number().int().min(1).max(31).optional(),
  working_hours_per_month: z.coerce.number().positive().optional(),
  overtime_multiplier: z.coerce.number().positive().optional(),
  tax_method: TaxMethodSchema.optional(),
  bpjs_kesehatan_employee: z.coerce.number().nonnegative().optional(),
  bpjs_jht_employee: z.coerce.number().nonnegative().optional(),
  bpjs_jp_employee: z.coerce.number().nonnegative().optional(),
});

// ================== PAYROLL STRUCTURE ==================
export const AllowanceItemSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  amount: z.coerce.number(),
});
export const DeductionItemSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  amount: z.coerce.number(),
});

export const PayrollStructureSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    basic_salary: z.number(),
    allowances: z.array(AllowanceItemSchema),
    deductions: z.array(DeductionItemSchema),
    overtime_rate: z.number(),
    include_bpjs: z.coerce.number().int(),
    include_pph21: z.coerce.number().int(),
    is_active: z.coerce.number().int(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("PayrollStructure");

export const PayrollStructureCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  basic_salary: z.coerce.number().nonnegative(),
  allowances: z.array(AllowanceItemSchema).optional().default([]),
  deductions: z.array(DeductionItemSchema).optional().default([]),
  overtime_rate: z.coerce.number().nonnegative().optional().default(0),
  include_bpjs: z.coerce.number().int().optional().default(1),
  include_pph21: z.coerce.number().int().optional().default(1),
  is_active: z.coerce.number().int().optional().default(1),
});
export const PayrollStructureUpdateSchema =
  PayrollStructureCreateSchema.partial();

// ================== PAYROLL RUN + PAYSLIP ==================
export const PayslipSchema = z.object({
  id: z.number().int(),
  payroll_run_id: z.number().int(),
  employee_id: z.number().int(),
  employee_no: z.string().nullable(),
  employee_name: z.string().nullable(),
  structure_id: z.number().int().nullable(),
  basic_salary: z.number(),
  total_allowances: z.number(),
  total_deductions: z.number(),
  overtime_hours: z.number(),
  overtime_amount: z.number(),
  bpjs_kesehatan: z.number(),
  bpjs_jht: z.number(),
  bpjs_jp: z.number(),
  pph21: z.number(),
  gross_salary: z.number(),
  net_salary: z.number(),
  breakdown: z.unknown().nullable().optional(),
  bank_name: z.string().nullable(),
  bank_account_no: z.string().nullable(),
  created_at: z.string().optional(),
});

export const PayrollRunSchema = z
  .object({
    id: z.number().int(),
    ref_no: z.string(),
    period_start: z.string(),
    period_end: z.string(),
    payment_date: z.string().nullable(),
    status: PayrollRunStatusSchema,
    total_gross: z.number(),
    total_deductions: z.number(),
    total_net: z.number(),
    employee_count: z.number().int(),
    notes: z.string().nullable(),
    payslips: z.array(PayslipSchema).optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("PayrollRun");

export const PayrollRunCreateSchema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  payment_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ================== ATTENDANCE ==================
export const AttendanceLogSchema = z
  .object({
    id: z.number().int(),
    employee_id: z.number().int(),
    employee_name: z.string().nullable().optional(),
    log_type: AttendanceLogTypeSchema,
    logged_at: z.string(),
    method: AttendanceMethodSchema,
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    photo_url: z.string().nullable(),
    note: z.string().nullable(),
    is_off_site: z.coerce.number().int(),
    approved_by: z.number().int().nullable(),
    approved_at: z.string().nullable(),
    created_at: z.string().optional(),
  })
  .openapi("AttendanceLog");

export const AttendanceLogCreateSchema = z.object({
  employee_id: z.coerce.number().int(),
  log_type: AttendanceLogTypeSchema,
  logged_at: z.string().optional(),
  method: AttendanceMethodSchema.optional().default("manual"),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  is_off_site: z.coerce.boolean().optional(),
});

export const AttendanceGeofenceSchema = z
  .object({
    id: z.number().int(),
    outlet_id: z.number().int(),
    outlet_name: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    radius_m: z.number().int(),
    strict_mode: z.coerce.number().int(),
    updated_at: z.string().optional(),
  })
  .openapi("AttendanceGeofence");

export const AttendanceGeofenceUpsertSchema = z.object({
  outlet_id: z.coerce.number().int(),
  outlet_name: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  radius_m: z.coerce.number().int().min(50).max(500).optional().default(100),
  strict_mode: z.coerce.number().int().optional().default(0),
});

// ================== SHIFT + SCHEDULE ==================
export const ShiftSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    break_minutes: z.number().int(),
    color: z.string(),
    is_active: z.coerce.number().int(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("Shift");

export const ShiftCreateSchema = z.object({
  name: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  break_minutes: z.coerce.number().int().nonnegative().optional().default(0),
  color: z.string().optional().default("#04C99E"),
  is_active: z.coerce.number().int().optional().default(1),
});
export const ShiftUpdateSchema = ShiftCreateSchema.partial();

export const ScheduleAssignmentSchema = z
  .object({
    id: z.number().int(),
    employee_id: z.number().int(),
    employee_name: z.string().nullable().optional(),
    shift_id: z.number().int().nullable(),
    shift_name: z.string().nullable().optional(),
    shift_start: z.string().nullable().optional(),
    shift_end: z.string().nullable().optional(),
    schedule_date: z.string(),
    is_off: z.coerce.number().int(),
    note: z.string().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("ScheduleAssignment");

export const ScheduleAssignSchema = z.object({
  assignments: z.array(
    z.object({
      employee_id: z.coerce.number().int(),
      shift_id: z.coerce.number().int().nullable().optional(),
      schedule_date: z.string().min(1),
      is_off: z.coerce.boolean().optional(),
      note: z.string().optional().nullable(),
    })
  ),
});

export const ScheduleSwapSchema = z
  .object({
    id: z.number().int(),
    requester_id: z.number().int(),
    requester_name: z.string().nullable().optional(),
    requester_assignment_id: z.number().int(),
    partner_id: z.number().int(),
    partner_name: z.string().nullable().optional(),
    partner_assignment_id: z.number().int(),
    reason: z.string().nullable(),
    status: SwapStatusSchema,
    decided_by: z.number().int().nullable(),
    decided_at: z.string().nullable(),
    decision_note: z.string().nullable(),
    created_at: z.string().optional(),
  })
  .openapi("ScheduleSwap");

export const ScheduleSwapCreateSchema = z.object({
  requester_id: z.coerce.number().int(),
  requester_assignment_id: z.coerce.number().int(),
  partner_id: z.coerce.number().int(),
  partner_assignment_id: z.coerce.number().int(),
  reason: z.string().optional().nullable(),
});
export const ScheduleSwapDecisionSchema = z.object({
  decision_note: z.string().optional().nullable(),
});

// ================== APPROVAL CHAIN ==================
export const ApprovalChainStepSchema = z.object({
  order: z.coerce.number().int(),
  approver_role: EmployeeRoleSchema.optional(),
  approver_employee_id: z.coerce.number().int().optional(),
  label: z.string().optional(),
});

export const ApprovalChainSchema = z
  .object({
    id: z.number().int(),
    domain: ApprovalDomainSchema,
    name: z.string(),
    threshold_amount: z.number(),
    steps: z.array(ApprovalChainStepSchema),
    is_active: z.coerce.number().int(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("ApprovalChain");

export const ApprovalChainCreateSchema = z.object({
  domain: ApprovalDomainSchema,
  name: z.string().min(1),
  threshold_amount: z.coerce.number().nonnegative().optional().default(0),
  steps: z.array(ApprovalChainStepSchema).min(1),
  is_active: z.coerce.number().int().optional().default(1),
});
export const ApprovalChainUpdateSchema = ApprovalChainCreateSchema.partial();

// ============================================================
// OpenAPI registry
// ============================================================
const tags = ["Karyawan"];

function listResponse(itemSchema: z.ZodTypeAny) {
  return {
    200: {
      description: "List",
      content: { "application/json": { schema: z.array(itemSchema) } },
    },
  };
}
function notFound() {
  return {
    404: {
      description: "Not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  };
}

// Employee
registry.registerPath({
  method: "get",
  path: "/api/employee",
  tags,
  summary: "List employees",
  responses: listResponse(EmployeeSchema),
});
registry.registerPath({
  method: "get",
  path: "/api/employee/{id}",
  tags,
  summary: "Get employee detail",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: EmployeeSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: "post",
  path: "/api/employee",
  tags,
  summary: "Create employee",
  request: {
    body: {
      content: { "application/json": { schema: EmployeeCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: EmployeeSchema } },
    },
  },
});
registry.registerPath({
  method: "put",
  path: "/api/employee/{id}",
  tags,
  summary: "Update employee",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { "application/json": { schema: EmployeeUpdateSchema } },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: EmployeeSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/employee/{id}",
  tags,
  summary: "Delete employee (soft, set status=resigned)",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "Deleted" }, ...notFound() },
});

// Documents
registry.registerPath({
  method: "post",
  path: "/api/employee/{id}/document",
  tags,
  summary: "Add document",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        "application/json": { schema: EmployeeDocumentCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: EmployeeDocumentSchema } },
    },
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/employee/{id}/document/{documentId}",
  tags,
  summary: "Delete document",
  request: {
    params: z.object({ id: IdStringSchema, documentId: IdStringSchema }),
  },
  responses: { 200: { description: "Deleted" } },
});

// Permissions
registry.registerPath({
  method: "get",
  path: "/api/employee/{id}/permissions",
  tags,
  summary: "List permission overrides",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: listResponse(PermissionOverrideSchema),
});
registry.registerPath({
  method: "put",
  path: "/api/employee/{id}/permissions",
  tags,
  summary: "Bulk assign permissions",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: { "application/json": { schema: PermissionAssignSchema } },
    },
  },
  responses: { 200: { description: "OK" } },
});

// Payroll settings
registry.registerPath({
  method: "get",
  path: "/api/payroll-settings",
  tags,
  summary: "Get payroll settings",
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollSettingsSchema } },
    },
  },
});
registry.registerPath({
  method: "put",
  path: "/api/payroll-settings",
  tags,
  summary: "Update payroll settings",
  request: {
    body: {
      content: {
        "application/json": { schema: PayrollSettingsUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollSettingsSchema } },
    },
  },
});

// Payroll structure
registry.registerPath({
  method: "get",
  path: "/api/payroll-structure",
  tags,
  summary: "List structures",
  responses: listResponse(PayrollStructureSchema),
});
registry.registerPath({
  method: "post",
  path: "/api/payroll-structure",
  tags,
  summary: "Create structure",
  request: {
    body: {
      content: {
        "application/json": { schema: PayrollStructureCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: PayrollStructureSchema } },
    },
  },
});
registry.registerPath({
  method: "put",
  path: "/api/payroll-structure/{id}",
  tags,
  summary: "Update structure",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        "application/json": { schema: PayrollStructureUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollStructureSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/payroll-structure/{id}",
  tags,
  summary: "Delete structure",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "Deleted" } },
});

// Payroll run
registry.registerPath({
  method: "get",
  path: "/api/payroll-run",
  tags,
  summary: "List payroll runs",
  responses: listResponse(PayrollRunSchema),
});
registry.registerPath({
  method: "get",
  path: "/api/payroll-run/{id}",
  tags,
  summary: "Get payroll run with payslips",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollRunSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: "post",
  path: "/api/payroll-run",
  tags,
  summary: "Create payroll run (DRAFT)",
  request: {
    body: {
      content: { "application/json": { schema: PayrollRunCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: PayrollRunSchema } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/payroll-run/{id}/calculate",
  tags,
  summary: "Calculate payslips for run",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollRunSchema } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/payroll-run/{id}/approve",
  tags,
  summary: "Approve calculated run",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollRunSchema } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/payroll-run/{id}/paid",
  tags,
  summary: "Mark run as paid",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: PayrollRunSchema } },
    },
  },
});
registry.registerPath({
  method: "get",
  path: "/api/payroll-run/{id}/bank-file",
  tags,
  summary: "Download bank transfer CSV",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "CSV file" } },
});

// Attendance
registry.registerPath({
  method: "get",
  path: "/api/attendance",
  tags,
  summary: "List attendance logs",
  responses: listResponse(AttendanceLogSchema),
});
registry.registerPath({
  method: "post",
  path: "/api/attendance",
  tags,
  summary: "Add attendance log",
  request: {
    body: {
      content: { "application/json": { schema: AttendanceLogCreateSchema } },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: AttendanceLogSchema } },
    },
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/attendance/{id}",
  tags,
  summary: "Delete attendance log",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "Deleted" } },
});

registry.registerPath({
  method: "get",
  path: "/api/attendance-geofence",
  tags,
  summary: "List geofences",
  responses: listResponse(AttendanceGeofenceSchema),
});
registry.registerPath({
  method: "put",
  path: "/api/attendance-geofence",
  tags,
  summary: "Upsert geofence (by outlet_id)",
  request: {
    body: {
      content: {
        "application/json": { schema: AttendanceGeofenceUpsertSchema },
      },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: AttendanceGeofenceSchema } },
    },
  },
});

// Shift
registry.registerPath({
  method: "get",
  path: "/api/shift",
  tags,
  summary: "List shifts",
  responses: listResponse(ShiftSchema),
});
registry.registerPath({
  method: "post",
  path: "/api/shift",
  tags,
  summary: "Create shift",
  request: {
    body: { content: { "application/json": { schema: ShiftCreateSchema } } },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: ShiftSchema } },
    },
  },
});
registry.registerPath({
  method: "put",
  path: "/api/shift/{id}",
  tags,
  summary: "Update shift",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: { content: { "application/json": { schema: ShiftUpdateSchema } } },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: ShiftSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/shift/{id}",
  tags,
  summary: "Delete shift",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "Deleted" } },
});

// Schedule
registry.registerPath({
  method: "get",
  path: "/api/schedule",
  tags,
  summary: "List schedule assignments (range)",
  request: {
    query: z.object({
      from: z.string(),
      to: z.string(),
      employee_id: z.string().optional(),
    }),
  },
  responses: listResponse(ScheduleAssignmentSchema),
});
registry.registerPath({
  method: "post",
  path: "/api/schedule/assign",
  tags,
  summary: "Bulk assign shifts",
  request: {
    body: {
      content: { "application/json": { schema: ScheduleAssignSchema } },
    },
  },
  responses: { 200: { description: "OK" } },
});
registry.registerPath({
  method: "delete",
  path: "/api/schedule/{id}",
  tags,
  summary: "Delete schedule assignment",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "Deleted" } },
});

registry.registerPath({
  method: "get",
  path: "/api/schedule-swap",
  tags,
  summary: "List swap requests",
  responses: listResponse(ScheduleSwapSchema),
});
registry.registerPath({
  method: "post",
  path: "/api/schedule-swap",
  tags,
  summary: "Create swap request",
  request: {
    body: {
      content: {
        "application/json": { schema: ScheduleSwapCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: ScheduleSwapSchema } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/schedule-swap/{id}/approve",
  tags,
  summary: "Approve swap (atomic exchange of dates/shifts)",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        "application/json": { schema: ScheduleSwapDecisionSchema },
      },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: ScheduleSwapSchema } },
    },
  },
});
registry.registerPath({
  method: "post",
  path: "/api/schedule-swap/{id}/reject",
  tags,
  summary: "Reject swap",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        "application/json": { schema: ScheduleSwapDecisionSchema },
      },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: ScheduleSwapSchema } },
    },
  },
});

// Approval chain
registry.registerPath({
  method: "get",
  path: "/api/approval-chain",
  tags,
  summary: "List approval chains",
  responses: listResponse(ApprovalChainSchema),
});
registry.registerPath({
  method: "post",
  path: "/api/approval-chain",
  tags,
  summary: "Create approval chain",
  request: {
    body: {
      content: {
        "application/json": { schema: ApprovalChainCreateSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Created",
      content: { "application/json": { schema: ApprovalChainSchema } },
    },
  },
});
registry.registerPath({
  method: "put",
  path: "/api/approval-chain/{id}",
  tags,
  summary: "Update approval chain",
  request: {
    params: z.object({ id: IdStringSchema }),
    body: {
      content: {
        "application/json": { schema: ApprovalChainUpdateSchema },
      },
    },
  },
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: ApprovalChainSchema } },
    },
    ...notFound(),
  },
});
registry.registerPath({
  method: "delete",
  path: "/api/approval-chain/{id}",
  tags,
  summary: "Delete approval chain",
  request: { params: z.object({ id: IdStringSchema }) },
  responses: { 200: { description: "Deleted" } },
});
