import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  mapDbAttendanceToAttendance,
} from '@/lib/supabase-server';
import { adjustAttendanceSchema } from '@fieldops/validation';
import { AttendanceRecord, AttendanceStatus, UserRole, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guard = await requireTenantContext(request, [
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]);
  if (!guard.success) {
    return guard.response;
  }

  const { tenantId, user } = guard.context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    );
  }

  const parseResult = adjustAttendanceSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid adjustment parameters',
        },
      },
      { status: 400 }
    );
  }

  const { attendanceId, checkInAt, checkOutAt, reason } = parseResult.data;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient.rpc('adjust_attendance', {
        p_attendance_id: attendanceId,
        p_admin_user_id: user.id,
        p_check_in_at: checkInAt || null,
        p_check_out_at: checkOutAt,
        p_reason: reason,
      });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 400 }
        );
      }

      // Fetch the updated attendance record
      const { data: record, error: fetchErr } = await adminClient
        .from('attendance_records')
        .select('*')
        .eq('id', attendanceId)
        .eq('organization_id', tenantId)
        .single();

      if (fetchErr || !record) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Attendance record not found after adjustment' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbAttendanceToAttendance(record),
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const now = new Date().toISOString() as IsoDateTime;
  const fallbackRecord: AttendanceRecord = {
    id: attendanceId,
    organizationId: tenantId,
    userId: user.id,
    date: now.substring(0, 10),
    status: AttendanceStatus.CORRECTED,
    checkInAt: checkInAt || now,
    checkOutAt: checkOutAt,
    isManuallyAdjusted: true,
    adjustmentReason: reason,
    adjustedByUserId: user.id,
    adjustedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ success: true, data: fallbackRecord });
}
