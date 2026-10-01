import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const today = new Date().toISOString().substring(0, 10);

      // Concurrent queries scoped strictly to tenantId
      const [
        { count: activeWorkers },
        { count: pendingTasks },
        { count: completedTasks },
        { count: totalTasks },
        { count: overdueTasks },
        { count: totalVisits },
        { count: completedVisits },
      ] = await Promise.all([
        adminClient
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .eq('status', 'CLOCKED_IN'),
        adminClient
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .in('status', ['ASSIGNED', 'IN_PROGRESS']),
        adminClient
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .eq('status', 'COMPLETED'),
        adminClient
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId),
        adminClient
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .neq('status', 'COMPLETED')
          .neq('status', 'CANCELED')
          .lt('due_at', new Date().toISOString()),
        adminClient
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId),
        adminClient
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .eq('status', 'COMPLETED'),
      ]);

      const tTotal = totalTasks || 0;
      const tCompleted = completedTasks || 0;
      const vTotal = totalVisits || 0;
      const vCompleted = completedVisits || 0;

      return NextResponse.json({
        success: true,
        data: {
          activeWorkers: activeWorkers || 0,
          pendingTasks: pendingTasks || 0,
          completedTasks: tCompleted,
          totalVisits: vTotal,
          completedVisits: vCompleted,
          tasksToday: tTotal,
          tasksCompletedToday: tCompleted,
          tasksOverdue: overdueTasks || 0,
          visitsToday: vTotal,
          visitsCompletedToday: vCompleted,
          taskCompletionRate: tTotal > 0 ? Math.round((tCompleted / tTotal) * 100) : 100,
          visitAdherenceRate: vTotal > 0 ? Math.round((vCompleted / vTotal) * 100) : 100,
          operationalExceptions: [],
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      activeWorkers: 0,
      pendingTasks: 0,
      completedTasks: 0,
      totalVisits: 0,
      completedVisits: 0,
      tasksToday: 0,
      tasksCompletedToday: 0,
      tasksOverdue: 0,
      visitsToday: 0,
      visitsCompletedToday: 0,
      taskCompletionRate: 100,
      visitAdherenceRate: 100,
      operationalExceptions: [],
    },
  });
}
