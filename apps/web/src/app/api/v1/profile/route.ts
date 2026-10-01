import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth-guards';
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
  mapDbProfileToUserProfile,
} from '@/lib/supabase-server';
import { updateProfileSchema } from '@fieldops/validation';
import { UserProfile, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guard = await requireAuthenticatedUser(request);
  if (!guard.success) {
    return guard.response;
  }

  const { user } = guard.context;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await adminClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      if (data) {
        return NextResponse.json({
          success: true,
          data: mapDbProfileToUserProfile(data),
        });
      }
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAuthenticatedUser(request);
  if (!guard.success) {
    return guard.response;
  }

  const { user } = guard.context;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    );
  }

  const parseResult = updateProfileSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid profile fields',
        },
      },
      { status: 400 }
    );
  }

  const updates = parseResult.data;
  const adminClient = getSupabaseAdminClient();

  if (isSupabaseConfigured()) {
    try {
      const dbPayload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.fullName !== undefined) dbPayload.full_name = updates.fullName;
      if (updates.displayName !== undefined) dbPayload.display_name = updates.displayName;
      if (updates.phone !== undefined) dbPayload.phone = updates.phone;
      if (updates.timezone !== undefined) dbPayload.timezone = updates.timezone;
      if (updates.avatarUrl !== undefined) dbPayload.avatar_url = updates.avatarUrl;

      const { data, error } = await adminClient
        .from('profiles')
        .update(dbPayload)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: mapDbProfileToUserProfile(data),
      });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
        { status: 500 }
      );
    }
  }

  const updatedProfile: UserProfile = {
    ...user,
    fullName: updates.fullName || user.fullName,
    displayName: updates.displayName || user.displayName,
    phone: updates.phone || user.phone,
    timezone: updates.timezone || user.timezone,
    avatarUrl: updates.avatarUrl || user.avatarUrl,
    updatedAt: new Date().toISOString() as IsoDateTime,
  };

  return NextResponse.json({ success: true, data: updatedProfile });
}
