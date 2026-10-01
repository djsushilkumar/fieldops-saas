import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  mapDbVisitToVisit,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { Visit, VisitStatus, VisitId, TenantId, UserId, LocationId, IsoDateTime, UserRole } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guardResult = await requireTenantContext(request);
  if (!guardResult.success) {
    return guardResult.response;
  }

  const { tenantId, user, role } = guardResult.context;
  const adminClient = getSupabaseAdminClient();

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get('status');
  const assignedToFilter = searchParams.get('assignedTo');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
  const offset = (page - 1) * pageSize;

  if (isSupabaseConfigured()) {
    try {
      let query = adminClient
        .from('visits')
        .select('*, locations(*)', { count: 'exact' })
        .eq('organization_id', tenantId);

      // Field Worker authority boundary: only see own visits
      if (role === UserRole.FIELD_WORKER) {
        query = query.eq('assigned_to', user.id);
      } else if (assignedToFilter) {
        query = query.eq('assigned_to', assignedToFilter);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data: visitRows, count, error } = await query;

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const visitIds = (visitRows || []).map((v: any) => v.id);
      let checkinsMap = new Map<string, any>();
      let checkoutsMap = new Map<string, any>();
      let proofsMap = new Map<string, any[]>();

      if (visitIds.length > 0) {
        const [cinRes, coutRes, prfRes] = await Promise.all([
          adminClient.from('visit_checkins').select('*').in('visit_id', visitIds),
          adminClient.from('visit_checkouts').select('*').in('visit_id', visitIds),
          adminClient.from('visit_proofs').select('*').in('visit_id', visitIds),
        ]);

        (cinRes.data || []).forEach((cin: any) => checkinsMap.set(cin.visit_id, cin));
        (coutRes.data || []).forEach((cout: any) => checkoutsMap.set(cout.visit_id, cout));
        (prfRes.data || []).forEach((p: any) => {
          const list = proofsMap.get(p.visit_id) || [];
          list.push(p);
          proofsMap.set(p.visit_id, list);
        });
      }

      const visits = (visitRows || []).map((v: any) =>
        mapDbVisitToVisit(
          v,
          v.locations,
          proofsMap.get(v.id) || [],
          checkinsMap.get(v.id),
          checkoutsMap.get(v.id)
        )
      );

      return NextResponse.json({
        success: true,
        data: {
          items: visits,
          pagination: {
            total: count || visits.length,
            page,
            pageSize,
            hasMore: (count || 0) > offset + visits.length,
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
    data: { items: [], pagination: { total: 0, page: 1, pageSize: 50, hasMore: false } },
  });
}

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const locationId = body?.locationId;

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Location ID is required' } },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      // 1. Verify location exists and belongs to this tenant
      const { data: loc, error: locErr } = await adminClient
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (locErr || !loc) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Assigned location does not exist in this organization' } },
          { status: 404 }
        );
      }

      const { data: inserted, error: insertErr } = await adminClient
        .from('visits')
        .insert({
          organization_id: tenantId,
          location_id: locationId,
          assigned_to: body.assignedTo || null,
          status: body.status || VisitStatus.SCHEDULED,
          scheduled_start: body.scheduledStart || new Date().toISOString(),
          scheduled_end: body.scheduledEnd || null,
          notes: body.notes || null,
          version: 1,
        })
        .select('*, locations(*)')
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: insertErr?.message || 'Failed to create visit' } },
          { status: 500 }
        );
      }

      await adminClient.from('visit_activities').insert({
        visit_id: inserted.id,
        organization_id: tenantId,
        actor_id: user.id,
        action: 'VISIT_CREATED',
        details: { locationId, assignedTo: body.assignedTo },
      });

      return NextResponse.json({
        success: true,
        data: mapDbVisitToVisit(inserted, inserted.locations),
      });
    }

    const fallbackVisit: Visit = {
      id: `vis_${Date.now()}` as VisitId,
      organizationId: tenantId,
      locationId,
      createdBy: user.id,
      status: body.status || VisitStatus.SCHEDULED,
      scheduledStart: body.scheduledStart || (new Date().toISOString() as IsoDateTime),
      assignedTo: body.assignedTo,
      version: 1,
      createdAt: new Date().toISOString() as IsoDateTime,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };

    return NextResponse.json({ success: true, data: fallbackVisit });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
