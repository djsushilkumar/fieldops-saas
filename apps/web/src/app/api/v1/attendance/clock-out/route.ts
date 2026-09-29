import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { AttendanceRecord, AttendanceStatus, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const tenantId = (request.headers.get('x-tenant-id') ||
      request.cookies.get('fieldops_active_org_id')?.value || 'default') as TenantId;
    const now = new Date().toISOString() as IsoDateTime;
    const body = await request.json().catch(() => ({}));

    const records = (memoryDb.attendance.get(tenantId) || []) as AttendanceRecord[];
    const active = records.find((r) => r.status === AttendanceStatus.CLOCKED_IN);

    if (active) {
      const clockInMs = new Date(active.checkInAt).getTime();
      const durationSecs = Math.max(0, Math.floor((new Date(now).getTime() - clockInMs) / 1000));

      const updated: AttendanceRecord = {
        ...active,
        status: AttendanceStatus.CLOCKED_OUT,
        checkOutAt: now,
        checkOutLatitude: body.latitude,
        checkOutLongitude: body.longitude,
        durationSeconds: durationSecs,
        updatedAt: now,
      };

      const idx = records.indexOf(active);
      records[idx] = updated;
      memoryDb.attendance.set(tenantId, records);

      return NextResponse.json({
        success: true,
        data: updated,
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'No active shift found' } },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
