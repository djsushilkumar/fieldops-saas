import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Task, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const orgTasks = memoryDb.tasks.get(tenantId) || [];
  const task = orgTasks.find((t) => t.id === params.id);

  if (!task) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      { status: 404 }
    );
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

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
        { status: 404 }
      );
    }

    const updatedTask: Task = {
      ...orgTasks[index],
      ...body,
      version: orgTasks[index].version + 1,
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
