import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.cookies.get('fieldops_active_org_id')?.value || 'default';
  const attendance = memoryDb.attendance.get(tenantId) || [];
  const totalDuration = attendance.reduce((sum, a) => sum + (a.durationMinutes || 0) * 60, 0);

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      rows: attendance,
      totalRows: attendance.length,
      summary: {
        totalShifts: attendance.length,
        totalDurationSeconds: totalDuration,
        totalHoursLogged: Math.round(totalDuration / 360) / 10,
        averageShiftDurationMinutes: attendance.length > 0 ? Math.round(totalDuration / attendance.length / 60) : 0,
      },
    },
  });
}
