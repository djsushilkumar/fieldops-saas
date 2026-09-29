import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Visit, VisitStatus, VisitId, TenantId, UserId, LocationId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  const orgVisits = memoryDb.visits.get(tenantId) || [];

  return NextResponse.json({
    success: true,
    data: {
      items: orgVisits,
      pagination: {
        total: orgVisits.length,
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
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
        { status: 404 }
      );
    }

    const updatedVisit: Visit = {
      ...orgVisits[index],
      ...body,
      version: orgVisits[index].version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    orgVisits[index] = updatedVisit;
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
