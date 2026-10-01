import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { LocationVerificationResult, VisitCheckout, IsoDateTime, UserRole } from '@fieldops/types';

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
          { success: false, error: { code: 'FORBIDDEN', message: 'You can only check out of your own assigned visits' } },
          { status: 403 }
        );
      }

      if (visit.status !== 'CHECKED_IN' && visit.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_TRANSITION',
              message: `Cannot check out of visit in status ${visit.status}. Must be CHECKED_IN or IN_PROGRESS.`,
            },
          },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const { data: cout, error: coutErr } = await adminClient
        .from('visit_checkouts')
        .insert({
          visit_id: params.id,
          organization_id: tenantId,
          worker_id: user.id, // Strictly server-derived from authenticated user
          latitude: lat,
          longitude: lng,
          accuracy_meters: accuracy,
          client_captured_at: body.clientCapturedAt || now,
          server_received_at: now,
          device_metadata: body.deviceMetadata || {},
        })
        .select()
        .single();

      if (coutErr || !cout) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: coutErr?.message || 'Failed to record checkout' } },
          { status: 500 }
        );
      }

      // Update visit status
      await adminClient
        .from('visits')
        .update({
          status: 'CHECKED_OUT',
          version: visit.version + 1,
          updated_at: now,
        })
        .eq('id', params.id);

      await adminClient.from('visit_activities').insert({
        visit_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'VISIT_CHECKED_OUT',
        details: { checkoutId: cout.id },
      });

      const checkout: VisitCheckout = {
        id: cout.id as any,
        visitId: cout.visit_id as any,
        organizationId: cout.organization_id,
        workerId: cout.worker_id,
        latitude: Number(cout.latitude),
        longitude: Number(cout.longitude),
        accuracyMeters: Number(cout.accuracy_meters),
        verificationResult: LocationVerificationResult.VALID,
        clientCapturedAt: cout.client_captured_at as IsoDateTime,
        serverReceivedAt: cout.server_received_at as IsoDateTime,
        notes: body.notes,
        createdAt: cout.created_at as IsoDateTime,
      };

      return NextResponse.json({ success: true, data: checkout });
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
