import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbTaskToTask,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { Task, TaskStatus, Priority, TaskId, TenantId, UserId, IsoDateTime, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Establish strict tenant security context
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get('status');
  const priorityFilter = searchParams.get('priority');
  const assignedToFilter = searchParams.get('assignedTo');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
  const offset = (page - 1) * pageSize;

  if (isSupabaseConfigured()) {
    try {
      let query = adminClient
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('organization_id', tenantId);

      // Field Workers can only view their own tasks if not manager/supervisor
      if (role === UserRole.FIELD_WORKER) {
        query = query.eq('assigned_to', user.id);
      } else if (assignedToFilter) {
        query = query.eq('assigned_to', assignedToFilter);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter) {
        query = query.eq('priority', priorityFilter);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data: taskRows, count, error } = await query;

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const taskIds = (taskRows || []).map((t: any) => t.id);
      let checklistsByTask = new Map<string, any[]>();

      if (taskIds.length > 0) {
        const { data: checklistRows } = await adminClient
          .from('task_checklists')
          .select('*')
          .in('task_id', taskIds)
          .order('position', { ascending: true });

        (checklistRows || []).forEach((c: any) => {
          const list = checklistsByTask.get(c.task_id) || [];
          list.push(c);
          checklistsByTask.set(c.task_id, list);
        });
      }

      const tasks = (taskRows || []).map((row: any) =>
        mapDbTaskToTask(row, checklistsByTask.get(row.id) || [])
      );

      return NextResponse.json({
        success: true,
        data: {
          items: tasks,
          pagination: {
            total: count || tasks.length,
            page,
            pageSize,
            hasMore: (count || 0) > offset + tasks.length,
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

  // Isolated Mock Fallback
  return NextResponse.json({
    success: true,
    data: {
      items: [],
      pagination: { total: 0, page: 1, pageSize: 50, hasMore: false },
    },
  });
}

export async function POST(request: NextRequest) {
  // 1. Authorize: FIELD_WORKER cannot create tasks
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
    const title = body?.title?.trim();

    if (!title) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Task title is required' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // 1. Insert task into tasks table
      const taskInsertPayload = {
        organization_id: tenantId,
        title,
        description: body.description || null,
        status: body.status || TaskStatus.ASSIGNED,
        priority: body.priority || Priority.MEDIUM,
        created_by: user.id, // Strictly server-derived from verified authenticated session
        assigned_to: body.assignedTo || null,
        assigned_team: body.assignedTeam || null,
        location_id: body.locationId || null,
        due_at: body.dueAt || null,
        version: 1,
      };

      const { data: insertedTask, error: taskErr } = await adminClient
        .from('tasks')
        .insert(taskInsertPayload)
        .select()
        .single();

      if (taskErr || !insertedTask) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: taskErr?.message || 'Failed to insert task' } },
          { status: 500 }
        );
      }

      // 2. Insert checklists if provided
      let createdChecklists: any[] = [];
      if (Array.isArray(body.checklists) && body.checklists.length > 0) {
        const checklistInserts = body.checklists.map((c: any, idx: number) => ({
          task_id: insertedTask.id,
          organization_id: tenantId,
          title: c.title || 'Checklist item',
          position: idx + 1,
          is_required: c.isRequired !== false,
          is_completed: false,
        }));

        const { data: insertedChecklists } = await adminClient
          .from('task_checklists')
          .insert(checklistInserts)
          .select();

        createdChecklists = insertedChecklists || [];
      }

      // 3. Append to task activities
      await adminClient.from('task_activities').insert({
        task_id: insertedTask.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'TASK_CREATED',
        details: { title: insertedTask.title, priority: insertedTask.priority },
      });

      return NextResponse.json({
        success: true,
        data: mapDbTaskToTask(insertedTask, createdChecklists),
      });
    }

    // Mock fallback
    const now = new Date().toISOString() as IsoDateTime;
    const task: Task = {
      id: `tsk_${Date.now()}` as TaskId,
      organizationId: tenantId,
      title,
      description: body.description,
      status: body.status || TaskStatus.ASSIGNED,
      priority: body.priority || Priority.MEDIUM,
      createdBy: user.id,
      assignedTo: body.assignedTo,
      dueAt: body.dueAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
      checklists: body.checklists || [],
    };

    return NextResponse.json({ success: true, data: task });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
