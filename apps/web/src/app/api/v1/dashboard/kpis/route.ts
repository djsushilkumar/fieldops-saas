import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { AttendanceStatus, TaskStatus, VisitStatus } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  const tasks = memoryDb.tasks.get(tenantId) || [];
  const visits = memoryDb.visits.get(tenantId) || [];
  const attendance = memoryDb.attendance.get(tenantId) || [];

  const activeWorkers = attendance.filter((a) => a.status === AttendanceStatus.CLOCKED_IN).length;
  const pendingTasks = tasks.filter((t) => t.status === TaskStatus.ASSIGNED || t.status === TaskStatus.IN_PROGRESS).length;
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const totalVisits = visits.length;
  const completedVisits = visits.filter((v) => v.status === VisitStatus.COMPLETED).length;

  return NextResponse.json({
    success: true,
    data: {
      activeWorkers,
      pendingTasks,
      completedTasks,
      totalVisits,
      completedVisits,
      tasksToday: tasks.length,
      tasksCompletedToday: completedTasks,
      tasksOverdue: 0,
      visitsToday: totalVisits,
      visitsCompletedToday: completedVisits,
      taskCompletionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 100,
      visitAdherenceRate: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 100,
      operationalExceptions: [],
    },
  });
}
