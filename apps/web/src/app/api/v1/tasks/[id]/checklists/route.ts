import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, TaskChecklistItem, UUID, IsoDateTime, TaskId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = (request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
  ensureTenantSeeded(tenantId);

  const orgTasks = memoryDb.tasks.get(tenantId) || [];
  const task = orgTasks.find((t) => t.id === params.id);

  if (!task) {
    return NextResponse.json({ success: true, data: [] });
  }

  const checklists = (task.checklists || []).map((c: any) => ({
    ...c,
    isCompleted: c.isCompleted ?? c.completed ?? false,
  }));

  return NextResponse.json({ success: true, data: checklists });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    ensureTenantSeeded(tenantId);

    const body = await request.json();
    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    const index = orgTasks.findIndex((t) => t.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    const task = orgTasks[index];
    const checklists = [...(task.checklists || [])];
    const newItem: TaskChecklistItem = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      title: body.title || 'Checklist Item',
      position: checklists.length + 1,
      isRequired: body.isRequired !== false,
      isCompleted: false,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    checklists.push(newItem);
    orgTasks[index] = {
      ...task,
      checklists,
      version: task.version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    memoryDb.tasks.set(tenantId, orgTasks);

    return NextResponse.json({ success: true, data: newItem });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
