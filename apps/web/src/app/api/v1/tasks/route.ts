import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Task, TaskStatus, Priority, TaskId, TenantId, UserId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  const orgTasks = memoryDb.tasks.get(tenantId) || [];

  return NextResponse.json({
    success: true,
    data: {
      items: orgTasks,
      pagination: {
        total: orgTasks.length,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const now = new Date().toISOString() as IsoDateTime;
    const taskId = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` as TaskId;

    const task: Task = {
      id: taskId,
      organizationId: tenantId,
      title: body.title || 'Operational Task',
      description: body.description,
      status: body.status || TaskStatus.ASSIGNED,
      priority: body.priority || Priority.MEDIUM,
      createdBy: 'usr_owner' as UserId,
      dueAt: body.dueAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
      checklists: body.checklists || [],
    };

    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    orgTasks.unshift(task);
    memoryDb.tasks.set(tenantId, orgTasks);

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const id = body.id || request.nextUrl.searchParams.get('id');

    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    const index = orgTasks.findIndex((t) => t.id === id);

    let updatedTask: Task;
    if (index === -1) {
      updatedTask = {
        id: (id || `tsk_${Date.now()}`) as TaskId,
        organizationId: tenantId,
        title: body.title || 'Operational Task',
        description: body.description,
        status: body.status || TaskStatus.ASSIGNED,
        priority: body.priority || Priority.MEDIUM,
        createdBy: 'usr_owner' as UserId,
        dueAt: body.dueAt,
        version: 1,
        createdAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
        checklists: body.checklists || [],
        ...body,
      };
      orgTasks.push(updatedTask);
    } else {
      updatedTask = {
        ...orgTasks[index],
        ...body,
        version: orgTasks[index].version + 1,
        updatedAt: new Date().toISOString() as IsoDateTime,
      };
      orgTasks[index] = updatedTask;
    }
    memoryDb.tasks.set(tenantId, orgTasks);

    return NextResponse.json({
      success: true,
      data: updatedTask,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
