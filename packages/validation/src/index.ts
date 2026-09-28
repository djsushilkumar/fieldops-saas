import { z } from 'zod';
import {
  UserRole,
  MembershipStatus,
  InvitationStatus,
  AuthState,
  Priority,
  TaskStatus,
  VisitStatus,
  AttendanceStatus,
  CheckInResult,
  ErrorCode,
  LocationStatus,
  LocationVerificationResult,
  ProofType,
  LocationEventType,
  WorkerActivityType,
  UUID,
  TenantId,
  UserId,
  TeamId,
  LocationId,
  VisitId,
  TaskId,
  AttendanceId,
  IsoDateTime,
} from '@fieldops/types';

// =============================================================================
// 1. PRIMITIVE SCHEMAS
// =============================================================================

/**
 * Validates canonical UUID string (RFC 4122 v4 or v7).
 */
export const uuidSchema = z
  .string()
  .uuid('Must be a valid UUID format')
  .transform((val) => val as UUID);

export const tenantIdSchema = uuidSchema.transform((val) => val as unknown as TenantId);
export const userIdSchema = uuidSchema.transform((val) => val as unknown as UserId);
export const teamIdSchema = uuidSchema.transform((val) => val as unknown as TeamId);
export const locationIdSchema = uuidSchema.transform((val) => val as unknown as LocationId);
export const visitIdSchema = uuidSchema.transform((val) => val as unknown as VisitId);
export const taskIdSchema = uuidSchema.transform((val) => val as unknown as TaskId);
export const attendanceIdSchema = uuidSchema.transform((val) => val as unknown as AttendanceId);

/**
 * Validates ISO-8601 UTC timestamp format.
 */
export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Timestamp must be an ISO-8601 formatted date string' })
  .transform((val) => val as IsoDateTime);

export const latitudeSchema = z
  .number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

export const longitudeSchema = z
  .number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

