import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, TaskActivity, UUID, IsoDateTime, TaskId, UserId } from '@fieldops/types';

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

  const activities: TaskActivity[] = [
    {
      id: `act_${params.id}_1` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      actorId: 'usr_owner' as UserId,
      actor: {
        id: 'usr_owner' as UserId,
        email: 'ops@fieldops.io',
        fullName: 'Operations Lead',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
      },
      action: 'TASK_CREATED',
      details: { title: task?.title || 'Operational Work Order' },
      createdAt: task?.createdAt || new Date().toISOString() as IsoDateTime,
    },
    {
      id: `act_${params.id}_2` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      actorId: (task?.assignedTo || 'usr_tech_rajesh') as UserId,
      actor: {
        id: (task?.assignedTo || 'usr_tech_rajesh') as UserId,
        email: 'field@fieldops.io',
        fullName: task?.assignedToName || 'Assigned Field Tech',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
      },
      action: `STATUS_CHANGED_${task?.status || 'IN_PROGRESS'}`,
      details: { status: task?.status || 'IN_PROGRESS' },
      createdAt: task?.updatedAt || new Date().toISOString() as IsoDateTime,
    },
  ];

  return NextResponse.json({ success: true, data: activities });
}
