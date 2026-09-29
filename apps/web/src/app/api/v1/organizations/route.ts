import { NextRequest, NextResponse } from 'next/server';
import { memoryDb } from '@/lib/server-store';
import { Organization, TenantId, IsoDateTime } from '@fieldops/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const orgs = Array.from(memoryDb.organizations.values());
  return NextResponse.json({
    success: true,
    data: orgs,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString() as IsoDateTime;
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const orgId = `org_${slug}` as TenantId;

    const org: Organization = {
      id: orgId,
      name: body.name,
      slug,
      subscriptionTier: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      settings: {
        allowedRadiusMeters: 150,
        timezone: 'UTC',
        requirePhotoProof: true,
        requireSignature: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    memoryDb.organizations.set(orgId, org);

    return NextResponse.json({
      success: true,
      data: org,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err?.message } },
      { status: 500 }
    );
  }
}
