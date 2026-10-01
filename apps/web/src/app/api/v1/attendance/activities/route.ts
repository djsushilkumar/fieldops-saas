import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import {
  WorkerActivity,
  WorkerActivityType,
  UUID,
  TenantId,
  UserId,
  IsoDateTime,
} from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireTenantContext(request);
  if (!guard.success) {
    return guard.response;
  }

  const { tenantId } = guard.context;
  const adminClient = getSupabaseAdminClient();

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

  if (isSupabaseConfigured()) {
    try {
      let query = adminClient
        .from('worker_activities')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const activities: WorkerActivity[] = (data || []).map((row: any) => ({
        id: row.id as UUID,
        organizationId: row.organization_id as TenantId,
        userId: row.user_id as UserId,
        activityType: row.activity_type as WorkerActivityType,
        title: row.title,
        description: row.description || undefined,
        metadata: row.metadata || {},
        createdAt: row.created_at as IsoDateTime,
      }));

      return NextResponse.json({ success: true, data: activities });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: [] });
}
