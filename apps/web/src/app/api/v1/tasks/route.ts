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
