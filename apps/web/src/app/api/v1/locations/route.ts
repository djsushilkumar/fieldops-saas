import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbLocationToLocation,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { Location, LocationStatus, LocationId, TenantId, UserId, IsoDateTime, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('locations')
        .select('*')
        .eq('organization_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const locations = (data || []).map(mapDbLocationToLocation);
      return NextResponse.json({ success: true, data: locations });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(request: NextRequest) {
  const guardResult = await requireTenantContext(request, [
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
  ]);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const name = body?.name?.trim();
    const lat = Number(body?.latitude);
    const lng = Number(body?.longitude);
    const radius = Number(body?.allowedRadiusMeters || 100);

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Location name is required' } },
        { status: 400 }
      );
    }

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Latitude must be between -90 and 90' } },
        { status: 400 }
      );
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Longitude must be between -180 and 180' } },
        { status: 400 }
      );
    }

    if (isNaN(radius) || radius <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'allowedRadiusMeters must be positive' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const { data: inserted, error: insertErr } = await adminClient
        .from('locations')
        .insert({
          organization_id: tenantId,
          name,
          address: body.address || null,
          latitude: lat,
          longitude: lng,
          allowed_radius_meters: radius,
          status: LocationStatus.ACTIVE,
          created_by: user.id, // Strictly server-derived from authenticated user
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: insertErr?.message || 'Failed to create location' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbLocationToLocation(inserted),
      });
    }

    const fallbackLocation: Location = {
      id: `loc_${Date.now()}` as LocationId,
      organizationId: tenantId,
      name,
      address: body.address,
      latitude: lat,
      longitude: lng,
      allowedRadiusMeters: radius,
      status: LocationStatus.ACTIVE,
      createdBy: user.id,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    return NextResponse.json({ success: true, data: fallbackLocation });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
