import { z } from 'zod';
import {
  UserRole,
  Priority,
  TaskStatus,
  VisitStatus,
  AttendanceStatus,
  CheckInResult,
  ErrorCode,
  UUID,
  TenantId,
  UserId,
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

/**
 * Validates ISO-8601 UTC timestamp format.
 */
export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Timestamp must be an ISO-8601 formatted date string' })
  .transform((val) => val as IsoDateTime);

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// =============================================================================
// 2. ENUM SCHEMAS
// =============================================================================

export const userRoleSchema = z.nativeEnum(UserRole);
export const prioritySchema = z.nativeEnum(Priority);
export const taskStatusSchema = z.nativeEnum(TaskStatus);
export const visitStatusSchema = z.nativeEnum(VisitStatus);
export const attendanceStatusSchema = z.nativeEnum(AttendanceStatus);
export const checkInResultSchema = z.nativeEnum(CheckInResult);
export const errorCodeSchema = z.nativeEnum(ErrorCode);

// =============================================================================
// 3. API ERROR ENVELOPE SCHEMA
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
// 4. CONTEXT SCHEMAS
// =============================================================================

export const tenantContextSchema = z.object({
  tenantId: tenantIdSchema,
  userId: userIdSchema,
  role: userRoleSchema,
  permissions: z.array(z.string()),
});
