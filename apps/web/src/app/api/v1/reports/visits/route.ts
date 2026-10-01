import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbVisitToVisit,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { VisitStatus, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  if (isSupabaseConfigured()) {
    try {
      const { data: rows, error } = await adminClient
        .from('visits')
        .select('*, locations(*)')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const visits = (rows || []).map((v: any) => mapDbVisitToVisit(v, v.locations));
      const completed = visits.filter((v) => v.status === VisitStatus.COMPLETED).length;

      await adminClient.from('report_audit_logs').insert({
        organization_id: tenantId,
        user_id: user.id,
        report_type: 'VISITS',
        row_count: visits.length,
      });

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
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      rows: [],
      totalRows: 0,
      summary: {
        totalScheduled: 0,
        completedVisits: 0,
        onTimeCheckInRatePercentage: 100,
        geofenceVerificationRatePercentage: 100,
        missedVisits: 0,
      },
    },
  });
}
