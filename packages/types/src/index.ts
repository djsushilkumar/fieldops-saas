/**
 * @fieldops/types
 * Core shared types, domain primitives, access control, and task management engine for FieldOps SaaS.
 * Phase 04 Task Management Engine.
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

export enum MembershipStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum AuthState {
  UNKNOWN = 'UNKNOWN',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  AUTH_ERROR = 'AUTH_ERROR',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export type TaskPriority = Priority;
export const TaskPriority = Priority;

export enum TaskStatus {
  DRAFT = 'DRAFT',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

export enum LocationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum VisitStatus {
  SCHEDULED = 'SCHEDULED',
  READY = 'READY',
  EN_ROUTE = 'EN_ROUTE',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  CHECKED_OUT = 'CHECKED_OUT',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  MISSED = 'MISSED',
}

export enum LocationVerificationResult {
  VALID = 'VALID',
  OUTSIDE_RADIUS = 'OUTSIDE_RADIUS',
  LOW_ACCURACY = 'LOW_ACCURACY',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  STALE_LOCATION = 'STALE_LOCATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

export enum ProofType {
  PHOTO = 'PHOTO',
  NOTE = 'NOTE',
  SIGNATURE = 'SIGNATURE',
  CHECKLIST = 'CHECKLIST',
}

export enum LocationEventType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  MANUAL_VERIFICATION = 'MANUAL_VERIFICATION',
  EXCEPTION_OVERRIDE = 'EXCEPTION_OVERRIDE',
}

export enum AttendanceStatus {
  CLOCKED_IN = 'CLOCKED_IN',
  ON_BREAK = 'ON_BREAK',
  CLOCKED_OUT = 'CLOCKED_OUT',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CORRECTED = 'CORRECTED',
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
// 4. DOMAIN ENTITIES (PHASE 03 IDENTITY & ACCESS CONTROL)
// =============================================================================

export interface UserProfile {
  readonly id: UserId;
  readonly email: string;
  readonly fullName: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly phone?: string;
  readonly timezone: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface OrganizationSettings {
  readonly allowedRadiusMeters: number;
  readonly timezone: string;
  readonly requirePhotoProof?: boolean;
  readonly requireSignature?: boolean;
  readonly [key: string]: unknown;
}

export interface Organization {
  readonly id: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly subscriptionTier: string;
  readonly subscriptionStatus: string;
  readonly settings: OrganizationSettings;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface Membership {
  readonly id: UUID;
  readonly organizationId: TenantId;
  readonly userId: UserId;
  readonly role: UserRole;
  readonly status: MembershipStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly organization?: Organization;
  readonly user?: UserProfile;
}

export interface OrganizationInvitation {
  readonly id: UUID;
  readonly organizationId: TenantId;
  readonly email: string;
  readonly role: UserRole;
  readonly status: InvitationStatus;
  readonly expiresAt: IsoDateTime;
  readonly createdBy: UserId;
  readonly acceptedAt?: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresIn: number;
  readonly tokenType: string;
}

export interface AuthSession {
  readonly user: UserProfile;
  readonly tokens: AuthTokens;
  readonly activeMembership?: Membership;
  readonly availableMemberships: readonly Membership[];
}

// =============================================================================
// 5. DOMAIN ENTITIES (PHASE 04 TASK MANAGEMENT ENGINE)
// =============================================================================

export interface Team {
  readonly id: TeamId;
  readonly organizationId: TenantId;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface TeamMember {
  readonly id: UUID;
  readonly organizationId: TenantId;
  readonly teamId: TeamId;
  readonly userId: UserId;
  readonly createdAt: IsoDateTime;
}

export interface TaskChecklistItem {
  readonly id: UUID;
  readonly taskId: TaskId;
  readonly organizationId: TenantId;
  readonly title: string;
  readonly position: number;
  readonly isRequired: boolean;
  readonly isCompleted: boolean;
  readonly completedAt?: IsoDateTime;
  readonly completedBy?: UserId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface TaskAttachment {
  readonly id: UUID;
  readonly taskId: TaskId;
  readonly organizationId: TenantId;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly createdBy: UserId;
  readonly createdAt: IsoDateTime;
}

export interface TaskComment {
  readonly id: UUID;
  readonly taskId: TaskId;
  readonly organizationId: TenantId;
  readonly authorId: UserId;
  readonly content: string;
  readonly author?: UserProfile;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface TaskActivity {
  readonly id: UUID;
  readonly taskId: TaskId;
  readonly organizationId: TenantId;
  readonly actorId: UserId;
  readonly action: string;
  readonly details: Record<string, unknown>;
  readonly actor?: UserProfile;
  readonly createdAt: IsoDateTime;
}

export interface Task {
  readonly id: TaskId;
  readonly organizationId: TenantId;
  readonly title: string;
  readonly description?: string;
  readonly status: TaskStatus;
  readonly priority: Priority;
  readonly createdBy: UserId;
  readonly assignedTo?: UserId;
  readonly assignedToName?: string;
  readonly assignedTeam?: TeamId;
  readonly locationId?: LocationId;
  readonly locationName?: string;
  readonly dueAt?: IsoDateTime;
  readonly blockedReason?: string;
  readonly version: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly checklists?: readonly TaskChecklistItem[];
  readonly assignee?: UserProfile;
  readonly team?: Team;
}

export interface TaskFilterParams {
  readonly status?: TaskStatus | readonly TaskStatus[];
  readonly priority?: Priority | readonly Priority[];
  readonly assignedTo?: UserId;
  readonly assignedTeam?: TeamId;
  readonly isOverdue?: boolean;
  readonly search?: string;
  readonly fromDate?: IsoDateTime;
  readonly toDate?: IsoDateTime;
}

export type TaskSortField = 'dueAt' | 'createdAt' | 'priority' | 'updatedAt' | 'title';
export type TaskSortOrder = 'asc' | 'desc';

export interface TaskSortParams {
  readonly field: TaskSortField;
  readonly order: TaskSortOrder;
}

// =============================================================================
// 5B. DOMAIN ENTITIES (PHASE 05 FIELD OPERATIONS ENGINE)
// =============================================================================

export interface Location {
  readonly id: LocationId;
  readonly organizationId: TenantId;
  readonly name: string;
  readonly address?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly allowedRadiusMeters: number;
  readonly status: LocationStatus;
  readonly createdBy: UserId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface GpsCoordinates {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly capturedAt: IsoDateTime;
}

export interface VisitCheckin {
  readonly id: UUID;
  readonly visitId: VisitId;
  readonly organizationId: TenantId;
  readonly workerId: UserId;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly distanceMeters: number;
  readonly verificationResult: LocationVerificationResult;
  readonly isException: boolean;
  readonly exceptionReason?: string;
  readonly clientCapturedAt: IsoDateTime;
  readonly serverReceivedAt: IsoDateTime;
  readonly deviceMetadata?: Record<string, unknown>;
  readonly createdAt: IsoDateTime;
}

export interface VisitCheckout {
  readonly id: UUID;
  readonly visitId: VisitId;
  readonly organizationId: TenantId;
  readonly workerId: UserId;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly distanceMeters?: number;
  readonly verificationResult: LocationVerificationResult;
  readonly notes?: string;
  readonly clientCapturedAt: IsoDateTime;
  readonly serverReceivedAt: IsoDateTime;
  readonly deviceMetadata?: Record<string, unknown>;
  readonly createdAt: IsoDateTime;
}

export interface VisitProof {
  readonly id: UUID;
  readonly visitId: VisitId;
  readonly organizationId: TenantId;
  readonly taskId?: TaskId;
  readonly proofType: ProofType;
  readonly storagePath?: string;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly fileSizeBytes?: number;
  readonly notes?: string;
  readonly signerName?: string;
  readonly createdBy: UserId;
  readonly createdAt: IsoDateTime;
}

export interface VisitActivity {
  readonly id: UUID;
  readonly visitId: VisitId;
  readonly organizationId: TenantId;
  readonly actorId: UserId;
  readonly action: string;
  readonly details: Record<string, unknown>;
  readonly actor?: UserProfile;
  readonly createdAt: IsoDateTime;
}

export interface LocationEvent {
  readonly id: UUID;
  readonly organizationId: TenantId;
  readonly workerId: UserId;
  readonly visitId?: VisitId;
  readonly eventType: LocationEventType;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly source: string;
  readonly clientCapturedAt: IsoDateTime;
  readonly serverReceivedAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface Visit {
  readonly id: VisitId;
  readonly organizationId: TenantId;
  readonly locationId: LocationId;
  readonly taskId?: TaskId;
  readonly assignedTo?: UserId;
  readonly scheduledStart: IsoDateTime;
  readonly scheduledEnd?: IsoDateTime;
  readonly status: VisitStatus;
  readonly version: number;
  readonly createdBy: UserId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly location?: Location;
  readonly task?: Task;
  readonly assignee?: UserProfile;
  readonly checkin?: VisitCheckin;
  readonly checkout?: VisitCheckout;
  readonly proofs?: readonly VisitProof[];
}

export interface VisitFilterParams {
  readonly status?: VisitStatus | readonly VisitStatus[];
  readonly assignedTo?: UserId;
  readonly locationId?: LocationId;
  readonly taskId?: TaskId;
  readonly fromDate?: IsoDateTime;
  readonly toDate?: IsoDateTime;
  readonly isOverdue?: boolean;
}

export type VisitSortField = 'scheduledStart' | 'createdAt' | 'status' | 'updatedAt';
export type VisitSortOrder = 'asc' | 'desc';

export interface VisitSortParams {
  readonly field: VisitSortField;
  readonly order: VisitSortOrder;
}

// =============================================================================
// 6. ERROR TAXONOMY
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
  MEMBERSHIP_SUSPENDED = 'MEMBERSHIP_SUSPENDED',
  LAST_OWNER_PROTECTION = 'LAST_OWNER_PROTECTION',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  INVITATION_INVALID = 'INVITATION_INVALID',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ACCESS_DENIED = 'TASK_ACCESS_DENIED',
  TASK_INVALID_STATUS_TRANSITION = 'TASK_INVALID_STATUS_TRANSITION',
  TASK_INVALID_ASSIGNEE = 'TASK_INVALID_ASSIGNEE',
  TASK_INVALID_TEAM = 'TASK_INVALID_TEAM',
  TASK_CONFLICT = 'TASK_CONFLICT',
  TASK_CHECKLIST_INCOMPLETE = 'TASK_CHECKLIST_INCOMPLETE',
  TASK_ATTACHMENT_INVALID = 'TASK_ATTACHMENT_INVALID',
  LOCATION_NOT_FOUND = 'LOCATION_NOT_FOUND',
  LOCATION_ACCESS_DENIED = 'LOCATION_ACCESS_DENIED',
  LOCATION_INVALID_COORDINATES = 'LOCATION_INVALID_COORDINATES',
  VISIT_NOT_FOUND = 'VISIT_NOT_FOUND',
  VISIT_ACCESS_DENIED = 'VISIT_ACCESS_DENIED',
  VISIT_INVALID_STATUS_TRANSITION = 'VISIT_INVALID_STATUS_TRANSITION',
  VISIT_PROOF_INCOMPLETE = 'VISIT_PROOF_INCOMPLETE',
  VISIT_CONFLICT = 'VISIT_CONFLICT',
  // Billing & SaaS Subscriptions (Phase 08)
  PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED',
  FEATURE_NOT_ENTITLED = 'FEATURE_NOT_ENTITLED',
  BILLING_ACTION_REQUIRED = 'BILLING_ACTION_REQUIRED',
  BILLING_ACCESS_DENIED = 'BILLING_ACCESS_DENIED',
  WEBHOOK_INVALID = 'WEBHOOK_INVALID',
  // Reporting & Exports (Phase 08)
  REPORT_ACCESS_DENIED = 'REPORT_ACCESS_DENIED',
  REPORT_RANGE_TOO_LARGE = 'REPORT_RANGE_TOO_LARGE',
  REPORT_EXPORT_LIMIT_REACHED = 'REPORT_EXPORT_LIMIT_REACHED',
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
// 7. API ENVELOPES & PAGINATION
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
// 8. TENANT & AUTH CONTEXT
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
// 9. OFFLINE MUTATION ENVELOPE
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

export type OfflineMutation<TPayload = unknown> = MutationEnvelope<TPayload>;

export interface OfflineMutationResult {
  readonly mutationId: MutationId;
  readonly idempotencyKey: string;
  readonly status: 'APPLIED' | 'DEDUPLICATED' | 'CONFLICT' | 'REJECTED';
  readonly error?: ApiErrorDetail;
  readonly entity?: unknown;
}

export interface OfflineSyncResponse {
  readonly processed: number;
  readonly results: readonly OfflineMutationResult[];
}


// =============================================================================
// 10. PERMISSIONS & ROLE CAPABILITY MATRIX
// =============================================================================

export const Permissions = {
  // Organization & Settings
  ORG_SETTINGS_VIEW: 'org:settings:view',
  ORG_SETTINGS_EDIT: 'org:settings:edit',
  ORG_BILLING_VIEW: 'org:billing:view',
  ORG_BILLING_MANAGE: 'org:billing:manage',
  ORG_DELETE: 'org:delete',

  // Membership & Access
  MEMBER_INVITE: 'member:invite',
  MEMBER_DEACTIVATE: 'member:deactivate',
  MEMBER_ROLE_ASSIGN: 'member:role:assign',
  MEMBER_PROFILE_VIEW_ALL: 'member:profile:view:all',
  MEMBER_PROFILE_VIEW_TEAM: 'member:profile:view:team',
  MEMBER_PROFILE_VIEW_OWN: 'member:profile:view:own',

  // Teams & Territories
  TEAM_MANAGE: 'team:manage',
  TEAM_ASSIGN: 'team:assign',

  // Locations & Geofences
  LOCATION_MANAGE: 'location:manage',
  LOCATION_DELETE: 'location:delete',
  LOCATION_VIEW_ALL: 'location:view:all',
  LOCATION_VIEW_TEAM: 'location:view:team',
  LOCATION_VIEW_OWN: 'location:view:own',

  // Task Operations
  TASK_CREATE: 'task:create',
  TASK_ASSIGN: 'task:assign',
  TASK_UPDATE_ANY: 'task:update:any',
  TASK_UPDATE_TEAM: 'task:update:team',
  TASK_UPDATE_OWN: 'task:update:own',
  TASK_APPROVE: 'task:approve',
  TASK_DELETE: 'task:delete',
  TASK_VIEW_ALL: 'task:view:all',
  TASK_VIEW_TEAM: 'task:view:team',
  TASK_VIEW_OWN: 'task:view:own',

  // Field Visits
  VISIT_SCHEDULE: 'visit:schedule',
  VISIT_UPDATE: 'visit:update',
  VISIT_CANCEL: 'visit:cancel',
  VISIT_CHECKIN_OWN: 'visit:checkin:own',
  VISIT_COMPLETE: 'visit:complete',
  VISIT_GEOFENCE_OVERRIDE: 'visit:geofence_override',
  VISIT_VIEW_ALL: 'visit:view:all',
  VISIT_VIEW_TEAM: 'visit:view:team',
  VISIT_VIEW_OWN: 'visit:view:own',

  // Proof of Work & Location Events
  PROOF_VIEW: 'proof:view',
  PROOF_CREATE: 'proof:create',
  LOCATION_EVENT_VIEW: 'location_event:view',

  // Attendance & Shift
  ATTENDANCE_CLOCK_OWN: 'attendance:clock:own',
  ATTENDANCE_VIEW_ORG: 'attendance:view:org',
  ATTENDANCE_VIEW_TEAM: 'attendance:view:team',
  ATTENDANCE_ADJUST: 'attendance:adjust',

  // Reports & Analytics (Phase 08)
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',

  // Audit Logs & Security
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/**
 * Authoritative capability matrix defining base permissions per role.
 * Derived from docs/product/roles.md and docs/architecture/authorization.md.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.OWNER]: [
    Permissions.ORG_SETTINGS_VIEW,
    Permissions.ORG_SETTINGS_EDIT,
    Permissions.ORG_BILLING_VIEW,
    Permissions.ORG_BILLING_MANAGE,
    Permissions.ORG_DELETE,
    Permissions.MEMBER_INVITE,
    Permissions.MEMBER_DEACTIVATE,
    Permissions.MEMBER_ROLE_ASSIGN,
    Permissions.MEMBER_PROFILE_VIEW_ALL,
    Permissions.TEAM_MANAGE,
    Permissions.TEAM_ASSIGN,
    Permissions.LOCATION_MANAGE,
    Permissions.LOCATION_DELETE,
    Permissions.LOCATION_VIEW_ALL,
    Permissions.TASK_CREATE,
    Permissions.TASK_ASSIGN,
    Permissions.TASK_UPDATE_ANY,
    Permissions.TASK_APPROVE,
    Permissions.TASK_DELETE,
    Permissions.TASK_VIEW_ALL,
    Permissions.VISIT_SCHEDULE,
    Permissions.VISIT_UPDATE,
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_COMPLETE,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_ALL,
    Permissions.PROOF_VIEW,
    Permissions.PROOF_CREATE,
    Permissions.LOCATION_EVENT_VIEW,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_ORG,
    Permissions.ATTENDANCE_ADJUST,
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
    Permissions.AUDIT_VIEW,
  ],
  [UserRole.ADMIN]: [
    Permissions.ORG_SETTINGS_VIEW,
    Permissions.ORG_SETTINGS_EDIT,
    Permissions.ORG_BILLING_VIEW,
    Permissions.MEMBER_INVITE,
    Permissions.MEMBER_DEACTIVATE,
    Permissions.MEMBER_ROLE_ASSIGN,
    Permissions.MEMBER_PROFILE_VIEW_ALL,
    Permissions.TEAM_MANAGE,
    Permissions.TEAM_ASSIGN,
    Permissions.LOCATION_MANAGE,
    Permissions.LOCATION_DELETE,
    Permissions.LOCATION_VIEW_ALL,
    Permissions.TASK_CREATE,
    Permissions.TASK_ASSIGN,
    Permissions.TASK_UPDATE_ANY,
    Permissions.TASK_APPROVE,
    Permissions.TASK_DELETE,
    Permissions.TASK_VIEW_ALL,
    Permissions.VISIT_SCHEDULE,
    Permissions.VISIT_UPDATE,
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_COMPLETE,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_ALL,
    Permissions.PROOF_VIEW,
    Permissions.PROOF_CREATE,
    Permissions.LOCATION_EVENT_VIEW,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_ORG,
    Permissions.ATTENDANCE_ADJUST,
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
    Permissions.AUDIT_VIEW,
  ],
  [UserRole.MANAGER]: [
    Permissions.ORG_SETTINGS_VIEW,
    Permissions.MEMBER_PROFILE_VIEW_ALL,
    Permissions.TEAM_MANAGE,
    Permissions.TEAM_ASSIGN,
    Permissions.LOCATION_MANAGE,
    Permissions.LOCATION_VIEW_ALL,
    Permissions.TASK_CREATE,
    Permissions.TASK_ASSIGN,
    Permissions.TASK_UPDATE_ANY,
    Permissions.TASK_APPROVE,
    Permissions.TASK_DELETE,
    Permissions.TASK_VIEW_ALL,
    Permissions.VISIT_SCHEDULE,
    Permissions.VISIT_UPDATE,
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_COMPLETE,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_ALL,
    Permissions.PROOF_VIEW,
    Permissions.PROOF_CREATE,
    Permissions.LOCATION_EVENT_VIEW,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_ORG,
    Permissions.ATTENDANCE_ADJUST,
    Permissions.REPORT_VIEW,
    Permissions.REPORT_EXPORT,
  ],
  [UserRole.SUPERVISOR]: [
    Permissions.MEMBER_PROFILE_VIEW_TEAM,
    Permissions.LOCATION_VIEW_TEAM,
    Permissions.TASK_CREATE,
    Permissions.TASK_ASSIGN,
    Permissions.TASK_UPDATE_TEAM,
    Permissions.TASK_APPROVE,
    Permissions.TASK_DELETE,
    Permissions.TASK_VIEW_TEAM,
    Permissions.VISIT_SCHEDULE,
    Permissions.VISIT_UPDATE,
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_CHECKIN_OWN,
    Permissions.VISIT_COMPLETE,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_TEAM,
    Permissions.PROOF_VIEW,
    Permissions.PROOF_CREATE,
    Permissions.LOCATION_EVENT_VIEW,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_TEAM,
    Permissions.REPORT_VIEW,
  ],
  [UserRole.FIELD_WORKER]: [
    Permissions.MEMBER_PROFILE_VIEW_OWN,
    Permissions.LOCATION_VIEW_OWN,
    Permissions.TASK_UPDATE_OWN,
    Permissions.TASK_VIEW_OWN,
    Permissions.VISIT_CHECKIN_OWN,
    Permissions.VISIT_COMPLETE,
    Permissions.VISIT_VIEW_OWN,
    Permissions.PROOF_VIEW,
    Permissions.PROOF_CREATE,
    Permissions.ATTENDANCE_CLOCK_OWN,
  ],
};

export interface ResourceContext {
  readonly actorId?: UserId;
  readonly ownerId?: UserId;
  readonly assigneeId?: UserId;
  readonly teamId?: TeamId;
  readonly actorTeamIds?: readonly TeamId[];
  readonly targetRole?: UserRole;
}

/**
 * Checks whether a role possesses a permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
}

/**
 * Centralized authorization evaluation function `can()`.
 * Validates permission with contextual object-level constraints.
 */
