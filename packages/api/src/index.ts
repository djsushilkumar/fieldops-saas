import {
  ApiResponse,
  ApiErrorResponse,
  ApiErrorDetail,
  ErrorCode,
  RequestId,
  UUID,
  TenantId,
  UserId,
  TeamId,
  TaskId,
  UserRole,
  MembershipStatus,
  UserProfile,
  Organization,
  Membership,
  OrganizationInvitation,
  AuthSession,
  AuthTokens,
  Team,
  TeamMember,
  Task,
  TaskStatus,
  Priority,
  TaskChecklistItem,
  TaskAttachment,
  TaskComment,
  TaskActivity,
  TaskFilterParams,
  TaskSortParams,
  PaginationParams,
  PaginatedData,
  IsoDateTime,
  OfflineMutation,
  OfflineSyncResponse,
  LocationId,
  VisitId,
  Location,
  LocationStatus,
  LocationVerificationResult,
  ProofType,
  LocationEventType,
  Visit,
  VisitStatus,
  VisitCheckin,
  VisitCheckout,
  VisitProof,
  VisitActivity,
  LocationEvent,
  VisitFilterParams,
  VisitSortParams,
  GpsCoordinates,
} from '@fieldops/types';
import { z } from 'zod';


// =============================================================================
// 1. CLIENT CONTRACT & INTERFACES
// =============================================================================

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly getAccessToken?: () => Promise<string | null>;
  readonly getTenantId?: () => string | null;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly customFetch?: typeof fetch;
}

export interface RequestOptions {
  readonly headers?: Record<string, string>;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly signal?: AbortSignal;
  readonly skipRetry?: boolean;
}

// =============================================================================
// 2. ERROR NORMALIZATION
// =============================================================================

export class ApiClientError extends Error {
  public readonly detail: ApiErrorDetail;
  public readonly status: number;

  constructor(detail: ApiErrorDetail, status: number = 500) {
    super(detail.message);
    this.name = 'ApiClientError';
    this.detail = detail;
    this.status = status;
  }
}

/**
 * Normalizes HTTP status codes and responses into stable FieldOps ErrorCode values.
 */
export function normalizeHttpError(
  status: number,
  body: unknown,
  requestId: string
): ApiErrorDetail {
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object'
  ) {
    const errorObj = (body as { error: Record<string, unknown> }).error;
    return {
      code: (errorObj.code as string) || ErrorCode.INTERNAL_ERROR,
      message: (errorObj.message as string) || 'An unexpected error occurred.',
      request_id: (errorObj.request_id as string) || requestId,
      details: errorObj.details as Record<string, unknown> | undefined,
    };
  }

  let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
  let message = `Request failed with status ${status}`;

  switch (status) {
    case 400:
      code = ErrorCode.VALIDATION_ERROR;
      message = 'Invalid request parameters.';
      break;
    case 401:
      code = ErrorCode.AUTHENTICATION_ERROR;
      message = 'Authentication required or token expired.';
      break;
    case 403:
      code = ErrorCode.AUTHORIZATION_ERROR;
      message = 'You do not have permission to perform this action.';
      break;
    case 404:
      code = ErrorCode.NOT_FOUND;
      message = 'The requested resource was not found.';
      break;
    case 409:
      code = ErrorCode.CONFLICT;
      message = 'Resource conflict or concurrency collision.';
      break;
    case 429:
      code = ErrorCode.RATE_LIMITED;
      message = 'Rate limit exceeded. Please try again later.';
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      code = ErrorCode.INTERNAL_ERROR;
      message = 'Internal server error occurred.';
      break;
  }

  return {
    code,
    message,
    request_id: requestId,
  };
}

// =============================================================================
// 3. RETRY POLICY
// =============================================================================

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 200
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }

      // Only retry on network errors or 5xx server errors
      if (err instanceof ApiClientError && err.status < 500 && err.status !== 429) {
        throw err;
      }

      const jitter = Math.random() * 100;
      const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// =============================================================================
// 4. API CLIENT IMPLEMENTATION
// =============================================================================

