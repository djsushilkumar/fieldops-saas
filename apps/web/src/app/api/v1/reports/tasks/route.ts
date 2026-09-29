import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      rows: [],
      summary: { total: 0, completed: 0, pending: 0 },
    },
  });
}
