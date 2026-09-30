import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    ensureTenantSeeded(tenantId);

    const body = await request.json();
    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    const taskIndex = orgTasks.findIndex((t) => t.id === params.id);

    if (taskIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    const task = orgTasks[taskIndex];
    const checklists = [...(task.checklists || [])];
    const itemIndex = checklists.findIndex((c: any) => c.id === params.itemId);

    if (itemIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Checklist item not found' } },
        { status: 404 }
      );
    }

    const isCompleted = body.isCompleted !== undefined ? body.isCompleted : true;
    const updatedItem = {
      ...checklists[itemIndex],
      isCompleted,
      completed: isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
    };

    checklists[itemIndex] = updatedItem;
    orgTasks[taskIndex] = {
      ...task,
      checklists,
      version: task.version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    memoryDb.tasks.set(tenantId, orgTasks);

    return NextResponse.json({ success: true, data: updatedItem });
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
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    ensureTenantSeeded(tenantId);

    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    const taskIndex = orgTasks.findIndex((t) => t.id === params.id);

    if (taskIndex === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    const task = orgTasks[taskIndex];
    const checklists = (task.checklists || []).filter((c: any) => c.id !== params.itemId);

    orgTasks[taskIndex] = {
      ...task,
      checklists,
      version: task.version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    memoryDb.tasks.set(tenantId, orgTasks);

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
