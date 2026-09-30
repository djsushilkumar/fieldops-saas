import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, VisitActivity, UUID, IsoDateTime, VisitId, UserId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = (request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
  ensureTenantSeeded(tenantId);

  const orgVisits = memoryDb.visits.get(tenantId) || [];
  const visit = orgVisits.find((v) => v.id === params.id);

  const activities: VisitActivity[] = [
    {
      id: `act_vis_${params.id}_1` as UUID,
      visitId: params.id as VisitId,
      organizationId: tenantId,
      actorId: 'usr_owner' as UserId,
      action: 'VISIT_SCHEDULED',
      details: { scheduledStart: visit?.scheduledStart },
      createdAt: visit?.createdAt || new Date().toISOString() as IsoDateTime,
    },
  ];

  if (visit?.checkin) {
    activities.push({
      id: `act_vis_${params.id}_2` as UUID,
      visitId: params.id as VisitId,
      organizationId: tenantId,
      actorId: (visit.assignedTo || 'usr_tech_rajesh') as UserId,
      action: 'VISIT_CHECKED_IN',
      details: {
        distanceMeters: visit.checkin.distanceMeters,
        verificationResult: visit.checkin.verificationResult,
      },
      createdAt: (visit.checkin as any).capturedAt || (visit.checkin as any).clientCapturedAt || new Date().toISOString() as IsoDateTime,
    });
  }

  if (visit?.checkout) {
    activities.push({
      id: `act_vis_${params.id}_3` as UUID,
      visitId: params.id as VisitId,
      organizationId: tenantId,
      actorId: (visit.assignedTo || 'usr_tech_rajesh') as UserId,
      action: 'VISIT_CHECKED_OUT',
      details: { notes: visit.checkout.notes },
      createdAt: (visit.checkout as any).capturedAt || (visit.checkout as any).clientCapturedAt || new Date().toISOString() as IsoDateTime,
    });
  }

  return NextResponse.json({ success: true, data: activities });
}
