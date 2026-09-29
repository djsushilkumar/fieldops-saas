import { NextRequest, NextResponse } from 'next/server';
import { memoryDb, createSessionResponse } from '@/lib/server-store';
import { TenantId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.cookies.get('fieldops_access_token')?.value;

  const orgId = (request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value) as TenantId | undefined;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      },
      { status: 401 }
    );
  }

  // Find user from memory or fallback
  let user = Array.from(memoryDb.users.values())[0];
  let org = (orgId ? memoryDb.organizations.get(orgId) : undefined) || Array.from(memoryDb.organizations.values())[0];

  if (!user || !org) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired or not found' },
      },
      { status: 401 }
    );
  }

  const session = createSessionResponse(user, org);
  return NextResponse.json({
    success: true,
    data: session,
  });
}
