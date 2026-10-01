import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbOrgToOrganization,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { Organization, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { user } = authResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('memberships')
        .select('organizations (*)')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const organizations = (data || [])
        .map((row: any) => row.organizations)
        .filter(Boolean)
        .map(mapDbOrgToOrganization);

      return NextResponse.json({
        success: true,
        data: organizations,
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const mockOrg: Organization = {
    id: 'org_default' as TenantId,
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

  return NextResponse.json({
    success: true,
    data: [mockOrg],
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedUser(request);
  if (!authResult.success) {
    return authResult.response;
  }

  const { user } = authResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const name = body?.name?.trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Organization name is required' } },
        { status: 400 }
      );
    }

    const slug = (body.slug || name.toLowerCase().replace(/[^a-z0-9-]/g, '-')).slice(0, 50);
    const uniqueSlug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;

    if (isSupabaseConfigured()) {
      const { data: rpcData, error: rpcErr } = await adminClient.rpc(
        'create_organization_with_owner',
        {
          p_name: name,
          p_slug: uniqueSlug,
          p_user_id: user.id,
          p_settings: {
            allowed_radius_meters: body.allowedRadiusMeters || 150,
            timezone: body.timezone || 'UTC',
            require_photo_proof: body.requirePhotoProof ?? true,
            require_signature: body.requireSignature ?? false,
          },
        }
      );

      if (rpcErr || !rpcData?.organization) {
        // Fallback insert
        const { data: insertedOrg, error: orgErr } = await adminClient
          .from('organizations')
          .insert({
            name,
            slug: uniqueSlug,
            subscription_tier: 'GROWTH',
            subscription_status: 'ACTIVE',
            settings: {
              allowed_radius_meters: body.allowedRadiusMeters || 150,
              timezone: body.timezone || 'UTC',
              require_photo_proof: body.requirePhotoProof ?? true,
              require_signature: body.requireSignature ?? false,
            },
          })
          .select()
          .single();

        if (orgErr || !insertedOrg) {
          return NextResponse.json(
            { success: false, error: { code: 'DATABASE_ERROR', message: orgErr?.message || 'Failed to create organization' } },
            { status: 500 }
          );
        }

        await adminClient.from('memberships').insert({
          organization_id: insertedOrg.id,
          user_id: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
        });

        return NextResponse.json({
          success: true,
          data: mapDbOrgToOrganization(insertedOrg),
        });
      }

      return NextResponse.json({
        success: true,
        data: mapDbOrgToOrganization(rpcData.organization),
      });
    }

    const now = new Date().toISOString() as IsoDateTime;
    const org: Organization = {
      id: `org_${uniqueSlug}` as TenantId,
      name,
      slug: uniqueSlug,
      subscriptionTier: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      settings: {
        allowedRadiusMeters: 150,
        timezone: 'UTC',
        requirePhotoProof: true,
        requireSignature: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({
      success: true,
      data: org,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to create organization' } },
      { status: 500 }
    );
  }
}
