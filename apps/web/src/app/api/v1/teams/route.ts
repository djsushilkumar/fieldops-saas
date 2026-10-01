import { NextRequest, NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from '@/lib/supabase-server';
import { Team, TeamId, TenantId, IsoDateTime, UserRole } from '@fieldops/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100),
  description: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const guard = await requireTenantContext(request);
  if (!guard.success) {
    return guard.response;
  }

  const { tenantId } = guard.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('teams')
        .select('*')
        .eq('organization_id', tenantId)
        .order('name', { ascending: true });

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const teams: Team[] = (data || []).map((row: any) => ({
        id: row.id as TeamId,
        organizationId: row.organization_id as TenantId,
        name: row.name,
        description: row.description || undefined,
        createdAt: row.created_at as IsoDateTime,
        updatedAt: row.updated_at as IsoDateTime,
      }));

      return NextResponse.json({ success: true, data: teams });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireTenantContext(request, [
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]);
  if (!guard.success) {
    return guard.response;
  }

  const { tenantId } = guard.context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    );
  }

  const parseResult = createTeamSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid team payload',
        },
      },
      { status: 400 }
    );
  }

  const { name, description } = parseResult.data;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('teams')
        .insert({
          organization_id: tenantId,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      const created: Team = {
        id: data.id as TeamId,
        organizationId: data.organization_id as TenantId,
        name: data.name,
        description: data.description || undefined,
        createdAt: data.created_at as IsoDateTime,
        updatedAt: data.updated_at as IsoDateTime,
      };

      return NextResponse.json({ success: true, data: created });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const now = new Date().toISOString() as IsoDateTime;
  const fallbackTeam: Team = {
    id: `team_${Date.now()}` as TeamId,
    organizationId: tenantId,
    name,
    description,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json({ success: true, data: fallbackTeam });
}
