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
  readonly assignedTeam?: TeamId;
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
  VISIT_CANCEL: 'visit:cancel',
  VISIT_CHECKIN_OWN: 'visit:checkin:own',
  VISIT_GEOFENCE_OVERRIDE: 'visit:geofence_override',
  VISIT_VIEW_ALL: 'visit:view:all',
  VISIT_VIEW_TEAM: 'visit:view:team',
  VISIT_VIEW_OWN: 'visit:view:own',

  // Attendance & Shift
  ATTENDANCE_CLOCK_OWN: 'attendance:clock:own',
  ATTENDANCE_VIEW_ORG: 'attendance:view:org',
  ATTENDANCE_VIEW_TEAM: 'attendance:view:team',
  ATTENDANCE_ADJUST: 'attendance:adjust',

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
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_ALL,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_ORG,
    Permissions.ATTENDANCE_ADJUST,
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
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_ALL,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_ORG,
    Permissions.ATTENDANCE_ADJUST,
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
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_ALL,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_ORG,
    Permissions.ATTENDANCE_ADJUST,
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
    Permissions.VISIT_CANCEL,
    Permissions.VISIT_CHECKIN_OWN,
    Permissions.VISIT_GEOFENCE_OVERRIDE,
    Permissions.VISIT_VIEW_TEAM,
    Permissions.ATTENDANCE_CLOCK_OWN,
    Permissions.ATTENDANCE_VIEW_TEAM,
  ],
  [UserRole.FIELD_WORKER]: [
    Permissions.MEMBER_PROFILE_VIEW_OWN,
    Permissions.LOCATION_VIEW_OWN,
    Permissions.TASK_UPDATE_OWN,
    Permissions.TASK_VIEW_OWN,
    Permissions.VISIT_CHECKIN_OWN,
    Permissions.VISIT_VIEW_OWN,
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
          permission === Permissions.VISIT_VIEW_OWN) &&
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
