import {
  AuthSession,
  UserProfile,
  Membership,
  Organization,
  UserRole,
  MembershipStatus,
  TenantId,
  UserId,
  UUID,
  IsoDateTime,
} from '@fieldops/types';

interface MemoryDb {
  users: Map<string, UserProfile>;
  passwords: Map<string, string>;
  organizations: Map<string, Organization>;
  memberships: Map<string, Membership[]>;
  tasks: Map<string, any[]>;
  locations: Map<string, any[]>;
  visits: Map<string, any[]>;
  attendance: Map<string, any[]>;
}

const g = globalThis as unknown as { __fieldops_db?: MemoryDb };
if (!g.__fieldops_db) {
  g.__fieldops_db = {
    users: new Map(),
    passwords: new Map(),
    organizations: new Map(),
    memberships: new Map(),
    tasks: new Map(),
    locations: new Map(),
    visits: new Map(),
    attendance: new Map(),
  };
}

export const memoryDb = g.__fieldops_db;

export function createSessionResponse(
  user: UserProfile,
  org: Organization,
  role: UserRole = UserRole.OWNER
): AuthSession {
  const membershipId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` as UUID;
  const membership: Membership = {
    id: membershipId,
    organizationId: org.id,
    userId: user.id,
    role,
    status: MembershipStatus.ACTIVE,
    createdAt: new Date().toISOString() as IsoDateTime,
    updatedAt: new Date().toISOString() as IsoDateTime,
    organization: org,
    user,
  };

  const userMemberships = memoryDb.memberships.get(user.id) || [];
  if (!userMemberships.some((m) => m.organizationId === org.id)) {
    userMemberships.push(membership);
    memoryDb.memberships.set(user.id, userMemberships);
  }

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    tenant_id: org.id,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  };
  const tokenStr = `fo_jwt_${Buffer.from(JSON.stringify(tokenPayload)).toString('base64url')}`;

  return {
    user,
    tokens: {
      accessToken: tokenStr,
      refreshToken: `fo_ref_${Math.random().toString(36).substring(2)}`,
      expiresIn: 604800,
      tokenType: 'Bearer',
    },
    activeMembership: membership,
    availableMemberships: userMemberships,
  };
}

export async function syncWithSupabaseAuth(
  endpoint: string,
  body: Record<string, unknown>
): Promise<any | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey || supabaseUrl.includes('placeholder') || supabaseUrl.includes('127.0.0.1')) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Supabase Auth Sync Warning]:', err);
  }

  return null;
}
