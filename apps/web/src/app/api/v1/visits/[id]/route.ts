import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbVisitToVisit,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data: visit, error } = await adminClient
        .from('visits')
        .select('*, locations(*)')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (error || !visit) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
          { status: 404 }
        );
      }

      if (role === UserRole.FIELD_WORKER && visit.assigned_to !== user.id) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You can only view visits assigned to you' } },
          { status: 403 }
        );
      }

      const [cinRes, coutRes, prfRes] = await Promise.all([
        adminClient.from('visit_checkins').select('*').eq('visit_id', params.id).maybeSingle(),
        adminClient.from('visit_checkouts').select('*').eq('visit_id', params.id).maybeSingle(),
        adminClient.from('visit_proofs').select('*').eq('visit_id', params.id),
      ]);

      return NextResponse.json({
        success: true,
        data: mapDbVisitToVisit(
          visit,
          visit.locations,
          prfRes.data || [],
          cinRes.data,
          coutRes.data
        ),
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
    { status: 404 }
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  try {
    const body = await request.json();

    if (isSupabaseConfigured()) {
      const { data: currentVisit, error: fetchErr } = await adminClient
        .from('visits')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (fetchErr || !currentVisit) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Visit not found' } },
          { status: 404 }
        );
      }

      if (body.version !== undefined && body.version !== currentVisit.version) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: `Version conflict: client version ${body.version} does not match server version ${currentVisit.version}`,
            },
          },
          { status: 409 }
        );
      }

      const updates: Record<string, any> = {
        version: currentVisit.version + 1,
        updated_at: new Date().toISOString(),
      };

      if (body.scheduledStart !== undefined) updates.scheduled_start = body.scheduledStart;
      if (body.scheduledEnd !== undefined) updates.scheduled_end = body.scheduledEnd;
      if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo;
      if (body.notes !== undefined) updates.notes = body.notes;

      const { data: updated, error: updateErr } = await adminClient
        .from('visits')
        .update(updates)
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .select('*, locations(*)')
        .single();

      if (updateErr || !updated) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: updateErr?.message } },
          { status: 500 }
        );
      }

      await adminClient.from('visit_activities').insert({
        visit_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'VISIT_UPDATED',
        details: updates,
      });

      return NextResponse.json({
        success: true,
        data: mapDbVisitToVisit(updated, updated.locations),
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request, [
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { error } = await adminClient
        .from('visits')
        .delete()
        .eq('id', params.id)
        .eq('organization_id', tenantId);

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      await adminClient.from('visit_activities').insert({
        visit_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'VISIT_DELETED',
        details: { deletedAt: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, data: { success: true } });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: { success: true } });
}
