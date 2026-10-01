import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbAttendanceToAttendance,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { AttendanceRecord, AttendanceStatus, AttendanceId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json().catch(() => ({}));
    const lat = body?.latitude != null ? Number(body.latitude) : null;
    const lng = body?.longitude != null ? Number(body.longitude) : null;
    const accuracy = body?.accuracyMeters != null ? Number(body.accuracyMeters) : null;
    const notes = body?.notes?.trim() || null;

    if (lat != null && (isNaN(lat) || lat < -90 || lat > 90)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Latitude must be between -90 and 90' } },
        { status: 400 }
      );
    }

    if (lng != null && (isNaN(lng) || lng < -180 || lng > 180)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Longitude must be between -180 and 180' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      let targetAttendanceId = body?.attendanceId;

      // If no attendanceId provided, find active record for this user in this tenant
      if (!targetAttendanceId) {
        const { data: activeRec, error: findErr } = await adminClient
          .from('attendance_records')
          .select('id')
          .eq('organization_id', tenantId)
          .eq('user_id', user.id)
          .in('status', ['CLOCKED_IN', 'CHECKED_IN'])
          .order('check_in_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findErr || !activeRec) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'No active shift found to clock out from' } },
            { status: 404 }
          );
        }

        targetAttendanceId = activeRec.id;
      }

      // Invoke Canonical Stored Procedure (record_attendance_checkout)
      const { data: rpcResult, error: rpcErr } = await adminClient.rpc(
        'record_attendance_checkout',
        {
          p_attendance_id: targetAttendanceId,
          p_latitude: lat,
          p_longitude: lng,
          p_accuracy_meters: accuracy,
          p_captured_at: body.clientCapturedAt || new Date().toISOString(),
          p_notes: notes,
        }
      );

      if (rpcErr) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CLOCK_OUT_FAILED',
              message: rpcErr.message || 'Failed to record checkout',
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbAttendanceToAttendance(rpcResult),
      });
    }

    // Fallback in test mode
    const now = new Date().toISOString() as IsoDateTime;
    const fallbackRecord: AttendanceRecord = {
      id: `att_${Date.now()}` as AttendanceId,
      organizationId: tenantId,
      userId: user.id,
      date: now.substring(0, 10),
      status: AttendanceStatus.CLOCKED_OUT,
      checkInAt: new Date(Date.now() - 3600000).toISOString() as IsoDateTime,
      checkOutAt: now,
      checkOutLatitude: lat ?? undefined,
      checkOutLongitude: lng ?? undefined,
      durationSeconds: 3600,
      isManuallyAdjusted: false,
      notes: notes || undefined,
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({ success: true, data: fallbackRecord });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
