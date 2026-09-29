import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { TaskStatus } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const tasks = memoryDb.tasks.get(tenantId) || [];
  const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      rows: tasks,
      totalRows: tasks.length,
      summary: {
        totalTasks: tasks.length,
        completedTasks: completed,
        completionRatePercentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 100,
        inProgressTasks: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
        overdueTasks: 0,
        blockedTasks: tasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
      },
    },
  });
}