/**
 * Strict slug validation: 3-63 chars, lowercase alphanumeric and single hyphens.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters long')
  .max(63, 'Slug cannot exceed 63 characters')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must consist of lowercase letters, numbers, and single hyphens without leading or trailing hyphens');

/**
 * Strict email validation.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address');

/**
 * Production SaaS password policy:
 * - At least 8 characters
 * - At least 1 lowercase letter
 * - At least 1 uppercase letter
 * - At least 1 digit
 * - At least 1 special symbol
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// =============================================================================
// 2. ENUM SCHEMAS
// =============================================================================

export const userRoleSchema = z.nativeEnum(UserRole);
export const membershipStatusSchema = z.nativeEnum(MembershipStatus);
export const invitationStatusSchema = z.nativeEnum(InvitationStatus);
export const authStateSchema = z.nativeEnum(AuthState);
export const prioritySchema = z.nativeEnum(Priority);
export const taskStatusSchema = z.nativeEnum(TaskStatus);
export const visitStatusSchema = z.nativeEnum(VisitStatus);
export const attendanceStatusSchema = z.nativeEnum(AttendanceStatus);
export const checkInResultSchema = z.nativeEnum(CheckInResult);
export const errorCodeSchema = z.nativeEnum(ErrorCode);
export const locationStatusSchema = z.nativeEnum(LocationStatus);
export const locationVerificationResultSchema = z.nativeEnum(LocationVerificationResult);
export const proofTypeSchema = z.nativeEnum(ProofType);
export const locationEventTypeSchema = z.nativeEnum(LocationEventType);
export const workerActivityTypeSchema = z.nativeEnum(WorkerActivityType);

// =============================================================================
// 3. API ENVELOPE SCHEMAS
// =============================================================================

export const apiErrorDetailSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  request_id: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: apiErrorDetailSchema,
});

export const apiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(z.unknown()).optional(),
  });

// =============================================================================
// 4. AUTHENTICATION & IDENTITY SCHEMAS
// =============================================================================

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  organizationName: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(100).optional(),
  organizationSlug: slugSchema.optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  displayName: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  timezone: z.string().trim().max(100).optional(),
  avatarUrl: z.string().url('Must be a valid URL').optional(),
});

// =============================================================================
// 5. ORGANIZATION & MEMBERSHIP SCHEMAS
// =============================================================================

export const organizationSettingsSchema = z.object({
  allowedRadiusMeters: z.number().int().positive().default(100),
  timezone: z.string().default('UTC'),
  requirePhotoProof: z.boolean().default(true),
  requireSignature: z.boolean().default(true),
}).passthrough();

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(100),
  slug: slugSchema,
  settings: organizationSettingsSchema.optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  settings: organizationSettingsSchema.partial().optional(),
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: userRoleSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(16, 'Invalid invitation token format'),
  fullName: z.string().trim().min(2).max(100).optional(),
  password: passwordSchema.optional(),
});

export const updateMemberRoleSchema = z.object({
  role: userRoleSchema,
});

export const updateMemberStatusSchema = z.object({
  status: z.enum([MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED, MembershipStatus.REMOVED]),
});

export const switchOrganizationSchema = z.object({
  organizationId: tenantIdSchema,
});

// =============================================================================
// 6. PHASE 04 TASK MANAGEMENT SCHEMAS
// =============================================================================

export const createChecklistItemSchema = z.object({
  title: z.string().trim().min(1, 'Checklist item title cannot be empty').max(255),
  isRequired: z.boolean().default(true),
});

export const toggleChecklistItemSchema = z.object({
  isCompleted: z.boolean(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters long').max(255),
  description: z.string().trim().max(10000).optional(),
  priority: prioritySchema.default(Priority.MEDIUM),
  assignedTo: userIdSchema.optional(),
  assignedTeam: teamIdSchema.optional(),
  dueAt: isoDateTimeSchema.optional(),
  checklists: z.array(createChecklistItemSchema).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().max(10000).optional(),
  priority: prioritySchema.optional(),
  assignedTo: userIdSchema.nullable().optional(),
  assignedTeam: teamIdSchema.nullable().optional(),
  dueAt: isoDateTimeSchema.nullable().optional(),
  version: z.number().int().positive('Version is required for optimistic concurrency'),
});

export const assignTaskSchema = z.object({
  assignedTo: userIdSchema.optional(),
  assignedTeam: teamIdSchema.optional(),
}).refine(
  (data) => data.assignedTo !== undefined || data.assignedTeam !== undefined,
  { message: 'Must specify either an assignee or an assigned team' }
);

export const transitionTaskStatusSchema = z.object({
  status: taskStatusSchema,
  blockedReason: z.string().trim().max(1000).optional(),
  reopenReason: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const createAttachmentMetadataSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z
    .string()
    .regex(
      /^(image\/(jpeg|png|webp|gif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/,
      'Allowed file types: JPG, PNG, WEBP, GIF, PDF, DOC, DOCX, TXT'
    ),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024, 'Max attachment file size is 25MB'),
  storagePath: z.string().trim().min(1),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});

export const taskFilterSchema = z.object({
  status: z.union([taskStatusSchema, z.array(taskStatusSchema)]).optional(),
  priority: z.union([prioritySchema, z.array(prioritySchema)]).optional(),
  assignedTo: userIdSchema.optional(),
  assignedTeam: teamIdSchema.optional(),
  isOverdue: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  fromDate: isoDateTimeSchema.optional(),
  toDate: isoDateTimeSchema.optional(),
});

export const taskSortSchema = z.object({
  field: z.enum(['dueAt', 'createdAt', 'priority', 'updatedAt', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// =============================================================================
// 7. PHASE 05 FIELD OPERATIONS, VISITS & PROOF OF WORK SCHEMAS
// =============================================================================

export const gpsCoordinatesSchema = z.object({
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  accuracyMeters: z.number().min(0, 'Accuracy cannot be negative'),
  capturedAt: isoDateTimeSchema,
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(255),
  address: z.string().trim().max(1000).optional(),
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  allowedRadiusMeters: z.number().int().min(10, 'Allowed radius must be at least 10 meters').max(50000, 'Allowed radius cannot exceed 50,000 meters').default(100),
});

export const updateLocationSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  address: z.string().trim().max(1000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  allowedRadiusMeters: z.number().int().min(10).max(50000).optional(),
  status: locationStatusSchema.optional(),
});

export const createVisitSchema = z.object({
  locationId: locationIdSchema,
  taskId: taskIdSchema.optional(),
  assignedTo: userIdSchema.optional(),
  scheduledStart: isoDateTimeSchema,
  scheduledEnd: isoDateTimeSchema.optional(),
}).refine(
  (data) => {
    if (!data.scheduledEnd) return true;
    return new Date(data.scheduledEnd).getTime() >= new Date(data.scheduledStart).getTime();
  },
  { message: 'scheduledEnd must be at or after scheduledStart', path: ['scheduledEnd'] }
);

export const updateVisitSchema = z.object({
  locationId: locationIdSchema.optional(),
  taskId: taskIdSchema.nullable().optional(),
  assignedTo: userIdSchema.nullable().optional(),
  scheduledStart: isoDateTimeSchema.optional(),
  scheduledEnd: isoDateTimeSchema.nullable().optional(),
  version: z.number({ required_error: 'Version is required for optimistic concurrency' }).int().positive('Version is required for optimistic concurrency'),
}).refine(
  (data) => {
    if (!data.scheduledStart || !data.scheduledEnd) return true;
    return new Date(data.scheduledEnd).getTime() >= new Date(data.scheduledStart).getTime();
  },
  { message: 'scheduledEnd must be at or after scheduledStart', path: ['scheduledEnd'] }
);

export const transitionVisitStatusSchema = z.object({
  status: visitStatusSchema,
  cancelReason: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().positive().optional(),
});

export const checkinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0),
  clientCapturedAt: isoDateTimeSchema,
  exceptionReason: z.string().trim().max(1000).optional(),
  deviceMetadata: z.record(z.unknown()).optional(),
});

export const checkoutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0),
  clientCapturedAt: isoDateTimeSchema,
  notes: z.string().trim().max(5000).optional(),
  deviceMetadata: z.record(z.unknown()).optional(),
});

export const createProofSchema = z.object({
  proofType: proofTypeSchema,
  storagePath: z.string().trim().optional(),
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(100).optional(),
  fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024, 'Max proof file size is 25MB').optional(),
  notes: z.string().trim().max(5000).optional(),
  signerName: z.string().trim().max(100).optional(),
  taskId: taskIdSchema.optional(),
}).refine(
  (data) => {
    if (data.proofType === ProofType.PHOTO) return !!data.storagePath;
    if (data.proofType === ProofType.SIGNATURE) return !!data.signerName && !!data.storagePath;
    if (data.proofType === ProofType.NOTE) return !!data.notes && data.notes.trim().length > 0;
    return true;
  },
  { message: 'Missing required fields for selected proof type' }
);

export const visitFilterSchema = z.object({
  status: z.union([visitStatusSchema, z.array(visitStatusSchema)]).optional(),
  assignedTo: userIdSchema.optional(),
  locationId: locationIdSchema.optional(),
  taskId: taskIdSchema.optional(),
  isOverdue: z.coerce.boolean().optional(),
  fromDate: isoDateTimeSchema.optional(),
  toDate: isoDateTimeSchema.optional(),
});

export const visitSortSchema = z.object({
  field: z.enum(['scheduledStart', 'createdAt', 'status', 'updatedAt']).default('scheduledStart'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// =============================================================================
// 8. CONTEXT SCHEMAS
// =============================================================================

export const tenantContextSchema = z.object({
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  role: userRoleSchema,
  permissions: z.array(z.string()),
});

// =============================================================================
// 9. ATTENDANCE & WORKFORCE SCHEMAS (PHASE 06)
// =============================================================================

export const attendanceClockInSchema = z.object({
  latitude: latitudeSchema.optional().nullable(),
  longitude: longitudeSchema.optional().nullable(),
  accuracyMeters: z.number().min(0, 'Accuracy cannot be negative').max(10000).optional().nullable(),
  capturedAt: isoDateTimeSchema.optional(),
  notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
});

export const attendanceClockOutSchema = z.object({
  attendanceId: attendanceIdSchema,
  latitude: latitudeSchema.optional().nullable(),
  longitude: longitudeSchema.optional().nullable(),
  accuracyMeters: z.number().min(0, 'Accuracy cannot be negative').max(10000).optional().nullable(),
  capturedAt: isoDateTimeSchema.optional(),
  notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional().nullable(),
});

export const adjustAttendanceSchema = z
  .object({
    attendanceId: attendanceIdSchema,
    checkInAt: isoDateTimeSchema.optional(),
    checkOutAt: isoDateTimeSchema,
    reason: z.string().trim().min(10, 'Adjustment reason must be at least 10 characters long').max(1000),
  })
  .refine(
    (data) => {
      if (data.checkInAt && data.checkOutAt) {
        return new Date(data.checkOutAt).getTime() >= new Date(data.checkInAt).getTime();
      }
      return true;
    },
    {
      message: 'Check-out time cannot be earlier than check-in time',
      path: ['checkOutAt'],
    }
  );

export const attendanceFilterSchema = z.object({
  userId: userIdSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be formatted as YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be formatted as YYYY-MM-DD').optional(),
  status: attendanceStatusSchema.optional(),
  isAdjusted: z.coerce.boolean().optional(),
});

