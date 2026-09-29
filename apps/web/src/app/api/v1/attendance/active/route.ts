import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { AttendanceRecord, AttendanceStatus } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';

  const orgRecords = (memoryDb.attendance.get(tenantId) || []) as AttendanceRecord[];
  const active = orgRecords.find((r) => r.status === AttendanceStatus.CLOCKED_IN) || null;

  return NextResponse.json({
    success: true,
    data: active,
  });
}
