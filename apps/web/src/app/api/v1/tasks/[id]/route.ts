import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbTaskToTask,
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
      const { data: taskRow, error: taskErr } = await adminClient
        .from('tasks')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (taskErr || !taskRow) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Task not found in this organization' } },
          { status: 404 }
        );
      }

      // Field Workers can only view their own assigned tasks
      if (role === UserRole.FIELD_WORKER && taskRow.assigned_to !== user.id) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'You can only view tasks assigned to you' } },
          { status: 403 }
        );
      }

      const { data: checklistRows } = await adminClient
        .from('task_checklists')
        .select('*')
        .eq('task_id', params.id)
        .order('position', { ascending: true });

      return NextResponse.json({
        success: true,
        data: mapDbTaskToTask(taskRow, checklistRows || []),
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
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
      // 1. Fetch current task to check version
      const { data: currentTask, error: fetchErr } = await adminClient
        .from('tasks')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (fetchErr || !currentTask) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
          { status: 404 }
        );
      }

      // Optimistic concurrency check if version passed
      if (body.version !== undefined && body.version !== currentTask.version) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TASK_CONFLICT',
              message: `Version conflict: client version ${body.version} does not match server version ${currentTask.version}`,
            },
          },
          { status: 409 }
        );
      }

      const updates: Record<string, any> = {
        version: currentTask.version + 1,
        updated_at: new Date().toISOString(),
      };

      if (body.title !== undefined) updates.title = body.title.trim();
      if (body.description !== undefined) updates.description = body.description;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo;
      if (body.locationId !== undefined) updates.location_id = body.locationId;
      if (body.dueAt !== undefined) updates.due_at = body.dueAt;

      const { data: updatedTask, error: updateErr } = await adminClient
        .from('tasks')
        .update(updates)
        .eq('id', params.id)
        .eq('organization_id', tenantId)
        .select()
        .single();

      if (updateErr || !updatedTask) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: updateErr?.message } },
          { status: 500 }
        );
      }

      await adminClient.from('task_activities').insert({
        task_id: params.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'TASK_UPDATED',
        details: updates,
      });

      const { data: checklistRows } = await adminClient
        .from('task_checklists')
        .select('*')
        .eq('task_id', params.id);

      return NextResponse.json({
        success: true,
        data: mapDbTaskToTask(updatedTask, checklistRows || []),
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
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
        .from('tasks')
        .delete()
        .eq('id', params.id)
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
        action: 'TASK_DELETED',
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
