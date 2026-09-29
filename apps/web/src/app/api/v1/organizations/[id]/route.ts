import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { TenantId } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const org = memoryDb.organizations.get(params.id as TenantId) || Array.from(memoryDb.organizations.values())[0];

  if (!org) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: org,
  });
}
