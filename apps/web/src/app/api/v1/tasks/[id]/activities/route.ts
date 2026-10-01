import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbProfileToUserProfile,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { TaskActivity, UUID, IsoDateTime, TaskId, UserId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data: activities, error } = await adminClient
        .from('task_activities')
        .select('*')
        .eq('task_id', params.id)
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const actorIds = (activities || []).map((a: any) => a.actor_id);
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('*')
        .in('user_id', actorIds);

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

      const result: TaskActivity[] = (activities || []).map((a: any) => {
        const prof = profileMap.get(a.actor_id);
        return {
          id: a.id as UUID,
          taskId: a.task_id as TaskId,
          organizationId: a.organization_id,
          actorId: a.actor_id as UserId,
          action: a.action,
          details: a.details || {},
          actor: prof ? mapDbProfileToUserProfile(prof) : undefined,
          createdAt: a.created_at as IsoDateTime,
        };
      });

      return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: [] });
}