export function can(
  role: UserRole,
  permission: Permission,
  context?: ResourceContext
): boolean {
  // If role doesn't have the nominal permission, immediately deny
  if (!hasPermission(role, permission)) {
    return false;
  }

  // Admin cannot assign or change an OWNER role (only OWNER can manage OWNER role)
  if (
    role === UserRole.ADMIN &&
    permission === Permissions.MEMBER_ROLE_ASSIGN &&
    context?.targetRole === UserRole.OWNER
  ) {
    return false;
  }

  // Admin cannot deactivate an OWNER
  if (
    role === UserRole.ADMIN &&
    permission === Permissions.MEMBER_DEACTIVATE &&
    context?.targetRole === UserRole.OWNER
  ) {
    return false;
  }

  // Object-level context checks:
  if (context) {
    // Supervisor scope: restricted to assigned teams
    if (role === UserRole.SUPERVISOR) {
      if (
        (permission === Permissions.TASK_UPDATE_TEAM ||
          permission === Permissions.TASK_VIEW_TEAM ||
          permission === Permissions.VISIT_VIEW_TEAM ||
          permission === Permissions.ATTENDANCE_VIEW_TEAM) &&
        context.teamId &&
        context.actorTeamIds
      ) {
        return context.actorTeamIds.includes(context.teamId);
      }
    }

    // Field Worker scope: restricted to own assigned records
    if (role === UserRole.FIELD_WORKER) {
      if (
        (permission === Permissions.TASK_UPDATE_OWN ||
          permission === Permissions.TASK_VIEW_OWN ||
          permission === Permissions.VISIT_VIEW_OWN ||
          permission === Permissions.VISIT_CHECKIN_OWN ||
          permission === Permissions.VISIT_COMPLETE) &&
        context.assigneeId &&
        context.actorId
      ) {
        return context.actorId === context.assigneeId;
      }
    }
  }

  return true;
}

