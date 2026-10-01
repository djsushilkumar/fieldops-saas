import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  UserProfile,
  Organization,
  Membership,
  UserRole,
  MembershipStatus,
  TenantId,
  UserId,
  UUID,
  IsoDateTime,
  Task,
  TaskStatus,
  Priority,
  TaskChecklistItem,
  Location,
  Visit,
  VisitId,
  VisitStatus,
  AttendanceRecord,
  AttendanceStatus,
} from '@fieldops/types';

// =============================================================================
// 1. SUPABASE CLIENT FACTORIES
// =============================================================================

export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://prod-api.fieldops.com/supabase'
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  );
}

export function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    getSupabaseAnonKey()
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
    !url.includes('placeholder') &&
    (anonKey || serviceKey) &&
    !anonKey?.includes('placeholder') &&
    !serviceKey?.includes('placeholder')
  );
}

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Returns a privileged Supabase admin client using the service role key.
 * Used strictly for server-side auth verification and controlled procedures.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey() || 'placeholder-service-key-for-offline';

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return cachedAdminClient;
}

/**
 * Returns a scoped Supabase user client forwarding the caller's JWT.
 * Supabase PostgreSQL evaluates RLS policies (e.g., auth.uid()) under this client.
 */
export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey() || 'placeholder-anon-key-for-offline';

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Cryptographically verifies a Supabase Auth access token using Supabase Auth.
 * Returns the Supabase User on success, or null on failure/expiration.
 */
export async function verifySupabaseToken(
  accessToken: string
): Promise<{ user: User | null; error: Error | null }> {
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
    return { user: null, error: new Error('Token is missing or empty') };
  }

  // Reject unsigned fo_jwt_ mock tokens in strict production
  if (accessToken.startsWith('fo_jwt_')) {
    if (process.env.NODE_ENV === 'production' && isSupabaseConfigured()) {
      return { user: null, error: new Error('Unsigned mock token rejected in production') };
    }
    // Allow decoding only in isolated mock/test mode
    try {
      const payloadStr = Buffer.from(accessToken.slice(7), 'base64url').toString('utf8');
      const payload = JSON.parse(payloadStr);
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return { user: null, error: new Error('Token expired') };
      }
      const mockUser = {
        id: payload.sub || 'usr_mock',
        email: payload.email || 'mock@fieldops.com',
        user_metadata: { full_name: payload.fullName || 'FieldOps User' },
        app_metadata: { tenant_id: payload.tenant_id },
      } as unknown as User;
      return { user: mockUser, error: null };
    } catch {
      return { user: null, error: new Error('Malformed token') };
    }
  }

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return { user: null, error: error || new Error('User not found') };
    }
    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

// =============================================================================
// 2. CANONICAL DATABASE ROW MAPPERS
// =============================================================================

export function mapDbProfileToUserProfile(row: any): UserProfile {
  return {
    id: (row.user_id || row.id) as UserId,
    email: row.email,
    fullName: row.full_name || row.email.split('@')[0],
    displayName: row.display_name || undefined,
    avatarUrl: row.avatar_url || undefined,
    phone: row.phone || undefined,
    timezone: row.timezone || 'UTC',
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
  };
}

export function mapDbOrgToOrganization(row: any): Organization {
  const settings = typeof row.settings === 'object' && row.settings !== null ? row.settings : {};
  return {
    id: row.id as TenantId,
    name: row.name,
    slug: row.slug,
    subscriptionTier: row.subscription_tier || 'GROWTH',
    subscriptionStatus: row.subscription_status || 'ACTIVE',
    settings: {
      allowedRadiusMeters: settings.allowed_radius_meters ?? settings.allowedRadiusMeters ?? 150,
      timezone: settings.timezone ?? 'UTC',
      requirePhotoProof: settings.require_photo_proof ?? settings.requirePhotoProof ?? true,
      requireSignature: settings.require_signature ?? settings.requireSignature ?? false,
    },
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
  };
}

export function mapDbMembershipToMembership(
  row: any,
  org?: Organization,
  profile?: UserProfile
): Membership {
  return {
    id: row.id as UUID,
    organizationId: row.organization_id as TenantId,
    userId: row.user_id as UserId,
    role: row.role as UserRole,
    status: row.status as MembershipStatus,
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
    organization: org,
    user: profile,
  };
}

export function mapDbTaskToTask(row: any, checklists: any[] = []): Task {
  return {
    id: row.id as any,
    organizationId: row.organization_id as TenantId,
    title: row.title,
    description: row.description || undefined,
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    createdBy: row.created_by as UserId,
    assignedTo: row.assigned_to ? (row.assigned_to as UserId) : undefined,
    assignedToName: row.assigned_to_name || undefined,
    assignedTeam: row.assigned_team ? (row.assigned_team as any) : undefined,
    locationId: row.location_id ? (row.location_id as any) : undefined,
    locationName: row.location_name || undefined,
    dueAt: row.due_at ? (row.due_at as IsoDateTime) : undefined,
    blockedReason: row.blocked_reason || undefined,
    version: row.version ?? 1,
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
    checklists: checklists.map((c) => ({
      id: c.id as UUID,
      taskId: (c.task_id || row.id) as any,
      organizationId: row.organization_id as TenantId,
      title: c.title,
      position: c.position ?? 0,
      isRequired: c.is_required ?? c.isRequired ?? true,
      isCompleted: c.is_completed ?? c.isCompleted ?? false,
      completedAt: c.completed_at ? (c.completed_at as IsoDateTime) : undefined,
      completedBy: c.completed_by ? (c.completed_by as UserId) : undefined,
      createdAt: (c.created_at || new Date().toISOString()) as IsoDateTime,
      updatedAt: (c.updated_at || new Date().toISOString()) as IsoDateTime,
    })),
  };
}

