import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { VisitStatus } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const visits = memoryDb.visits.get(tenantId) || [];
  const completed = visits.filter((v) => v.status === VisitStatus.COMPLETED).length;

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      rows: visits,
      totalRows: visits.length,
      summary: {
        totalScheduled: visits.length,
        completedVisits: completed,
        onTimeCheckInRatePercentage: 100,
        geofenceVerificationRatePercentage: 100,
        missedVisits: 0,
      },
    },
  });
}
