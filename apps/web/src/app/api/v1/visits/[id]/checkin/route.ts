import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { LocationVerificationResult, VisitCheckin, IsoDateTime, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const lat = Number(body?.latitude);
    const lng = Number(body?.longitude);
    const accuracy = Number(body?.accuracyMeters || 10.0);
    const exceptionReason = body?.exceptionReason?.trim() || null;

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Latitude must be between -90 and 90' } },
        { status: 400 }
      );
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Longitude must be between -180 and 180' } },
        { status: 400 }
      );
    }

    if (isNaN(accuracy) || accuracy <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Accuracy must be positive' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // 1. Verify visit belongs to this organization
      const { data: visit, error: visitErr } = await adminClient
        .from('visits')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (visitErr || !visit) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
          { status: 404 }
        );
      }

      if (role === UserRole.FIELD_WORKER && visit.assigned_to !== user.id) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You can only check into your own assigned visits' } },
          { status: 403 }
        );
      }

      // 2. Invoke Canonical Stored Procedure
      const { data: rpcResult, error: rpcErr } = await adminClient.rpc('record_visit_checkin', {
        p_visit_id: params.id,
        p_worker_id: user.id, // Strictly server-derived from authenticated session
        p_latitude: lat,
        p_longitude: lng,
        p_accuracy: accuracy,
        p_client_captured_at: body.clientCapturedAt || new Date().toISOString(),
        p_exception_reason: exceptionReason,
        p_device_metadata: body.deviceMetadata || {},
      });

      if (rpcErr) {
        const msg = rpcErr.message || '';
        let status = 400;
        let code = 'CHECKIN_ERROR';

        if (msg.includes('VISIT_NOT_FOUND')) {
          status = 404;
          code = 'NOT_FOUND';
        } else if (msg.includes('GEOFENCE_EXCEPTION')) {
          status = 400;
          code = 'GEOFENCE_EXCEPTION';
        } else if (msg.includes('VISIT_INVALID_STATUS_TRANSITION')) {
          status = 400;
          code = 'INVALID_TRANSITION';
        }

        return NextResponse.json(
          { success: false, error: { code, message: msg } },
          { status }
        );
      }

      const checkin: VisitCheckin = {
        id: rpcResult.id as any,
        visitId: rpcResult.visit_id as any,
        organizationId: rpcResult.organization_id,
        workerId: rpcResult.worker_id,
        latitude: Number(rpcResult.latitude),
        longitude: Number(rpcResult.longitude),
        accuracyMeters: Number(rpcResult.accuracy_meters),
        distanceMeters: Number(rpcResult.distance_meters || 0),
        verificationResult: rpcResult.verification_result as LocationVerificationResult,
        isException: Boolean(rpcResult.is_exception),
        exceptionReason: rpcResult.exception_reason || undefined,
        clientCapturedAt: rpcResult.client_captured_at as IsoDateTime,
        serverReceivedAt: rpcResult.server_received_at as IsoDateTime,
        deviceMetadata: rpcResult.device_metadata,
        createdAt: rpcResult.created_at as IsoDateTime,
      };

      return NextResponse.json({ success: true, data: checkin });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