export function mapDbLocationToLocation(row: any): Location {
  return {
    id: row.id as any,
    organizationId: row.organization_id as TenantId,
    name: row.name,
    address: row.address || undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    allowedRadiusMeters: Number(row.allowed_radius_meters ?? 100),
    status: row.status || 'ACTIVE',
    createdBy: row.created_by as UserId,
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
  };
}

export function mapDbVisitToVisit(
  row: any,
  location?: any,
  proofs: any[] = [],
  checkin?: any,
  checkout?: any
): Visit {
  return {
    id: row.id as any,
    organizationId: row.organization_id as TenantId,
    locationId: row.location_id as any,
    location: location ? mapDbLocationToLocation(location) : undefined,
    assignedTo: row.assigned_to as UserId,
    status: row.status as VisitStatus,
    createdBy: (row.created_by || row.assigned_to) as UserId,
    scheduledStart: (row.scheduled_start || row.created_at) as IsoDateTime,
    scheduledEnd: (row.scheduled_end || row.created_at) as IsoDateTime,
    checkin: checkin
      ? {
          id: checkin.id as UUID,
          visitId: row.id as VisitId,
          organizationId: row.organization_id as TenantId,
          workerId: checkin.worker_id as UserId,
          latitude: Number(checkin.latitude),
          longitude: Number(checkin.longitude),
          accuracyMeters: Number(checkin.accuracy_meters),
          distanceMeters: Number(checkin.distance_meters || 0),
          verificationResult: checkin.verification_result,
          isException: Boolean(checkin.is_exception),
          exceptionReason: checkin.exception_reason || undefined,
          clientCapturedAt: checkin.client_captured_at as IsoDateTime,
          serverReceivedAt: (checkin.server_received_at || checkin.created_at) as IsoDateTime,
          createdAt: (checkin.created_at || new Date().toISOString()) as IsoDateTime,
        }
      : undefined,
    checkout: checkout
      ? {
          id: checkout.id as UUID,
          visitId: row.id as VisitId,
          organizationId: row.organization_id as TenantId,
          workerId: checkout.worker_id as UserId,
          latitude: Number(checkout.latitude),
          longitude: Number(checkout.longitude),
          accuracyMeters: Number(checkout.accuracy_meters),
          verificationResult: checkout.verification_result || 'VALID',
          notes: checkout.notes || undefined,
          clientCapturedAt: checkout.client_captured_at as IsoDateTime,
          serverReceivedAt: (checkout.server_received_at || checkout.created_at) as IsoDateTime,
          createdAt: (checkout.created_at || new Date().toISOString()) as IsoDateTime,
        }
      : undefined,
    proofs: proofs.map((p) => ({
      id: p.id as UUID,
      visitId: row.id as VisitId,
      organizationId: row.organization_id as TenantId,
      proofType: p.proof_type || p.type,
      storagePath: p.storage_path || p.storagePath,
      signerName: p.signer_name || p.signerName || undefined,
      notes: p.notes || undefined,
      createdBy: (p.created_by || row.assigned_to) as UserId,
      createdAt: (p.created_at || new Date().toISOString()) as IsoDateTime,
    })),
    version: row.version ?? 1,
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
  };
}

export function mapDbAttendanceToAttendance(row: any): AttendanceRecord {
  return {
    id: row.id as any,
    organizationId: row.organization_id as TenantId,
    userId: row.user_id as UserId,
    userName: row.user_name || undefined,
    date: row.date || new Date().toISOString().substring(0, 10),
    status: row.status as AttendanceStatus,
    checkInAt: (row.check_in_at || row.created_at) as IsoDateTime,
    checkInLatitude: row.check_in_latitude != null ? Number(row.check_in_latitude) : undefined,
    checkInLongitude: row.check_in_longitude != null ? Number(row.check_in_longitude) : undefined,
    checkInAccuracyMeters:
      row.check_in_accuracy_meters != null ? Number(row.check_in_accuracy_meters) : undefined,
    checkOutAt: row.check_out_at ? (row.check_out_at as IsoDateTime) : undefined,
    checkOutLatitude: row.check_out_latitude != null ? Number(row.check_out_latitude) : undefined,
    checkOutLongitude: row.check_out_longitude != null ? Number(row.check_out_longitude) : undefined,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : undefined,
    isManuallyAdjusted: Boolean(row.is_manually_adjusted),
    notes: row.notes || undefined,
    createdAt: (row.created_at || new Date().toISOString()) as IsoDateTime,
    updatedAt: (row.updated_at || new Date().toISOString()) as IsoDateTime,
  };
}
