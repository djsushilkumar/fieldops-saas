import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuthenticatedUser } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  mapDbMembershipToMembership,
  mapDbOrgToOrganization,
} from '@/lib/supabase-server';
import { Membership, MembershipStatus, UserRole, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guard = await requireAuthenticatedUser(request);
  if (!guard.success) {
    return guard.response;
  }

  const { user } = guard.context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    );
  }

  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invitation token is required' } },
      { status: 400 }
    );
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient.rpc('accept_invitation', {
        p_token_hash: tokenHash,
        p_user_id: user.id,
      });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'INVITATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }

      const memRow = data?.membership;
      if (!memRow) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Failed to create membership' } },
          { status: 500 }
        );
      }

      // Fetch org details
      const { data: orgRow } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', memRow.organization_id)
        .maybeSingle();

      const org = orgRow ? mapDbOrgToOrganization(orgRow) : undefined;
      const membership = mapDbMembershipToMembership(memRow, org, user);

      return NextResponse.json({
        success: true,
        data: { membership },
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const now = new Date().toISOString() as IsoDateTime;
  const fallbackMem: Membership = {
    id: `mem_${Date.now()}` as any,
    organizationId: 'org_default' as any,
    userId: user.id,
    role: UserRole.FIELD_WORKER,
    status: MembershipStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({
    success: true,
    data: { membership: fallbackMem },
  });
}
