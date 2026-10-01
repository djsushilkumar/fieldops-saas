import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { AttendanceShiftSummary } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireTenantContext(request);
  if (!guard.success) {
    return guard.response;
  }

  const { tenantId } = guard.context;
  const adminClient = getSupabaseAdminClient();
  const today = new Date().toISOString().substring(0, 10);

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('attendance_records')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('date', today);

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const records = data || [];
      const activeCount = records.filter(
        (r) => r.status === 'CLOCKED_IN' || r.status === 'CHECKED_IN'
      ).length;
      const completedTodayCount = records.filter(
        (r) => r.status === 'CLOCKED_OUT' || r.status === 'CHECKED_OUT' || r.status === 'CORRECTED'
      ).length;
      const totalDurationSecondsToday = records.reduce((acc, curr) => {
        return acc + Number(curr.duration_seconds || 0);
      }, 0);
      const adjustedCount = records.filter((r) => r.is_manually_adjusted).length;

      const summary: AttendanceShiftSummary = {
        activeCount,
        completedTodayCount,
        totalDurationSecondsToday,
        adjustedCount,
      };

      return NextResponse.json({ success: true, data: summary });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const fallbackSummary: AttendanceShiftSummary = {
    activeCount: 0,
    completedTodayCount: 0,
    totalDurationSecondsToday: 0,
    adjustedCount: 0,
  };

  return NextResponse.json({ success: true, data: fallbackSummary });
}
