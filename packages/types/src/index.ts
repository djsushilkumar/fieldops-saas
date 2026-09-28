/**
 * @fieldops/types
 * Core shared types and domain primitives for the FieldOps SaaS platform.
 * Phase 02 Foundation.
 */

// =============================================================================
// 1. BRANDED IDENTIFIERS
// =============================================================================

export type Branded<T, B> = T & { readonly __brand: B };

/**
 * Universally unique identifier formatted as standard UUIDv7 or UUIDv4.
 */
export type UUID = Branded<string, 'UUID'>;

export type TenantId = Branded<string, 'TenantId'>;
export type OrganizationId = TenantId; // Alias for clarity
export type UserId = Branded<string, 'UserId'>;
export type TeamId = Branded<string, 'TeamId'>;
export type LocationId = Branded<string, 'LocationId'>;
export type TaskId = Branded<string, 'TaskId'>;
export type VisitId = Branded<string, 'VisitId'>;
export type AttendanceId = Branded<string, 'AttendanceId'>;
export type RequestId = Branded<string, 'RequestId'>;
export type MutationId = Branded<string, 'MutationId'>;

// =============================================================================
// 2. TIME AND DATES
// =============================================================================

/**
 * ISO-8601 formatted UTC timestamp string (e.g. 2026-09-28T16:00:00.000Z).
 * Server events must strictly use ISO-8601 UTC.
 */
export type IsoDateTime = Branded<string, 'IsoDateTime'>;

/**
 * Milliseconds since Unix Epoch.
 */
export type UnixTimestampMs = Branded<number, 'UnixTimestampMs'>;

// =============================================================================
// 3. ENUMS & CONSTANTS
// =============================================================================

export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  FIELD_WORKER = 'FIELD_WORKER',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  DRAFT = 'DRAFT',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

export enum VisitStatus {
  SCHEDULED = 'SCHEDULED',
  EN_ROUTE = 'EN_ROUTE',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  CANCELED = 'CANCELED',
}

export enum AttendanceStatus {
  CLOCKED_IN = 'CLOCKED_IN',
  ON_BREAK = 'ON_BREAK',
  CLOCKED_OUT = 'CLOCKED_OUT',
}

export enum CheckInResult {
  VALID = 'VALID',
  LOCATION_EXCEPTION = 'LOCATION_EXCEPTION',
  OVERRIDDEN = 'OVERRIDDEN',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  CONFLICT = 'CONFLICT',
  FAILED = 'FAILED',
}

// =============================================================================
// 4. ERROR TAXONOMY
// =============================================================================

export enum ErrorCode {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  CROSS_TENANT_FORBIDDEN = 'CROSS_TENANT_FORBIDDEN',
  GEOFENCE_EXCEPTION = 'GEOFENCE_EXCEPTION',
}

export interface ApiErrorDetail {
  readonly code: ErrorCode | string;
  readonly message: string;
  readonly request_id: string;
  readonly details?: Record<string, unknown> | undefined;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiErrorDetail;
}

// =============================================================================
// 5. API ENVELOPES & PAGINATION
// =============================================================================

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: Record<string, unknown> | undefined;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly cursor?: string;
}

export interface PaginationMeta {
  readonly total?: number;
  readonly page?: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

export interface PaginatedData<T> {
  readonly items: readonly T[];
  readonly pagination: PaginationMeta;
}

export type PaginatedResponse<T> = ApiSuccessResponse<PaginatedData<T>>;

// =============================================================================
// 6. TENANT & AUTH CONTEXT
// =============================================================================

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly role: UserRole;
  readonly permissions: readonly string[];
}

export interface AuditContext {
  readonly actorId: UserId;
  readonly tenantId: TenantId;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

// =============================================================================
// 7. OFFLINE MUTATION ENVELOPE
// =============================================================================

export interface MutationEnvelope<TPayload = unknown> {
  readonly mutationId: MutationId;
  readonly idempotencyKey: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly payload: TPayload;
  readonly clientTimestamp: IsoDateTime;
  readonly retryCount: number;
  readonly status: SyncStatus;
}
