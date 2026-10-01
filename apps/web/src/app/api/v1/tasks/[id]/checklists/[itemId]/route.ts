import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { TaskChecklistItem, UUID, IsoDateTime, TaskId, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  try {
    const body = await request.json();
    const isCompleted = body.isCompleted !== undefined ? Boolean(body.isCompleted) : true;

    if (isSupabaseConfigured()) {
      // 1. Fetch task to verify tenant and assignment
      const { data: task, error: taskErr } = await adminClient
        .from('tasks')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (taskErr || !task) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 }
        );
      }

      if (role === UserRole.FIELD_WORKER && task.assigned_to !== user.id) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Field workers can only update checklists on their own tasks' } },
          { status: 403 }
        );
      }

      // 2. Update checklist item
      const now = new Date().toISOString();
      const { data: updatedItem, error: updateErr } = await adminClient
        .from('task_checklists')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? now : null,
          completed_by: isCompleted ? user.id : null,
          updated_at: now,
        })
        .eq('id', params.itemId)
        .eq('task_id', params.id)
        .eq('organization_id', tenantId)
        .select()
        .single();

      if (updateErr || !updatedItem) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Checklist item not found' } },
          { status: 404 }
        );
      }

      // 3. Update task version
      await adminClient
        .from('tasks')
        .update({ version: task.version + 1, updated_at: now })
        .eq('id', params.id);

      // 4. Activity log
      await adminClient.from('task_activities').insert({
        task_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: isCompleted ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_UNCHECKED',
        details: { checklistId: params.itemId, title: updatedItem.title },
      });

      const responseItem: TaskChecklistItem = {
        id: updatedItem.id as UUID,
        taskId: updatedItem.task_id as TaskId,
        organizationId: updatedItem.organization_id,
        title: updatedItem.title,
        position: updatedItem.position,
        isRequired: updatedItem.is_required,
        isCompleted: updatedItem.is_completed,
        completedAt: updatedItem.completed_at || undefined,
        completedBy: updatedItem.completed_by || undefined,
        createdAt: updatedItem.created_at,
        updatedAt: updatedItem.updated_at,
      };

      return NextResponse.json({ success: true, data: responseItem });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Checklist item not found' } },
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
  { params }: { params: { id: string; itemId: string } }
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

  if (isSupabaseConfigured()) {
    try {
      const { error } = await adminClient
        .from('task_checklists')
        .delete()
        .eq('id', params.itemId)
        .eq('task_id', params.id)
        .eq('organization_id', tenantId);

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      await adminClient.from('task_activities').insert({
        task_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'CHECKLIST_ITEM_DELETED',
        details: { checklistId: params.itemId },
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
