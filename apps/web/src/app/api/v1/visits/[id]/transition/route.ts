import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbVisitToVisit,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { VisitStatus, UserRole } from '@fieldops/types';

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
    const targetStatus = body.status as VisitStatus;
    const cancelReason = body.cancelReason?.trim();

    if (!targetStatus) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Target status is required' } },
        { status: 400 }
      );
    }

    if (targetStatus === VisitStatus.CANCELED && role === UserRole.FIELD_WORKER) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Field workers cannot cancel visits' } },
        { status: 403 }
      );
    }

    if (isSupabaseConfigured()) {
      // 1. Fetch visit
      const { data: visit, error: fetchErr } = await adminClient
        .from('visits')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (fetchErr || !visit) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
          { status: 404 }
        );
      }

      // 2. Invoke RPC or update table
      const { data: rpcResult, error: rpcErr } = await adminClient.rpc('transition_visit_status', {
        p_visit_id: params.id,
        p_target_status: targetStatus,
        p_actor_id: user.id,
        p_cancel_reason: cancelReason || null,
      });

      let updatedRow = rpcResult;
      if (rpcErr || !updatedRow) {
        const { data: directUpdated, error: directErr } = await adminClient
          .from('visits')
          .update({
            status: targetStatus,
            version: visit.version + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)
          .select('*, locations(*)')
          .single();

        if (directErr || !directUpdated) {
          return NextResponse.json(
            { success: false, error: { code: 'TRANSITION_ERROR', message: directErr?.message || rpcErr?.message } },
            { status: 400 }
          );
        }

        updatedRow = directUpdated;
      }

      await adminClient.from('visit_activities').insert({
        visit_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: `VISIT_STATUS_${targetStatus}`,
        details: { targetStatus, cancelReason },
      });

      return NextResponse.json({
        success: true,
        data: mapDbVisitToVisit(updatedRow, updatedRow.locations),
      });
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
