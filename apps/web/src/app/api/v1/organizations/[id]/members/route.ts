import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Membership } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const allMemberships: Membership[] = [];
  for (const members of memoryDb.memberships.values()) {
    for (const m of members) {
      if (m.organizationId === params.id) {
        allMemberships.push(m);
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: allMemberships,
  });
}
