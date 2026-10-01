import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbAttendanceToAttendance,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { AttendanceRecord, AttendanceStatus, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get('status');
  const userIdFilter = searchParams.get('userId');
  const dateFilter = searchParams.get('date');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
  const offset = (page - 1) * pageSize;

  if (isSupabaseConfigured()) {
    try {
      let query = adminClient
        .from('attendance_records')
        .select('*', { count: 'exact' })
        .eq('organization_id', tenantId);

      // Field Worker authority boundary: only see own attendance
      if (role === UserRole.FIELD_WORKER) {
        query = query.eq('user_id', user.id);
      } else if (userIdFilter) {
        query = query.eq('user_id', userIdFilter);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }

      query = query
        .order('check_in_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data: rows, count, error } = await query;

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const userIds = (rows || []).map((r: any) => r.user_id);
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p.full_name));
      }

      const records: AttendanceRecord[] = (rows || []).map((row: any) => {
        const rec = mapDbAttendanceToAttendance(row);
        const name = profileMap.get(row.user_id);
        return name ? { ...rec, userName: name } : rec;
      });

      return NextResponse.json({
        success: true,
        data: {
          items: records,
          pagination: {
            total: count || records.length,
            page,
            pageSize,
            hasMore: (count || 0) > offset + records.length,
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
    data: { items: [], pagination: { total: 0, page: 1, pageSize: 50, hasMore: false } },
  });
}

export async function POST(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action || body?.status;

    if (action === 'CLOCK_OUT' || action === AttendanceStatus.CLOCKED_OUT) {
      // Find active record
      const { data: activeRec } = await adminClient
        .from('attendance_records')
        .select('id')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .in('status', ['CLOCKED_IN', 'CHECKED_IN'])
        .order('check_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeRec) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'No active shift found' } },
          { status: 404 }
        );
      }

      const { data: rpcResult, error: rpcErr } = await adminClient.rpc('record_attendance_checkout', {
        p_attendance_id: activeRec.id,
        p_latitude: body.latitude != null ? Number(body.latitude) : null,
        p_longitude: body.longitude != null ? Number(body.longitude) : null,
        p_accuracy_meters: body.accuracyMeters != null ? Number(body.accuracyMeters) : null,
        p_captured_at: body.clientCapturedAt || new Date().toISOString(),
        p_notes: body.notes || null,
      });

      if (rpcErr) {
        return NextResponse.json(
          { success: false, error: { code: 'CLOCK_OUT_FAILED', message: rpcErr.message } },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbAttendanceToAttendance(rpcResult),
      });
    }

    // Default: Clock-In
    const { data: rpcResult, error: rpcErr } = await adminClient.rpc('record_attendance_checkin', {
      p_organization_id: tenantId,
      p_user_id: user.id, // Strictly server-derived from authenticated session
      p_latitude: body.latitude != null ? Number(body.latitude) : null,
      p_longitude: body.longitude != null ? Number(body.longitude) : null,
      p_accuracy_meters: body.accuracyMeters != null ? Number(body.accuracyMeters) : null,
      p_captured_at: body.clientCapturedAt || new Date().toISOString(),
      p_notes: body.notes || null,
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      const isDuplicate = msg.toLowerCase().includes('already has an active');
      return NextResponse.json(
        { success: false, error: { code: isDuplicate ? 'DUPLICATE_SHIFT' : 'CLOCK_IN_FAILED', message: msg } },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapDbAttendanceToAttendance(rpcResult),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
