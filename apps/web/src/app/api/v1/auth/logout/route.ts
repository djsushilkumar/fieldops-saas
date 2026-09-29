import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    data: { success: true },
  });

  response.cookies.delete('fieldops_access_token');
  response.cookies.delete('fieldops_active_org_id');

  return response;
}
