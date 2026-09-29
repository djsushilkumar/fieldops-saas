import { NextRequest, NextResponse } from 'next/server';
import { signUpSchema } from '@fieldops/validation';
import {
  UserProfile,
  Organization,
  TenantId,
  UserId,
  IsoDateTime,
} from '@fieldops/types';
import { memoryDb, createSessionResponse, syncWithSupabaseAuth } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parseResult = signUpSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid signup parameters',
          },
        },
        { status: 400 }
      );
    }

    const { email, password, fullName, organizationName, organizationSlug } = parseResult.data;

    const supabaseData = await syncWithSupabaseAuth('signup', {
      email,
      password,
      data: { full_name: fullName },
    });

    const now = new Date().toISOString() as IsoDateTime;
    const userId = (supabaseData?.user?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`) as UserId;
    const safeSlug = (organizationSlug || organizationName || 'field-org').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const orgId = `org_${safeSlug}` as TenantId;

    const user: UserProfile = {
      id: userId,
      email,
      fullName,
      timezone: 'UTC',
      createdAt: now,
      updatedAt: now,
    };

    const org: Organization = {
      id: orgId,
      name: organizationName || 'My Organization',
      slug: safeSlug,
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

    memoryDb.users.set(email.toLowerCase(), user);
    memoryDb.passwords.set(email.toLowerCase(), password);
    memoryDb.organizations.set(orgId, org);

    const session = createSessionResponse(user, org);

    const response = NextResponse.json({
      success: true,
      data: session,
    });

    response.cookies.set('fieldops_access_token', session.tokens.accessToken, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 * 7,
    });

    response.cookies.set('fieldops_active_org_id', orgId, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('[Signup API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'Failed to complete registration',
        },
      },
      { status: 500 }
    );
  }
}
