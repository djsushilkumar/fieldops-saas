import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbAttendanceToAttendance,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      // Find the calling user's active shift strictly scoped to this tenant and user.id
      const { data, error } = await adminClient
        .from('attendance_records')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .in('status', ['CLOCKED_IN', 'CHECKED_IN'])
        .order('check_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data ? mapDbAttendanceToAttendance(data) : null,
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: null });
}
