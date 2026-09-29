import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Task, TaskId, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const orgTasks = memoryDb.tasks.get(tenantId) || [];
  let task = orgTasks.find((t) => t.id === params.id);

  if (!task) {
    task = {
      id: params.id as TaskId,
      organizationId: tenantId as TenantId,
      title: 'Operational Task',
      status: 'ASSIGNED' as any,
      priority: 'MEDIUM' as any,
      createdBy: 'usr_owner' as any,
      version: 1,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
      checklists: [],
    };
    orgTasks.push(task);
    memoryDb.tasks.set(tenantId, orgTasks);
  }

  return NextResponse.json({ success: true, data: task });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const body = await request.json();
    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    const index = orgTasks.findIndex((t) => t.id === params.id);

    let updatedTask: Task;
    if (index === -1) {
      updatedTask = {
        id: params.id as TaskId,
        organizationId: tenantId,
        title: body.title || 'Operational Task',
        description: body.description,
        status: body.status || ('ASSIGNED' as any),
        priority: body.priority || ('MEDIUM' as any),
        createdBy: 'usr_owner' as any,
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

    return NextResponse.json({ success: true, data: updatedTask });
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
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const orgTasks = memoryDb.tasks.get(tenantId) || [];
  const filtered = orgTasks.filter((t) => t.id !== params.id);
  memoryDb.tasks.set(tenantId, filtered);

  return NextResponse.json({ success: true, data: { success: true } });
}