// =============================================================================
// 11. TASK STATE MACHINE EVALUATOR & POLICIES
// =============================================================================

export interface TaskTransitionOptions {
  readonly hasAssignee?: boolean;
  readonly incompleteRequiredChecklists?: number;
  readonly blockedReason?: string;
  readonly reopenReason?: string;
  readonly isAssignee?: boolean;
}

/**
 * Validates whether a requested task state transition is legal per PRD Section 3.
 */
export function isValidTaskTransition(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus,
  role: UserRole,
  options?: TaskTransitionOptions
): { valid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  // Canceled is terminal
  if (currentStatus === TaskStatus.CANCELED) {
    return {
      valid: false,
      reason: 'CANCELED is a terminal state. Task cannot transition to any other state.',
    };
  }

  // Cancellation rule: Only Owner, Admin, Manager, Supervisor can cancel tasks
  if (targetStatus === TaskStatus.CANCELED) {
    if (role === UserRole.FIELD_WORKER) {
      return {
        valid: false,
        reason: 'Field Workers cannot cancel tasks. Contact a supervisor or manager.',
      };
    }
    return { valid: true };
  }

  // Direct transition from DRAFT to COMPLETED is forbidden
  if (currentStatus === TaskStatus.DRAFT && targetStatus === TaskStatus.COMPLETED) {
    return {
      valid: false,
      reason: 'Direct transition from DRAFT to COMPLETED is forbidden.',
    };
  }

  // Transitions from DRAFT
  if (currentStatus === TaskStatus.DRAFT) {
    if (targetStatus !== TaskStatus.ASSIGNED) {
      return {
        valid: false,
        reason: `DRAFT can only transition to ASSIGNED or CANCELED (requested: ${targetStatus}).`,
      };
    }
    if (options?.hasAssignee === false) {
      return {
        valid: false,
        reason: 'Assigning a task requires specifying an assignee or a team.',
      };
    }
    return { valid: true };
  }

  // Transitions from ASSIGNED
  if (currentStatus === TaskStatus.ASSIGNED) {
    if (targetStatus !== TaskStatus.ACCEPTED && targetStatus !== TaskStatus.IN_PROGRESS) {
      return {
        valid: false,
        reason: `ASSIGNED can only transition to ACCEPTED or IN_PROGRESS (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from ACCEPTED
  if (currentStatus === TaskStatus.ACCEPTED) {
    if (targetStatus !== TaskStatus.IN_PROGRESS) {
      return {
        valid: false,
        reason: `ACCEPTED can only transition to IN_PROGRESS (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from IN_PROGRESS
  if (currentStatus === TaskStatus.IN_PROGRESS) {
    if (targetStatus === TaskStatus.BLOCKED) {
      if (!options?.blockedReason || options.blockedReason.trim().length === 0) {
        return {
          valid: false,
          reason: 'Transitioning to BLOCKED requires a non-empty blocked_reason.',
        };
      }
      return { valid: true };
    }

    if (targetStatus === TaskStatus.COMPLETED) {
      if (options?.incompleteRequiredChecklists && options.incompleteRequiredChecklists > 0) {
        return {
          valid: false,
          reason: `Cannot complete task with ${options.incompleteRequiredChecklists} unfinished required checklist items.`,
        };
      }
      return { valid: true };
    }

    return {
      valid: false,
      reason: `IN_PROGRESS can only transition to BLOCKED, COMPLETED, or CANCELED (requested: ${targetStatus}).`,
    };
  }

  // Transitions from BLOCKED
  if (currentStatus === TaskStatus.BLOCKED) {
    if (targetStatus !== TaskStatus.IN_PROGRESS && targetStatus !== TaskStatus.COMPLETED) {
      return {
        valid: false,
        reason: `BLOCKED can only transition to IN_PROGRESS or COMPLETED (requested: ${targetStatus}).`,
      };
    }
    if (targetStatus === TaskStatus.COMPLETED) {
      if (options?.incompleteRequiredChecklists && options.incompleteRequiredChecklists > 0) {
        return {
          valid: false,
          reason: `Cannot complete task with ${options.incompleteRequiredChecklists} unfinished required checklist items.`,
        };
      }
    }
    return { valid: true };
  }

  // Transitions from COMPLETED (Reopening)
  if (currentStatus === TaskStatus.COMPLETED) {
    if (targetStatus !== TaskStatus.IN_PROGRESS) {
      return {
        valid: false,
        reason: `COMPLETED tasks can only be reopened to IN_PROGRESS (requested: ${targetStatus}).`,
      };
    }
    if (role === UserRole.FIELD_WORKER) {
      return {
        valid: false,
        reason: 'Field Workers cannot reopen completed tasks. Reopening requires Supervisor or Manager review.',
      };
    }
    return { valid: true };
  }

  return { valid: false, reason: `Invalid status transition from ${currentStatus} to ${targetStatus}.` };
}

/**
 * Calculates whether a task is overdue based on dueAt and current time in UTC.
 */
export function isTaskOverdue(
  task: { status: TaskStatus; dueAt?: string | null },
  now: Date = new Date()
): boolean {
  if (!task.dueAt) return false;
  if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELED) {
    return false;
  }
  const dueTime = new Date(task.dueAt).getTime();
  return now.getTime() > dueTime;
}

// =============================================================================
// 12. GEOSPATIAL & VISIT STATE MACHINE EVALUATORS
// =============================================================================

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula on a spherical model (Earth radius = 6,371,000 meters).
 * Returns the distance in meters rounded to 2 decimal places.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371000; // Earth mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return Math.round(R * c * 100) / 100;
}

export interface GeofenceVerificationOptions {
  readonly workerCoordinates: GpsCoordinates;
  readonly targetLatitude: number;
  readonly targetLongitude: number;
  readonly allowedRadiusMeters: number;
  readonly maxAccuracyMeters?: number; // default 150m
  readonly maxStaleAgeSeconds?: number; // default 120s
  readonly now?: Date;
}

export interface GeofenceVerificationEvaluation {
  readonly distanceMeters: number;
  readonly verificationResult: LocationVerificationResult;
  readonly isWithinRadius: boolean;
  readonly isAccurate: boolean;
  readonly isFresh: boolean;
  readonly message?: string;
}

/**
 * Authoritative client/server geofence verification engine.
 * Evaluates proximity, accuracy threshold, and staleness of GPS fixes.
 */
export function verifyGeofence(options: GeofenceVerificationOptions): GeofenceVerificationEvaluation {
  const {
    workerCoordinates,
    targetLatitude,
    targetLongitude,
    allowedRadiusMeters,
    maxAccuracyMeters = 150,
    maxStaleAgeSeconds = 120,
    now = new Date(),
  } = options;

  const distanceMeters = calculateHaversineDistance(
    workerCoordinates.latitude,
    workerCoordinates.longitude,
    targetLatitude,
    targetLongitude
  );

  const isWithinRadius = distanceMeters <= allowedRadiusMeters;
  const isAccurate = workerCoordinates.accuracyMeters <= maxAccuracyMeters;

  const capturedTime = new Date(workerCoordinates.capturedAt).getTime();
  const ageSeconds = Math.max(0, (now.getTime() - capturedTime) / 1000);
  const isFresh = ageSeconds <= maxStaleAgeSeconds;

  let verificationResult: LocationVerificationResult = LocationVerificationResult.VALID;
  let message: string | undefined;

  if (!isFresh) {
    verificationResult = LocationVerificationResult.STALE_LOCATION;
    message = `GPS fix is stale (${Math.round(ageSeconds)}s old, maximum allowed is ${maxStaleAgeSeconds}s).`;
  } else if (!isAccurate) {
    verificationResult = LocationVerificationResult.LOW_ACCURACY;
    message = `GPS accuracy too low (${Math.round(workerCoordinates.accuracyMeters)}m, maximum allowed is ${maxAccuracyMeters}m).`;
  } else if (!isWithinRadius) {
    verificationResult = LocationVerificationResult.OUTSIDE_RADIUS;
    message = `Worker is ${Math.round(distanceMeters)}m away from location (maximum allowed radius is ${allowedRadiusMeters}m).`;
  }

  return {
    distanceMeters,
    verificationResult,
    isWithinRadius,
    isAccurate,
    isFresh,
    message,
  };
}

export interface VisitTransitionOptions {
  readonly hasCheckout?: boolean;
  readonly proofCount?: number;
  readonly requiredProofCount?: number;
  readonly cancelReason?: string;
}

/**
 * Validates whether a requested visit status transition is legal per PRD Section 3.
 */
export function isValidVisitTransition(
  currentStatus: VisitStatus,
  targetStatus: VisitStatus,
  role: UserRole,
  options?: VisitTransitionOptions
): { valid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  // Canceled is terminal
  if (currentStatus === VisitStatus.CANCELED) {
    return {
      valid: false,
      reason: 'CANCELED is a terminal state. Visit cannot transition to any other state.',
    };
  }

  // Completed is terminal
  if (currentStatus === VisitStatus.COMPLETED) {
    return {
      valid: false,
      reason: 'COMPLETED is a terminal state. Visit cannot transition to any other state.',
    };
  }

  // Cancellation rule: Field Workers cannot cancel visits
  if (targetStatus === VisitStatus.CANCELED) {
    if (role === UserRole.FIELD_WORKER) {
      return {
        valid: false,
        reason: 'Field Workers cannot cancel visits. Contact a supervisor or manager.',
      };
    }
    return { valid: true };
  }

  // Transitions from SCHEDULED
  if (currentStatus === VisitStatus.SCHEDULED) {
    if (
      targetStatus !== VisitStatus.READY &&
      targetStatus !== VisitStatus.EN_ROUTE &&
      targetStatus !== VisitStatus.CHECKED_IN &&
      targetStatus !== VisitStatus.MISSED
    ) {
      return {
        valid: false,
        reason: `SCHEDULED can only transition to READY, EN_ROUTE, CHECKED_IN, MISSED, or CANCELED (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from READY
  if (currentStatus === VisitStatus.READY) {
    if (
      targetStatus !== VisitStatus.EN_ROUTE &&
      targetStatus !== VisitStatus.CHECKED_IN &&
      targetStatus !== VisitStatus.MISSED
    ) {
      return {
        valid: false,
        reason: `READY can only transition to EN_ROUTE, CHECKED_IN, MISSED, or CANCELED (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from EN_ROUTE
  if (currentStatus === VisitStatus.EN_ROUTE) {
    if (targetStatus !== VisitStatus.CHECKED_IN && targetStatus !== VisitStatus.MISSED) {
      return {
        valid: false,
        reason: `EN_ROUTE can only transition to CHECKED_IN, MISSED, or CANCELED (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from CHECKED_IN
  if (currentStatus === VisitStatus.CHECKED_IN) {
    if (targetStatus !== VisitStatus.IN_PROGRESS && targetStatus !== VisitStatus.CHECKED_OUT) {
      return {
        valid: false,
        reason: `CHECKED_IN can only transition to IN_PROGRESS, CHECKED_OUT, or CANCELED (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from IN_PROGRESS
  if (currentStatus === VisitStatus.IN_PROGRESS) {
    if (targetStatus !== VisitStatus.CHECKED_OUT) {
      return {
        valid: false,
        reason: `IN_PROGRESS can only transition to CHECKED_OUT or CANCELED (requested: ${targetStatus}).`,
      };
    }
    return { valid: true };
  }

  // Transitions from CHECKED_OUT
  if (currentStatus === VisitStatus.CHECKED_OUT) {
    if (targetStatus !== VisitStatus.COMPLETED) {
      return {
        valid: false,
        reason: `CHECKED_OUT can only transition to COMPLETED or CANCELED (requested: ${targetStatus}).`,
      };
    }
    if (options?.hasCheckout === false) {
      return {
        valid: false,
        reason: 'Cannot complete visit without recording check-out.',
      };
    }
    if (
      options?.requiredProofCount !== undefined &&
      options?.proofCount !== undefined &&
      options.proofCount < options.requiredProofCount
    ) {
      return {
        valid: false,
        reason: `Cannot complete visit: required ${options.requiredProofCount} proof(s), but only ${options.proofCount} provided.`,
      };
    }
    return { valid: true };
  }

  return { valid: false, reason: `Invalid status transition from ${currentStatus} to ${targetStatus}.` };
}

/**
 * Calculates whether a visit is overdue/missed based on scheduledEnd/scheduledStart and current time in UTC.
 */
export function isVisitOverdue(
  visit: { status: VisitStatus; scheduledStart: string; scheduledEnd?: string | null },
  now: Date = new Date()
): boolean {
  if (visit.status === VisitStatus.COMPLETED || visit.status === VisitStatus.CANCELED) {
    return false;
  }
  const cutoffTimeStr = visit.scheduledEnd || visit.scheduledStart;
  const cutoffTime = new Date(cutoffTimeStr).getTime();
  return now.getTime() > cutoffTime;
}

// =============================================================================
// 9. ATTENDANCE & MOBILE WORKFORCE DOMAIN (PHASE 06)
// =============================================================================

export enum WorkerActivityType {
  ATTENDANCE_CHECKIN = 'ATTENDANCE_CHECKIN',
  ATTENDANCE_CHECKOUT = 'ATTENDANCE_CHECKOUT',
  ATTENDANCE_CORRECTED = 'ATTENDANCE_CORRECTED',
  TASK_ACCEPTED = 'TASK_ACCEPTED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  VISIT_EN_ROUTE = 'VISIT_EN_ROUTE',
  VISIT_CHECKIN = 'VISIT_CHECKIN',
  VISIT_CHECKOUT = 'VISIT_CHECKOUT',
  VISIT_COMPLETED = 'VISIT_COMPLETED',
  PROOF_CAPTURED = 'PROOF_CAPTURED',
}

export interface AttendanceRecord {
  id: AttendanceId;
  organizationId: TenantId;
  userId: UserId;
  date: string; // YYYY-MM-DD
  checkInAt: IsoDateTime;
  checkOutAt?: IsoDateTime | null;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkInAccuracyMeters?: number | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  checkOutAccuracyMeters?: number | null;
  status: AttendanceStatus;
  durationSeconds?: number | null;
  notes?: string | null;
  isManuallyAdjusted: boolean;
  adjustmentReason?: string | null;
  adjustedByUserId?: UserId | null;
  adjustedAt?: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  userName?: string;
  userEmail?: string;
  adjustedByName?: string;
}

export interface WorkerActivity {
  id: UUID;
  organizationId: TenantId;
  userId: UserId;
  activityType: WorkerActivityType;
  title: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTime;
}

export interface AttendanceClockInPayload {
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  capturedAt?: IsoDateTime;
  notes?: string | null;
}

export interface AttendanceClockOutPayload {
  attendanceId: AttendanceId;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  capturedAt?: IsoDateTime;
  notes?: string | null;
}

export interface AdjustAttendancePayload {
  attendanceId: AttendanceId;
  checkInAt?: IsoDateTime;
  checkOutAt: IsoDateTime;
  reason: string;
}

export interface AttendanceFilterParams {
  userId?: UserId;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
  isAdjusted?: boolean;
}

export interface AttendanceShiftSummary {
  activeCount: number;
  completedTodayCount: number;
  totalDurationSecondsToday: number;
  adjustedCount: number;
}

/**
 * Validates attendance state transitions.
 * CLOCKED_IN / CHECKED_IN -> ON_BREAK, CLOCKED_OUT / CHECKED_OUT, CORRECTED
 * ON_BREAK -> CLOCKED_IN, CLOCKED_OUT
 * CLOCKED_OUT / CHECKED_OUT -> CORRECTED
 */
export function isValidAttendanceTransition(
  currentStatus: AttendanceStatus,
  targetStatus: AttendanceStatus
): { valid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  // Any status can be manually corrected by an authorized supervisor
  if (targetStatus === AttendanceStatus.CORRECTED) {
    return { valid: true };
  }

  const isCurrentActive =
    currentStatus === AttendanceStatus.CLOCKED_IN ||
    currentStatus === AttendanceStatus.CHECKED_IN;

  if (isCurrentActive) {
    if (
      targetStatus === AttendanceStatus.CLOCKED_OUT ||
      targetStatus === AttendanceStatus.CHECKED_OUT ||
      targetStatus === AttendanceStatus.ON_BREAK
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `Active attendance session can only transition to CLOCKED_OUT, ON_BREAK, or CORRECTED (requested: ${targetStatus}).`,
    };
  }

  if (currentStatus === AttendanceStatus.ON_BREAK) {
    if (
      targetStatus === AttendanceStatus.CLOCKED_IN ||
      targetStatus === AttendanceStatus.CHECKED_IN ||
      targetStatus === AttendanceStatus.CLOCKED_OUT ||
      targetStatus === AttendanceStatus.CHECKED_OUT
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `Break session can only transition to CLOCKED_IN, CLOCKED_OUT, or CORRECTED (requested: ${targetStatus}).`,
    };
  }

  const isCurrentClosed =
    currentStatus === AttendanceStatus.CLOCKED_OUT ||
    currentStatus === AttendanceStatus.CHECKED_OUT ||
    currentStatus === AttendanceStatus.CORRECTED;

  if (isCurrentClosed) {
    return {
      valid: false,
      reason: `Closed attendance record (${currentStatus}) cannot be reopened directly; must be adjusted via formal correction.`,
    };
  }

  return { valid: false, reason: `Invalid transition from ${currentStatus} to ${targetStatus}.` };
}

/**
 * Calculates shift duration in seconds between checkInAt and checkOutAt (or now).
 */
export function calculateShiftDurationSeconds(
  checkInAt: string,
  checkOutAt?: string | null,
  now: Date = new Date()
): number {
  const startMs = new Date(checkInAt).getTime();
  const endMs = checkOutAt ? new Date(checkOutAt).getTime() : now.getTime();
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

/**
 * Formats duration in seconds to human-readable string (e.g., "8h 15m").
 */
export function formatShiftDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) {
    return '0m';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

// =============================================================================
// 13. REPORTING & EXPORTS DOMAIN (PHASE 08)
// =============================================================================

export enum ReportType {
  TASKS = 'TASKS',
  VISITS = 'VISITS',
  ATTENDANCE = 'ATTENDANCE',
  WORKFORCE = 'WORKFORCE',
}

export enum ExportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
}

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  userId?: UserId;
  teamId?: TeamId;
  locationId?: LocationId;
  status?: string;
  priority?: TaskPriority;
  verificationResult?: LocationVerificationResult;
  isAdjusted?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaskReportRow {
  id: TaskId;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeName?: string;
  assigneeEmail?: string;
  teamName?: string;
  locationName?: string;
  dueAt?: IsoDateTime | null;
  completedAt?: IsoDateTime | null;
  checklistTotal: number;
  checklistCompleted: number;
  createdAt: IsoDateTime;
}

export interface TaskReportSummary {
  totalTasks: number;
  completedTasks: number;
  completionRatePercentage: number;
  inProgressTasks: number;
  overdueTasks: number;
  blockedTasks: number;
}

export interface TaskReportData {
  summary: TaskReportSummary;
  rows: TaskReportRow[];
  totalRows: number;
}

export interface VisitReportRow {
  id: VisitId;
  locationName: string;
  workerName: string;
  workerEmail?: string;
  scheduledStart: IsoDateTime;
  scheduledEnd?: IsoDateTime | null;
  checkedInAt?: IsoDateTime | null;
  checkedOutAt?: IsoDateTime | null;
  verificationResult?: LocationVerificationResult | null;
  proofsCount: number;
  status: VisitStatus;
}

export interface VisitReportSummary {
  totalScheduled: number;
  completedVisits: number;
  onTimeCheckInRatePercentage: number;
  geofenceVerificationRatePercentage: number;
  missedVisits: number;
}

export interface VisitReportData {
  summary: VisitReportSummary;
  rows: VisitReportRow[];
  totalRows: number;
}

export interface AttendanceReportRow {
  id: AttendanceId;
  date: string;
  workerName: string;
  workerEmail?: string;
  checkInAt: IsoDateTime;
  checkOutAt?: IsoDateTime | null;
  durationSeconds: number;
  status: AttendanceStatus;
  isManuallyAdjusted: boolean;
  adjustmentReason?: string | null;
}

export interface AttendanceReportSummary {
  totalShifts: number;
  completedShifts: number;
  totalDutyHours: number;
  manualAdjustmentRatePercentage: number;
}

export interface AttendanceReportData {
  summary: AttendanceReportSummary;
  rows: AttendanceReportRow[];
  totalRows: number;
}

export interface WorkforceReportRow {
  userId: UserId;
  workerName: string;
  workerEmail: string;
  role: UserRole;
  teamName?: string;
  assignedTasksCount: number;
  completedTasksCount: number;
  scheduledVisitsCount: number;
  completedVisitsCount: number;
  completedShiftsCount: number;
  totalActivitiesCount: number;
}

export interface WorkforceReportSummary {
  activeWorkersCount: number;
  totalTasksHandled: number;
  totalVisitsDispatched: number;
  totalRecordedActivities: number;
}

export interface WorkforceReportData {
  summary: WorkforceReportSummary;
  rows: WorkforceReportRow[];
  totalRows: number;
}

export interface ReportAuditLog {
  id: UUID;
  organizationId: TenantId;
  userId: UserId;
  reportType: ReportType;
  format: ExportFormat;
  filterParams: Record<string, unknown>;
  rowCount: number;
  exportedAt: IsoDateTime;
}

// =============================================================================
// 14. SAAS SUBSCRIPTIONS & BILLING DOMAIN (PHASE 08)
// =============================================================================

export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  BUSINESS = 'BUSINESS',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  INCOMPLETE = 'INCOMPLETE',
  PAUSED = 'PAUSED',
}

export enum BillingProviderType {
  MOCK = 'MOCK',
  STRIPE = 'STRIPE',
  RAZORPAY = 'RAZORPAY',
}

export enum BillingInterval {
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export interface PlanEntitlements {
  readonly maxWorkers: number;
  readonly maxLocations: number;
  readonly maxMonthlyVisits: number;
  readonly maxMonthlyExports: number;
  readonly reportingEnabled: boolean;
  readonly advancedReporting: boolean;
  readonly auditExports: boolean;
}

export interface PlanConfiguration {
  readonly id: SubscriptionPlan;
  readonly name: string;
  readonly description: string;
  readonly monthlyPriceUsd: number;
  readonly annualPriceUsd: number;
  readonly entitlements: PlanEntitlements;
}

export const PLANS: Record<SubscriptionPlan, PlanConfiguration> = {
  [SubscriptionPlan.FREE]: {
    id: SubscriptionPlan.FREE,
    name: 'Free Trial',
    description: 'Evaluation and test access for small pilot teams.',
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    entitlements: {
      maxWorkers: 3,
      maxLocations: 5,
      maxMonthlyVisits: 50,
      maxMonthlyExports: 5,
      reportingEnabled: true,
      advancedReporting: false,
      auditExports: false,
    },
  },
  [SubscriptionPlan.STARTER]: {
    id: SubscriptionPlan.STARTER,
    name: 'Starter',
    description: 'Essential field force dispatch and task management for small crews.',
    monthlyPriceUsd: 29,
    annualPriceUsd: 290,
    entitlements: {
      maxWorkers: 10,
      maxLocations: 25,
      maxMonthlyVisits: 300,
      maxMonthlyExports: 50,
      reportingEnabled: true,
      advancedReporting: false,
      auditExports: false,
    },
  },
  [SubscriptionPlan.GROWTH]: {
    id: SubscriptionPlan.GROWTH,
    name: 'Growth',
    description: 'Scalable operational tracking with advanced reporting for expanding teams.',
    monthlyPriceUsd: 79,
    annualPriceUsd: 790,
    entitlements: {
      maxWorkers: 30,
      maxLocations: 100,
      maxMonthlyVisits: 1500,
      maxMonthlyExports: 200,
      reportingEnabled: true,
      advancedReporting: true,
      auditExports: false,
    },
  },
  [SubscriptionPlan.BUSINESS]: {
    id: SubscriptionPlan.BUSINESS,
    name: 'Business',
    description: 'High-volume field operations with maximum capacity and audit compliance.',
    monthlyPriceUsd: 199,
    annualPriceUsd: 1990,
    entitlements: {
      maxWorkers: 100,
      maxLocations: 500,
      maxMonthlyVisits: 10000,
      maxMonthlyExports: 1000,
      reportingEnabled: true,
      advancedReporting: true,
      auditExports: true,
    },
  },
};

export interface BillingAccount {
  id: UUID;
  organizationId: TenantId;
  provider: BillingProviderType;
  providerCustomerId: string;
  billingEmail: string;
  currency: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Subscription {
  id: UUID;
  organizationId: TenantId;
  billingAccountId?: UUID | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  providerSubscriptionId?: string | null;
  billingInterval: BillingInterval;
  currentPeriodStart: IsoDateTime;
  currentPeriodEnd: IsoDateTime;
  cancelAtPeriodEnd: boolean;
  canceledAt?: IsoDateTime | null;
  trialEnd?: IsoDateTime | null;
  gracePeriodEnd?: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface UsageCounter {
  id: UUID;
  organizationId: TenantId;
  metric: string;
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
  currentUsage: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface BillingEvent {
  id: UUID;
  organizationId?: TenantId | null;
  provider: BillingProviderType;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processedAt?: IsoDateTime | null;
  error?: string | null;
  createdAt: IsoDateTime;
}

export interface BillingOverview {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: IsoDateTime;
  currentPeriodEnd: IsoDateTime;
  cancelAtPeriodEnd: boolean;
  gracePeriodEnd?: IsoDateTime | null;
  entitlements: PlanEntitlements;
  usage: {
    workers: { current: number; limit: number };
    locations: { current: number; limit: number };
    monthlyVisits: { current: number; limit: number };
    monthlyExports: { current: number; limit: number };
  };
}

export interface CreateCheckoutSessionParams {
  organizationId: TenantId;
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  userEmail: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface CreatePortalSessionParams {
  organizationId: TenantId;
  returnUrl: string;
}

export interface PortalSessionResult {
  portalUrl: string;
}

export interface CustomerBillingInfo {
  billingEmail?: string;
  name?: string;
  phone?: string;
}

/**
 * Checks whether a subscription is actively entitled to service.
 * Both ACTIVE and TRIALING grant standard operational service.
 * PAST_DUE grants service only during the grace period.
 */
export function isSubscriptionEntitled(subscription: {
  status: SubscriptionStatus;
  gracePeriodEnd?: string | null;
}, now: Date = new Date()): boolean {
  if (subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIALING) {
    return true;
  }
  if (subscription.status === SubscriptionStatus.PAST_DUE && subscription.gracePeriodEnd) {
    return new Date(subscription.gracePeriodEnd).getTime() > now.getTime();
  }
  return false;
}

/**
 * Checks whether an organization is currently within its past-due grace period.
 */
export function isWithinGracePeriod(subscription: {
  status: SubscriptionStatus;
  gracePeriodEnd?: string | null;
}, now: Date = new Date()): boolean {
  if (subscription.status !== SubscriptionStatus.PAST_DUE || !subscription.gracePeriodEnd) {
    return false;
  }
  return new Date(subscription.gracePeriodEnd).getTime() > now.getTime();
}

/**
 * Retrieves the plan configuration and entitlements for a given plan tier.
 */
export function getPlanConfiguration(plan: SubscriptionPlan): PlanConfiguration {
  return PLANS[plan] ?? PLANS[SubscriptionPlan.FREE];
}

/**
 * Retrieves entitlements for a given plan tier.
 */
export function getPlanEntitlements(plan: SubscriptionPlan): PlanEntitlements {
  return getPlanConfiguration(plan).entitlements;
}

