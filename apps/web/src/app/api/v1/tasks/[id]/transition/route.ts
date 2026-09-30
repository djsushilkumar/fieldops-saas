import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { Task, TaskId, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    ensureTenantSeeded(tenantId);

    const body = await request.json();
    const { status, blockedReason, reopenReason } = body;

    const orgTasks = memoryDb.tasks.get(tenantId) || [];
    const index = orgTasks.findIndex((t) => t.id === params.id);

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    const currentTask = orgTasks[index];
    const updatedTask: Task = {
      ...currentTask,
      status,
      blockedReason: status === 'BLOCKED' ? (blockedReason || 'Blocked by field condition') : undefined,
      version: currentTask.version + 1,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    orgTasks[index] = updatedTask;
    memoryDb.tasks.set(tenantId, orgTasks);

    return NextResponse.json({ success: true, data: updatedTask });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
