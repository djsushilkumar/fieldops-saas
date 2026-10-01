import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbOrgToOrganization,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { Organization, TenantId, IsoDateTime } from '@fieldops/types';

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
      // 1. Enforce tenant isolation: User must have an ACTIVE membership in this organization
      const { data: mem, error: memErr } = await adminClient
        .from('memberships')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (memErr || !mem) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CROSS_TENANT_FORBIDDEN',
              message: 'Cross-tenant resource access strictly prohibited: You do not have an active membership in this organization.',
            },
          },
          { status: 403 }
        );
      }

      // 2. Fetch organization row
      const { data: orgRow, error: orgErr } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', targetOrgId)
        .maybeSingle();

      if (orgErr || !orgRow) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbOrgToOrganization(orgRow),
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const mockOrg: Organization = {
    id: targetOrgId as TenantId,
    name: 'Organization ' + targetOrgId,
    slug: String(targetOrgId).replace(/[^a-z0-9-]/gi, '').toLowerCase(),
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

  return NextResponse.json({
    success: true,
    data: mockOrg,
  });
}

export async function PATCH(
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
      // Must be OWNER or ADMIN in target organization
      const { data: mem, error: memErr } = await adminClient
        .from('memberships')
        .select('*')
        .eq('organization_id', targetOrgId)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      if (memErr || !mem) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CROSS_TENANT_FORBIDDEN',
              message: 'Cross-tenant resource access strictly prohibited.',
            },
          },
          { status: 403 }
        );
      }

      if (mem.role !== 'OWNER' && mem.role !== 'ADMIN') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Only OWNER and ADMIN roles may modify organization settings.',
            },
          },
          { status: 403 }
        );
      }

      const body = await request.json();
      const updates: Record<string, any> = {};
      if (body.name) updates.name = body.name.trim();
      if (body.settings) updates.settings = body.settings;

      const { data: updatedOrg, error: updateErr } = await adminClient
        .from('organizations')
        .update(updates)
        .eq('id', targetOrgId)
        .select()
        .single();

      if (updateErr || !updatedOrg) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: updateErr?.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbOrgToOrganization(updatedOrg),
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: { id: targetOrgId },
  });
}
