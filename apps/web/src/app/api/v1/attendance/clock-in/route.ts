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
      // Invoke Canonical Stored Procedure (record_attendance_checkin)
      const { data: rpcResult, error: rpcErr } = await adminClient.rpc(
        'record_attendance_checkin',
        {
          p_organization_id: tenantId,
          p_user_id: user.id, // Strictly server-derived from authenticated user
          p_latitude: lat,
          p_longitude: lng,
          p_accuracy_meters: accuracy,
          p_captured_at: body.clientCapturedAt || new Date().toISOString(),
          p_notes: notes,
        }
      );

      if (rpcErr) {
        const msg = rpcErr.message || '';
        const isDuplicate = msg.toLowerCase().includes('already has an active');
        return NextResponse.json(
          {
            success: false,
            error: {
              code: isDuplicate ? 'DUPLICATE_SHIFT' : 'CLOCK_IN_FAILED',
              message: msg,
            },
          },
          { status: isDuplicate ? 409 : 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbAttendanceToAttendance(rpcResult),
      });
    }

    // Fallback in isolated mock/test mode
    const now = new Date().toISOString() as IsoDateTime;
    const fallbackRecord: AttendanceRecord = {
      id: `att_${Date.now()}` as AttendanceId,
      organizationId: tenantId,
      userId: user.id,
      date: now.substring(0, 10),
      status: AttendanceStatus.CLOCKED_IN,
      checkInAt: now,
      checkInLatitude: lat ?? undefined,
      checkInLongitude: lng ?? undefined,
      checkInAccuracyMeters: accuracy ?? undefined,
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
