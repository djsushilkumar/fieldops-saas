import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionPlan, SubscriptionStatus } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      subscription: {
        id: 'sub_free',
        plan: SubscriptionPlan.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
      },
      usage: {
        activeWorkers: 3,
        tasksCreatedThisMonth: 12,
        visitsRecordedThisMonth: 8,
        storageBytesUsed: 1048576,
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