export class FieldOpsApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => Promise<string | null>;
  private readonly getTenantId?: () => string | null;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getAccessToken = options.getAccessToken;
    this.getTenantId = options.getTenantId;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.customFetch ?? (typeof fetch !== 'undefined' ? fetch : (null as unknown as typeof fetch));
  }

  public async get<T>(
    path: string,
    schema?: z.ZodType<T>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, schema, options);
  }

  public async post<T>(
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('POST', path, body, schema, options);
  }

  public async patch<T>(
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('PATCH', path, body, schema, options);
  }

  public async put<T>(
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('PUT', path, body, schema, options);
  }

  public async delete<T>(
    path: string,
    schema?: z.ZodType<T>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('DELETE', path, undefined, schema, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    schema?: z.ZodType<T>,
    options?: RequestOptions
  ): Promise<T> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` as RequestId;

    const executeCall = async (): Promise<T> => {
      const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

      if (options?.query) {
        for (const [k, v] of Object.entries(options.query)) {
          if (v !== undefined) {
            url.searchParams.append(k, String(v));
          }
        }
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'x-request-id': requestId,
        ...options?.headers,
      };

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      if (this.getAccessToken) {
        const token = await this.getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      if (this.getTenantId) {
        const tenantId = this.getTenantId();
        if (tenantId) {
          headers['x-tenant-id'] = tenantId;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      const signal = options?.signal || controller.signal;

      try {
        const response = await this.fetchImpl(url.toString(), {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal,
        });

        clearTimeout(timeoutId);

        let json: unknown;
        try {
          json = await response.json();
        } catch {
          json = null;
        }

        if (!response.ok) {
          const errorDetail = normalizeHttpError(response.status, json, requestId);
          throw new ApiClientError(errorDetail, response.status);
        }

        const data = (json && typeof json === 'object' && 'data' in json)
          ? (json as { data: unknown }).data
          : json;

        if (schema) {
          return schema.parse(data);
        }

        return data as T;
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof ApiClientError) {
          throw err;
        }

        const message = err instanceof Error ? err.message : 'Unknown network error';
        const errorDetail: ApiErrorDetail = {
          code: ErrorCode.NETWORK_ERROR,
          message,
          request_id: requestId,
        };
        throw new ApiClientError(errorDetail, 0);
      }
    };

    if (options?.skipRetry) {
      return executeCall();
    }

    return executeWithRetry(executeCall, this.maxRetries);
  }
}

// =============================================================================
// 5. PHASE 03 DOMAIN SERVICES
// =============================================================================

export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
}

export interface SignUpPayload {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly organizationName?: string;
  readonly organizationSlug?: string;
}

export interface CreateOrganizationPayload {
  readonly name: string;
  readonly slug: string;
  readonly settings?: Record<string, unknown>;
}

export interface InviteMemberPayload {
  readonly email: string;
  readonly role: UserRole;
}

export interface AcceptInvitationPayload {
  readonly token: string;
  readonly fullName?: string;
  readonly password?: string;
}

/**
 * Authentication and identity service.
 */
export class AuthService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async signIn(credentials: SignInCredentials): Promise<AuthSession> {
    return this.client.post<AuthSession>('/api/v1/auth/login', credentials);
  }

  public async signUp(payload: SignUpPayload): Promise<AuthSession> {
    return this.client.post<AuthSession>('/api/v1/auth/signup', payload);
  }

  public async signOut(): Promise<{ success: true }> {
    return this.client.post<{ success: true }>('/api/v1/auth/logout');
  }

  public async getSession(): Promise<AuthSession | null> {
    try {
      return await this.client.get<AuthSession>('/api/v1/auth/session');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        return null;
      }
      throw err;
    }
  }

  public async requestPasswordReset(email: string): Promise<{ success: true }> {
    return this.client.post<{ success: true }>('/api/v1/auth/forgot-password', { email });
  }
}

/**
 * Organization and tenant management service.
 */
export class OrganizationService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async listOrganizations(): Promise<readonly Organization[]> {
    return this.client.get<readonly Organization[]>('/api/v1/organizations');
  }

  public async getOrganization(id: TenantId): Promise<Organization> {
    return this.client.get<Organization>(`/api/v1/organizations/${id}`);
  }

  public async createOrganization(
    payload: CreateOrganizationPayload
  ): Promise<{ organization: Organization; membership: Membership }> {
    return this.client.post<{ organization: Organization; membership: Membership }>(
      '/api/v1/organizations',
      payload
    );
  }

  public async updateOrganization(
    id: TenantId,
    update: Partial<Organization>
  ): Promise<Organization> {
    return this.client.patch<Organization>(`/api/v1/organizations/${id}`, update);
  }
}

/**
 * Membership and invitation service.
 */
export class MembershipService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async listMembers(organizationId: TenantId): Promise<readonly Membership[]> {
    return this.client.get<readonly Membership[]>(`/api/v1/organizations/${organizationId}/members`);
  }

  public async inviteMember(
    organizationId: TenantId,
    payload: InviteMemberPayload
  ): Promise<OrganizationInvitation> {
    return this.client.post<OrganizationInvitation>(
      `/api/v1/organizations/${organizationId}/invitations`,
      payload
    );
  }

  public async acceptInvitation(
    payload: AcceptInvitationPayload
  ): Promise<{ membership: Membership }> {
    return this.client.post<{ membership: Membership }>('/api/v1/invitations/accept', payload);
  }

  public async updateMemberRole(
    organizationId: TenantId,
    memberId: UUID,
    role: UserRole
  ): Promise<Membership> {
    return this.client.patch<Membership>(
      `/api/v1/organizations/${organizationId}/members/${memberId}/role`,
      { role }
    );
  }

  public async updateMemberStatus(
    organizationId: TenantId,
    memberId: UUID,
    status: MembershipStatus
  ): Promise<Membership> {
    return this.client.patch<Membership>(
      `/api/v1/organizations/${organizationId}/members/${memberId}/status`,
      { status }
    );
  }

  public async removeMember(organizationId: TenantId, memberId: UUID): Promise<{ success: true }> {
    return this.client.delete<{ success: true }>(
      `/api/v1/organizations/${organizationId}/members/${memberId}`
    );
  }
}

/**
 * Profile service.
 */
export class ProfileService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async getProfile(): Promise<UserProfile> {
    return this.client.get<UserProfile>('/api/v1/profile');
  }

  public async updateProfile(update: Partial<UserProfile>): Promise<UserProfile> {
    return this.client.patch<UserProfile>('/api/v1/profile', update);
  }
}

// =============================================================================
// 6. PHASE 04 TASK MANAGEMENT SERVICES
// =============================================================================

export interface CreateTaskPayload {
  readonly title: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly assignedTo?: UserId;
  readonly assignedTeam?: TeamId;
  readonly dueAt?: IsoDateTime;
  readonly checklists?: readonly {
    readonly title: string;
    readonly isRequired?: boolean;
  }[];
}

export interface UpdateTaskPayload {
  readonly title?: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly assignedTo?: UserId | null;
  readonly assignedTeam?: TeamId | null;
  readonly dueAt?: IsoDateTime | null;
  readonly version: number;
}

export interface AssignTaskPayload {
  readonly assignedTo?: UserId;
  readonly assignedTeam?: TeamId;
}

export interface TransitionTaskStatusPayload {
  readonly status: TaskStatus;
  readonly blockedReason?: string;
  readonly reopenReason?: string;
  readonly expectedVersion?: number;
}

export interface CreateChecklistItemPayload {
  readonly title: string;
  readonly isRequired?: boolean;
}

export interface CreateAttachmentMetadataPayload {
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly storagePath: string;
}

export interface CreateCommentPayload {
  readonly content: string;
}

export class TaskService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async listTasks(
    filters?: TaskFilterParams,
    pagination?: PaginationParams,
    sort?: TaskSortParams
  ): Promise<PaginatedData<Task>> {
    const query: Record<string, string | number | boolean | undefined> = {};

    if (filters?.status) {
      query.status = Array.isArray(filters.status)
        ? (filters.status as readonly string[]).join(',')
        : String(filters.status);
    }
    if (filters?.priority) {
      query.priority = Array.isArray(filters.priority)
        ? (filters.priority as readonly string[]).join(',')
        : String(filters.priority);
    }
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters?.assignedTeam) query.assignedTeam = filters.assignedTeam;
    if (filters?.isOverdue !== undefined) query.isOverdue = filters.isOverdue;
    if (filters?.search) query.search = filters.search;
    if (filters?.fromDate) query.fromDate = filters.fromDate;
    if (filters?.toDate) query.toDate = filters.toDate;

    if (pagination?.page !== undefined) query.page = pagination.page;
    if (pagination?.pageSize !== undefined) query.pageSize = pagination.pageSize;
    if (pagination?.cursor) query.cursor = pagination.cursor;

    if (sort?.field) query.sortField = sort.field;
    if (sort?.order) query.sortOrder = sort.order;

    return this.client.get<PaginatedData<Task>>('/api/v1/tasks', undefined, { query });
  }

  public async getTask(id: TaskId): Promise<Task> {
    return this.client.get<Task>(`/api/v1/tasks/${id}`);
  }

  public async createTask(payload: CreateTaskPayload): Promise<Task> {
    return this.client.post<Task>('/api/v1/tasks', payload);
  }

  public async updateTask(id: TaskId, payload: UpdateTaskPayload): Promise<Task> {
    return this.client.patch<Task>(`/api/v1/tasks/${id}`, payload);
  }

  public async assignTask(id: TaskId, payload: AssignTaskPayload): Promise<Task> {
    return this.client.post<Task>(`/api/v1/tasks/${id}/assign`, payload);
  }

  public async transitionStatus(
    id: TaskId,
    payload: TransitionTaskStatusPayload
  ): Promise<Task> {
    return this.client.post<Task>(`/api/v1/tasks/${id}/transition`, payload);
  }

  public async listChecklists(taskId: TaskId): Promise<readonly TaskChecklistItem[]> {
    return this.client.get<readonly TaskChecklistItem[]>(`/api/v1/tasks/${taskId}/checklists`);
  }

  public async addChecklistItem(
    taskId: TaskId,
    payload: CreateChecklistItemPayload
  ): Promise<TaskChecklistItem> {
    return this.client.post<TaskChecklistItem>(`/api/v1/tasks/${taskId}/checklists`, payload);
  }

  public async toggleChecklistItem(
    taskId: TaskId,
    itemId: UUID,
    isCompleted: boolean
  ): Promise<TaskChecklistItem> {
    return this.client.patch<TaskChecklistItem>(
      `/api/v1/tasks/${taskId}/checklists/${itemId}`,
      { isCompleted }
    );
  }

  public async deleteChecklistItem(
    taskId: TaskId,
    itemId: UUID
  ): Promise<{ success: true }> {
    return this.client.delete<{ success: true }>(`/api/v1/tasks/${taskId}/checklists/${itemId}`);
  }

  public async listAttachments(taskId: TaskId): Promise<readonly TaskAttachment[]> {
    return this.client.get<readonly TaskAttachment[]>(`/api/v1/tasks/${taskId}/attachments`);
  }

  public async createAttachmentMetadata(
    taskId: TaskId,
    payload: CreateAttachmentMetadataPayload
  ): Promise<TaskAttachment> {
    return this.client.post<TaskAttachment>(`/api/v1/tasks/${taskId}/attachments`, payload);
  }

  public async listComments(taskId: TaskId): Promise<readonly TaskComment[]> {
    return this.client.get<readonly TaskComment[]>(`/api/v1/tasks/${taskId}/comments`);
  }

  public async addComment(
    taskId: TaskId,
    payload: CreateCommentPayload
  ): Promise<TaskComment> {
    return this.client.post<TaskComment>(`/api/v1/tasks/${taskId}/comments`, payload);
  }

  public async listActivities(taskId: TaskId): Promise<readonly TaskActivity[]> {
    return this.client.get<readonly TaskActivity[]>(`/api/v1/tasks/${taskId}/activities`);
  }

  public async syncOfflineMutations(
    mutations: readonly OfflineMutation[]
  ): Promise<OfflineSyncResponse> {
    return this.client.post<OfflineSyncResponse>('/api/v1/sync/mutations', { mutations });
  }
}

/**
 * Team and territory management service.
 */
export class TeamService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async listTeams(): Promise<readonly Team[]> {
    return this.client.get<readonly Team[]>('/api/v1/teams');
  }

  public async getTeam(id: TeamId): Promise<Team> {
    return this.client.get<Team>(`/api/v1/teams/${id}`);
  }

  public async createTeam(payload: { name: string; description?: string }): Promise<Team> {
    return this.client.post<Team>('/api/v1/teams', payload);
  }

  public async addTeamMember(teamId: TeamId, userId: UserId): Promise<TeamMember> {
    return this.client.post<TeamMember>(`/api/v1/teams/${teamId}/members`, { userId });
  }

  public async removeTeamMember(teamId: TeamId, userId: UserId): Promise<{ success: true }> {
    return this.client.delete<{ success: true }>(`/api/v1/teams/${teamId}/members/${userId}`);
  }
}

// =============================================================================
// 7. PHASE 05 FIELD OPERATIONS & VISIT SERVICES
// =============================================================================

export interface CreateLocationPayload {
  readonly name: string;
  readonly address?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly allowedRadiusMeters?: number;
}

export interface UpdateLocationPayload {
  readonly name?: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly allowedRadiusMeters?: number;
  readonly status?: LocationStatus;
}

export class LocationService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async listLocations(filters?: { status?: LocationStatus; search?: string }): Promise<readonly Location[]> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.search) query.search = filters.search;
    return this.client.get<readonly Location[]>('/api/v1/locations', undefined, { query });
  }

  public async getLocation(id: LocationId): Promise<Location> {
    return this.client.get<Location>(`/api/v1/locations/${id}`);
  }

  public async createLocation(payload: CreateLocationPayload): Promise<Location> {
    return this.client.post<Location>('/api/v1/locations', payload);
  }

  public async updateLocation(id: LocationId, payload: UpdateLocationPayload): Promise<Location> {
    return this.client.patch<Location>(`/api/v1/locations/${id}`, payload);
  }

  public async archiveLocation(id: LocationId): Promise<Location> {
    return this.client.patch<Location>(`/api/v1/locations/${id}`, { status: LocationStatus.ARCHIVED });
  }
}

export interface CreateVisitPayload {
  readonly locationId: LocationId;
  readonly taskId?: TaskId;
  readonly assignedTo?: UserId;
  readonly scheduledStart: IsoDateTime;
  readonly scheduledEnd?: IsoDateTime;
}

export interface UpdateVisitPayload {
  readonly locationId?: LocationId;
  readonly taskId?: TaskId | null;
  readonly assignedTo?: UserId | null;
  readonly scheduledStart?: IsoDateTime;
  readonly scheduledEnd?: IsoDateTime | null;
  readonly version: number;
}

export interface TransitionVisitStatusPayload {
  readonly status: VisitStatus;
  readonly cancelReason?: string;
  readonly expectedVersion?: number;
}

export interface CheckinPayload {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly clientCapturedAt: IsoDateTime;
  readonly exceptionReason?: string;
  readonly deviceMetadata?: Record<string, unknown>;
}

export interface CheckoutPayload {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly clientCapturedAt: IsoDateTime;
  readonly notes?: string;
  readonly deviceMetadata?: Record<string, unknown>;
}

export interface CreateProofPayload {
  readonly proofType: ProofType;
  readonly storagePath?: string;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly fileSizeBytes?: number;
  readonly notes?: string;
  readonly signerName?: string;
  readonly taskId?: TaskId;
}

export class VisitService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async listVisits(
    filters?: VisitFilterParams,
    pagination?: PaginationParams,
    sort?: VisitSortParams
  ): Promise<PaginatedData<Visit>> {
    const query: Record<string, string | number | boolean | undefined> = {};

    if (filters?.status) {
      query.status = Array.isArray(filters.status)
        ? (filters.status as readonly string[]).join(',')
        : String(filters.status);
    }
    if (filters?.assignedTo) query.assignedTo = filters.assignedTo;
    if (filters?.locationId) query.locationId = filters.locationId;
    if (filters?.taskId) query.taskId = filters.taskId;
    if (filters?.isOverdue !== undefined) query.isOverdue = filters.isOverdue;
    if (filters?.fromDate) query.fromDate = filters.fromDate;
    if (filters?.toDate) query.toDate = filters.toDate;

    if (pagination?.page !== undefined) query.page = pagination.page;
    if (pagination?.pageSize !== undefined) query.pageSize = pagination.pageSize;
    if (pagination?.cursor) query.cursor = pagination.cursor;

    if (sort?.field) query.sortField = sort.field;
    if (sort?.order) query.sortOrder = sort.order;

    return this.client.get<PaginatedData<Visit>>('/api/v1/visits', undefined, { query });
  }

  public async getVisit(id: VisitId): Promise<Visit> {
    return this.client.get<Visit>(`/api/v1/visits/${id}`);
  }

  public async createVisit(payload: CreateVisitPayload): Promise<Visit> {
    return this.client.post<Visit>('/api/v1/visits', payload);
  }

  public async updateVisit(id: VisitId, payload: UpdateVisitPayload): Promise<Visit> {
    return this.client.patch<Visit>(`/api/v1/visits/${id}`, payload);
  }

  public async transitionStatus(
    id: VisitId,
    payload: TransitionVisitStatusPayload
  ): Promise<Visit> {
    return this.client.post<Visit>(`/api/v1/visits/${id}/transition`, payload);
  }

  public async recordCheckin(id: VisitId, payload: CheckinPayload): Promise<VisitCheckin> {
    return this.client.post<VisitCheckin>(`/api/v1/visits/${id}/checkin`, payload);
  }

  public async recordCheckout(id: VisitId, payload: CheckoutPayload): Promise<VisitCheckout> {
    return this.client.post<VisitCheckout>(`/api/v1/visits/${id}/checkout`, payload);
  }

  public async listProofs(visitId: VisitId): Promise<readonly VisitProof[]> {
    return this.client.get<readonly VisitProof[]>(`/api/v1/visits/${visitId}/proofs`);
  }

  public async createProof(visitId: VisitId, payload: CreateProofPayload): Promise<VisitProof> {
    return this.client.post<VisitProof>(`/api/v1/visits/${visitId}/proofs`, payload);
  }

  public async listActivities(visitId: VisitId): Promise<readonly VisitActivity[]> {
    return this.client.get<readonly VisitActivity[]>(`/api/v1/visits/${visitId}/activities`);
  }
}


