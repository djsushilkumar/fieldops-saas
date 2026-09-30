import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, ensureTenantSeeded } from '@/lib/server-store';
import { TenantId, TaskComment, UUID, IsoDateTime, TaskId, UserId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

const taskComments = new Map<string, TaskComment[]>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantId = (request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
  ensureTenantSeeded(tenantId);

  const comments = taskComments.get(params.id) || [
    {
      id: `comm_${params.id}_1` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      authorId: 'usr_owner' as UserId,
      author: {
        id: 'usr_owner' as UserId,
        email: 'ops@fieldops.io',
        fullName: 'Operations Dispatch',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
      },
      content: 'Standard operating procedure: ensure technician verifies client safety perimeter before commencing work.',
      createdAt: new Date(Date.now() - 3600000).toISOString() as IsoDateTime,
      updatedAt: new Date(Date.now() - 3600000).toISOString() as IsoDateTime,
    },
  ];

  return NextResponse.json({ success: true, data: comments });
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
    const existing = taskComments.get(params.id) || [];

    const newComment: TaskComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` as UUID,
      taskId: params.id as TaskId,
      organizationId: tenantId,
      authorId: 'usr_owner' as UserId,
      author: {
        id: 'usr_owner' as UserId,
        email: 'ops@fieldops.io',
        fullName: 'Operations Lead',
        timezone: 'Asia/Kolkata',
        createdAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
      },
      content: body.content || '',
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    existing.push(newComment);
    taskComments.set(params.id, existing);

    return NextResponse.json({ success: true, data: newComment });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
