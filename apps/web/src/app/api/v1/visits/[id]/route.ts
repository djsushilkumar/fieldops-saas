import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Visit, VisitId, LocationId, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const orgVisits = memoryDb.visits.get(tenantId) || [];
  let visit = orgVisits.find((v) => v.id === params.id);

  if (!visit) {
    visit = {
      id: params.id as VisitId,
      organizationId: tenantId as TenantId,
      locationId: 'loc_default' as LocationId,
      status: 'SCHEDULED' as any,
      scheduledStart: new Date().toISOString() as IsoDateTime,
      version: 1,
      createdBy: 'usr_owner' as any,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    orgVisits.push(visit);
    memoryDb.visits.set(tenantId, orgVisits);
  }

  return NextResponse.json({ success: true, data: visit });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const orgVisits = memoryDb.visits.get(tenantId) || [];
    const index = orgVisits.findIndex((v) => v.id === params.id);

    let updatedVisit: Visit;
    if (index === -1) {
      updatedVisit = {
        id: params.id as VisitId,
        organizationId: tenantId,
        locationId: (body.locationId || 'loc_default') as LocationId,
        status: body.status || ('SCHEDULED' as any),
        scheduledStart: body.scheduledStart || (new Date().toISOString() as IsoDateTime),
        scheduledEnd: body.scheduledEnd,
        assignedTo: body.assignedTo,
        version: 1,
        createdBy: 'usr_owner' as any,
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

    return NextResponse.json({ success: true, data: updatedVisit });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const orgVisits = memoryDb.visits.get(tenantId) || [];
  const filtered = orgVisits.filter((v) => v.id !== params.id);
  memoryDb.visits.set(tenantId, filtered);

  return NextResponse.json({ success: true, data: { success: true } });
}
