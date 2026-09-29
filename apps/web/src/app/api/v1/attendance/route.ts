import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  const orgRecords = memoryDb.attendance.get(tenantId) || [];

  return NextResponse.json({
    success: true,
    data: {
      items: orgRecords,
      pagination: {
        total: orgRecords.length,
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    },
  });
}
