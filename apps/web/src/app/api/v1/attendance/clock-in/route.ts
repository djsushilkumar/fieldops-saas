import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { AttendanceRecord, AttendanceStatus, AttendanceId, TenantId, UserId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const now = new Date().toISOString() as IsoDateTime;
    const dateStr = now.substring(0, 10);
    const body = await request.json().catch(() => ({}));
    const recordId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` as AttendanceId;

    const record: AttendanceRecord = {
      id: recordId,
      organizationId: tenantId,
      userId: 'usr_owner' as UserId,
      date: dateStr,
      status: AttendanceStatus.CLOCKED_IN,
      checkInAt: now,
      checkInLatitude: body.latitude || 19.076,
      checkInLongitude: body.longitude || 72.8777,
      checkInAccuracyMeters: 10,
      isManuallyAdjusted: false,
      createdAt: now,
      updatedAt: now,
    };

    const records = memoryDb.attendance.get(tenantId) || [];
    records.unshift(record);
    memoryDb.attendance.set(tenantId, records);

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
