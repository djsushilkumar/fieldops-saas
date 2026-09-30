import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { Visit, VisitStatus, VisitId, TenantId, UserId, LocationId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  ensureTenantSeeded(tenantId);
  const orgVisits = memoryDb.visits.get(tenantId) || [];
  const orgLocations = memoryDb.locations.get(tenantId) || [];

  const populatedVisits = orgVisits.map((v) => ({
    ...v,
    location: v.location || orgLocations.find((l) => l.id === v.locationId) || {
      id: v.locationId,
      name: 'Client Site',
      address: 'On-site authorized facility',
      latitude: 28.5355,
      longitude: 77.2680,
      allowedRadiusMeters: 100,
    },
  }));

  return NextResponse.json({
    success: true,
    data: {
      items: populatedVisits,
      pagination: {
        total: populatedVisits.length,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const now = new Date().toISOString() as IsoDateTime;
    const visitId = `vis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` as VisitId;

    const visit: Visit = {
      id: visitId,
      organizationId: tenantId,
      locationId: (body.locationId || 'loc_default') as LocationId,
      status: body.status || VisitStatus.SCHEDULED,
      scheduledStart: body.scheduledStart || body.scheduledStartTime || now,
      scheduledEnd: body.scheduledEnd || body.scheduledEndTime,
      assignedTo: body.assignedTo as UserId | undefined,
      version: 1,
      createdBy: 'usr_owner' as UserId,
      createdAt: now,
      updatedAt: now,
    };

    const orgVisits = memoryDb.visits.get(tenantId) || [];
    orgVisits.unshift(visit);
    memoryDb.visits.set(tenantId, orgVisits);

    return NextResponse.json({
      success: true,
      data: visit,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');

    const orgVisits = memoryDb.visits.get(tenantId) || [];
    const index = orgVisits.findIndex((v) => v.id === id);

    let updatedVisit: Visit;
    if (index === -1) {
      updatedVisit = {
        id: (id || `vis_${Date.now()}`) as VisitId,
        organizationId: tenantId,
        locationId: (body.locationId || 'loc_default') as LocationId,
        status: body.status || VisitStatus.SCHEDULED,
        scheduledStart: body.scheduledStart || (new Date().toISOString() as IsoDateTime),
        scheduledEnd: body.scheduledEnd,
        assignedTo: body.assignedTo,
        version: 1,
        createdBy: 'usr_owner' as UserId,
        createdAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
        ...body,
      };
      orgVisits.push(updatedVisit);
    } else {
      updatedVisit = {
        ...orgVisits[index],
        ...body,
        version: orgVisits[index].version + 1,
        updatedAt: new Date().toISOString() as IsoDateTime,
      };
      orgVisits[index] = updatedVisit;
    }
    memoryDb.visits.set(tenantId, orgVisits);

    return NextResponse.json({
      success: true,
      data: updatedVisit,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
