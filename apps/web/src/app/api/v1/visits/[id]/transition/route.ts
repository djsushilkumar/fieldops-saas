import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { Visit, VisitId, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    ensureTenantSeeded(tenantId);

    const body = await request.json();
    const { status, cancelReason } = body;

    const orgVisits = memoryDb.visits.get(tenantId) || [];
    const index = orgVisits.findIndex((v) => v.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
        { status: 404 }
      );
    }

    const currentVisit = orgVisits[index];
    const updatedVisit: Visit = {
      ...currentVisit,
      status,
      version: currentVisit.version + 1,
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
