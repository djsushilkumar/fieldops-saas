import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Location, LocationStatus, LocationId, TenantId, UserId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  const orgLocations = memoryDb.locations.get(tenantId) || [];

  return NextResponse.json({
    success: true,
    data: orgLocations,
  });
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const now = new Date().toISOString() as IsoDateTime;
    const locationId = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` as LocationId;

    const location: Location = {
      id: locationId,
      organizationId: tenantId,
      name: body.name || 'Site Location',
      address: body.address,
      latitude: body.latitude || 19.076,
      longitude: body.longitude || 72.8777,
      allowedRadiusMeters: body.allowedRadiusMeters || 150,
      status: LocationStatus.ACTIVE,
      createdBy: 'usr_owner' as UserId,
      createdAt: now,
      updatedAt: now,
    };

    const orgLocations = memoryDb.locations.get(tenantId) || [];
    orgLocations.unshift(location);
    memoryDb.locations.set(tenantId, orgLocations);

    return NextResponse.json({
      success: true,
      data: location,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
