import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbAttendanceToAttendance,
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
      const { data: rows, error } = await adminClient
        .from('attendance_records')
        .select('*')
        .eq('organization_id', tenantId)
        .order('check_in_at', { ascending: false })
        .limit(5000);

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const records = (rows || []).map((r: any) => mapDbAttendanceToAttendance(r));
      const totalDuration = records.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);

      await adminClient.from('report_audit_logs').insert({
        organization_id: tenantId,
        user_id: user.id,
        report_type: 'ATTENDANCE',
        row_count: records.length,
      });

      return NextResponse.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          rows: records,
          totalRows: records.length,
          summary: {
            totalShifts: records.length,
            totalDurationSeconds: totalDuration,
            totalHoursLogged: Math.round((totalDuration / 3600) * 10) / 10,
            averageShiftDurationMinutes: records.length > 0 ? Math.round(totalDuration / records.length / 60) : 0,
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
        totalShifts: 0,
        totalDurationSeconds: 0,
        totalHoursLogged: 0,
        averageShiftDurationMinutes: 0,
      },
    },
  });
}
