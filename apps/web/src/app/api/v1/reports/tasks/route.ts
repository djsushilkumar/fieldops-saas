import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbTaskToTask,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { TaskStatus, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guardResult = await requireTenantContext(request, [
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
  ]);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data: rows, error } = await adminClient
        .from('tasks')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5000); // Bounded row limit

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const tasks = (rows || []).map((r: any) => mapDbTaskToTask(r));
      const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
      const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;

      // Log report generation to report_audit_logs
      await adminClient.from('report_audit_logs').insert({
        organization_id: tenantId,
        user_id: user.id,
        report_type: 'TASKS',
        row_count: tasks.length,
      });

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
            inProgressTasks: inProgress,
            overdueTasks: 0,
            blockedTasks: blocked,
          },
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
      generatedAt: new Date().toISOString(),
      rows: [],
      totalRows: 0,
      summary: {
        totalTasks: 0,
        completedTasks: 0,
        completionRatePercentage: 100,
        inProgressTasks: 0,
        overdueTasks: 0,
        blockedTasks: 0,
      },
    },
  });
}
