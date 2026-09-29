import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Visit, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const orgVisits = memoryDb.visits.get(tenantId) || [];
  const visit = orgVisits.find((v) => v.id === params.id);

  if (!visit) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
      { status: 404 }
    );
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
