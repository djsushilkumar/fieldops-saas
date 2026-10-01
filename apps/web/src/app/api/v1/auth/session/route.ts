import { NextRequest, NextResponse } from 'next/server';
import {
  AuthSession,
  Membership,
  Organization,
  TenantId,
  IsoDateTime,
} from '@fieldops/types';
import {
  requireAuthenticatedUser,
  extractRequestedTenantId,
} from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbOrgToOrganization,
  mapDbMembershipToMembership,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. PHASE 1 MANDATORY: Strict Authentication Guard
  // Returns 401 on missing, malformed, expired, or invalid token. Never falls back to default user.
  const authResult = await requireAuthenticatedUser(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { user, token } = authResult.context;
  const adminClient = getSupabaseAdminClient();
  const requestedTenantId = extractRequestedTenantId(request);

  let memberships: Membership[] = [];
  let activeMembership: Membership | undefined;

  if (isSupabaseConfigured()) {
    try {
      // 2. Fetch all ACTIVE memberships for this verified user
      const { data: memRows, error: memErr } = await adminClient
        .from('memberships')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          status,
          created_at,
          updated_at,
          organizations (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      if (!memErr && memRows && memRows.length > 0) {
        memberships = memRows.map((row: any) => {
          const org = row.organizations ? mapDbOrgToOrganization(row.organizations) : undefined;
          return mapDbMembershipToMembership(row, org, user);
        });

        // 3. Resolve active membership strictly from user's verified memberships
        if (requestedTenantId) {
          activeMembership = memberships.find((m) => m.organizationId === requestedTenantId);
        }

        // If requested tenant not found in user's memberships or not provided, pick first active
        if (!activeMembership && memberships.length > 0) {
          activeMembership = memberships[0];
        }
      }
    } catch (err) {
      console.error('[Session API]: Failed to query user memberships', err);
    }
  } else {
    // Isolated mock/test fallback
    const tenantToUse = requestedTenantId || ('org_default' as TenantId);
    const mockOrg: Organization = {
      id: tenantToUse,
      name: 'Field Operations',
      slug: 'field-operations',
      subscriptionTier: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      settings: {
        allowedRadiusMeters: 150,
        timezone: 'UTC',
        requirePhotoProof: true,
        requireSignature: false,
      },
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    const mockMem: Membership = {
      id: 'mem_default' as any,
      organizationId: tenantToUse,
      userId: user.id,
      role: 'OWNER' as any,
      status: 'ACTIVE' as any,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
      organization: mockOrg,
      user,
    };
    memberships = [mockMem];
    activeMembership = mockMem;
  }

  const sessionResponse: AuthSession = {
    user,
    tokens: {
      accessToken: token,
      expiresIn: 604800,
      tokenType: 'Bearer',
    },
    activeMembership: activeMembership || undefined,
    availableMemberships: memberships,
  };

  const response = NextResponse.json({
    success: true,
    data: sessionResponse,
  });

  if (activeMembership) {
    response.cookies.set('fieldops_active_org_id', activeMembership.organizationId, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 * 7,
    });
  }

  return response;
}
