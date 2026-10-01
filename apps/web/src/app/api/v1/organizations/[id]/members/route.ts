import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbMembershipToMembership,
  mapDbProfileToUserProfile,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuthenticatedUser(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { user } = authResult.context;
  const targetOrgId = params.id;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      // 1. Verify caller has active membership in target organization (Tenant Isolation)
      const { data: callerMem, error: callerErr } = await adminClient
        .from('memberships')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (callerErr || !callerMem) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CROSS_TENANT_FORBIDDEN',
              message: 'Cross-tenant resource access strictly prohibited: You do not belong to this organization.',
            },
          },
          { status: 403 }
        );
      }

      // 2. Fetch all memberships for this tenant
      const { data: memRows, error: memErr } = await adminClient
        .from('memberships')
        .select('*')
        .eq('organization_id', targetOrgId);

      if (memErr) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: memErr.message } },
          { status: 500 }
        );
      }

      // 3. Fetch corresponding profiles
      const userIds = (memRows || []).map((m: any) => m.user_id);
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

      const memberships = (memRows || []).map((m: any) => {
        const profRow = profileMap.get(m.user_id);
        const userProf = profRow ? mapDbProfileToUserProfile(profRow) : undefined;
        return mapDbMembershipToMembership(m, undefined, userProf);
      });

      return NextResponse.json({
        success: true,
        data: memberships,
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  // Fallback in test/mock mode
  return NextResponse.json({
    success: true,
    data: [
      {
        id: 'mem_caller',
        organizationId: targetOrgId,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user,
      },
    ],
  });
}
