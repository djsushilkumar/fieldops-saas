import { NextRequest, NextResponse } from 'next/server';
import { extractAccessToken } from '@/lib/auth-guards';
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = extractAccessToken(request);

  if (token && isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdminClient();
      await admin.auth.admin.signOut(token);
    } catch {
      // Ignore signOut errors on token revocation
    }
  }

  const response = NextResponse.json({
    success: true,
    data: { success: true },
  });

  response.cookies.delete('fieldops_access_token');
  response.cookies.delete('fieldops_active_org_id');

  return response;
}
