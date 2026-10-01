import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { SubscriptionPlan, SubscriptionStatus, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. RBAC: Only OWNER and ADMIN can access billing overview
  const guardResult = await requireTenantContext(request, [
    UserRole.OWNER,
    UserRole.ADMIN,
  ]);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, organization } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const [
        { data: sub },
        { data: counters },
        { count: activeWorkers },
      ] = await Promise.all([
        adminClient
          .from('subscriptions')
          .select('*')
          .eq('organization_id', tenantId)
          .maybeSingle(),
        adminClient
          .from('usage_counters')
          .select('*')
          .eq('organization_id', tenantId),
        adminClient
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', tenantId)
          .eq('status', 'ACTIVE'),
      ]);

      const plan = (organization.subscriptionTier || sub?.plan || SubscriptionPlan.GROWTH) as SubscriptionPlan;
      const status = (organization.subscriptionStatus || sub?.status || SubscriptionStatus.ACTIVE) as SubscriptionStatus;

      const tasksCounter = (counters || []).find((c: any) => c.metric === 'tasks_created')?.count || 0;
      const visitsCounter = (counters || []).find((c: any) => c.metric === 'visits_recorded')?.count || 0;
      const storageCounter = (counters || []).find((c: any) => c.metric === 'storage_bytes')?.count || 0;

      return NextResponse.json({
        success: true,
        data: {
          subscription: {
            id: sub?.id || `sub_${tenantId}`,
            plan,
            status,
            currentPeriodEnd: sub?.current_period_end || new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
          },
          usage: {
            activeWorkers: activeWorkers || 1,
            tasksCreatedThisMonth: tasksCounter,
            visitsRecordedThisMonth: visitsCounter,
            storageBytesUsed: storageCounter,
          },
          quotas: {
            maxWorkers: plan === SubscriptionPlan.GROWTH ? 25 : 10,
            maxTasksPerMonth: plan === SubscriptionPlan.GROWTH ? 5000 : 500,
            maxVisitsPerMonth: plan === SubscriptionPlan.GROWTH ? 2500 : 250,
            maxStorageBytes: 5368709120,
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
      subscription: {
        id: `sub_${tenantId}`,
        plan: SubscriptionPlan.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
      },
      usage: {
        activeWorkers: 1,
        tasksCreatedThisMonth: 0,
        visitsRecordedThisMonth: 0,
        storageBytesUsed: 0,
      },
      quotas: {
        maxWorkers: 25,
        maxTasksPerMonth: 5000,
        maxVisitsPerMonth: 2500,
        maxStorageBytes: 5368709120,
      },
    },
  });
}
