import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, VisitCheckin, IsoDateTime, LocationVerificationResult } from '@fieldops/types';

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
    const orgVisits = memoryDb.visits.get(tenantId) || [];
    const index = orgVisits.findIndex((v) => v.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
        { status: 404 }
      );
    }

    const visit = orgVisits[index];
    const checkin: VisitCheckin = {
      id: `cin_${Date.now()}` as any,
      visitId: params.id as any,
      organizationId: tenantId,
      workerId: (visit.assignedTo || 'usr_tech_rajesh') as any,
      latitude: body.latitude || 28.5356,
      longitude: body.longitude || 77.2681,
      accuracyMeters: body.accuracyMeters || 10,
      clientCapturedAt: body.clientCapturedAt || new Date().toISOString() as IsoDateTime,
      serverReceivedAt: new Date().toISOString() as IsoDateTime,
      verificationResult: body.verificationResult || LocationVerificationResult.VALID,
      distanceMeters: body.distanceMeters || 15.0,
      isException: !!body.isException,
      exceptionReason: body.exceptionReason,
      createdAt: new Date().toISOString() as IsoDateTime,
    };

    orgVisits[index] = {
      ...visit,
      status: 'IN_PROGRESS' as any,
      checkin,
      version: visit.version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    memoryDb.visits.set(tenantId, orgVisits);

    return NextResponse.json({ success: true, data: checkin });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
