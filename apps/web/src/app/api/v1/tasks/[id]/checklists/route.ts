import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { TaskChecklistItem, UUID, IsoDateTime, TaskId } from '@fieldops/types';

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
      const { data, error } = await adminClient
        .from('task_checklists')
        .select('*')
        .eq('task_id', params.id)
        .eq('organization_id', tenantId)
        .order('position', { ascending: true });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const items: TaskChecklistItem[] = (data || []).map((c: any) => ({
        id: c.id as UUID,
        taskId: c.task_id as TaskId,
        organizationId: c.organization_id,
        title: c.title,
        position: c.position,
        isRequired: c.is_required,
        isCompleted: c.is_completed,
        completedAt: c.completed_at || undefined,
        completedBy: c.completed_by || undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      return NextResponse.json({ success: true, data: items });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const title = body?.title?.trim();

    if (!title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Checklist title is required' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // 1. Verify task belongs to this organization
      const { data: task, error: taskErr } = await adminClient
        .from('tasks')
        .select('id, version')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (taskErr || !task) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 }
        );
      }

      // 2. Count existing items for position
      const { count } = await adminClient
        .from('task_checklists')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', params.id);

      const nextPosition = (count || 0) + 1;

      // 3. Insert checklist item
      const { data: newItem, error: insertErr } = await adminClient
        .from('task_checklists')
        .insert({
          task_id: params.id,
          organization_id: tenantId,
          title,
          position: nextPosition,
          is_required: body.isRequired !== false,
          is_completed: false,
        })
        .select()
        .single();

      if (insertErr || !newItem) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: insertErr?.message } },
          { status: 500 }
        );
      }

      // 4. Update task version
      await adminClient
        .from('tasks')
        .update({ version: task.version + 1, updated_at: new Date().toISOString() })
        .eq('id', params.id);

      // 5. Activity log
      await adminClient.from('task_activities').insert({
        task_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'CHECKLIST_ITEM_ADDED',
        details: { checklistId: newItem.id, title },
      });

      const responseItem: TaskChecklistItem = {
        id: newItem.id as UUID,
        taskId: newItem.task_id as TaskId,
        organizationId: newItem.organization_id,
        title: newItem.title,
        position: newItem.position,
        isRequired: newItem.is_required,
        isCompleted: newItem.is_completed,
        createdAt: newItem.created_at,
        updatedAt: newItem.updated_at,
      };

      return NextResponse.json({ success: true, data: responseItem });
    }

    const fallbackItem: TaskChecklistItem = {
      id: `chk_${Date.now()}` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      title,
      position: 1,
      isRequired: body.isRequired !== false,
      isCompleted: false,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    return NextResponse.json({ success: true, data: fallbackItem });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
