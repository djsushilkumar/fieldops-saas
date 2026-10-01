import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbProfileToUserProfile,
  mapDbMembershipToMembership,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { UserRole } from '@fieldops/types';

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
      const [
        { data: memRows },
        { count: clockedInCount },
      ] = await Promise.all([
        adminClient
          .from('memberships')
          .select('*')
          .eq('organization_id', tenantId)
          .eq('status', 'ACTIVE')
          .limit(5000),
        adminClient
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .eq('status', 'CLOCKED_IN'),
      ]);

      const userIds = (memRows || []).map((m: any) => m.user_id);
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('*')
          .in('user_id', userIds);

        (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));
      }

      const rows = (memRows || []).map((m: any) => {
        const prof = profileMap.get(m.user_id);
        return mapDbMembershipToMembership(m, undefined, prof ? mapDbProfileToUserProfile(prof) : undefined);
      });

      await adminClient.from('report_audit_logs').insert({
        organization_id: tenantId,
        user_id: user.id,
        report_type: 'WORKFORCE',
        row_count: rows.length,
      });

      return NextResponse.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          rows,
          totalRows: rows.length,
          summary: {
            totalWorkers: rows.length,
            activeNow: clockedInCount || 0,
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
      summary: { totalWorkers: 0, activeNow: 0 },
    },
  });
}
