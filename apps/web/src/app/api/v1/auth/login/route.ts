import { NextRequest, NextResponse } from 'next/server';
import { signInSchema } from '@fieldops/validation';
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
    const parseResult = signInSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message || 'Invalid credentials',
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;
    const lowerEmail = email.toLowerCase();

    let user = memoryDb.users.get(lowerEmail);
    const storedPass = memoryDb.passwords.get(lowerEmail);

    if (user && storedPass && storedPass !== password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    if (!user) {
      const supabaseData = await syncWithSupabaseAuth('token?grant_type=password', {
        email,
        password,
      });

      const now = new Date().toISOString() as IsoDateTime;
      const userId = (supabaseData?.user?.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`) as UserId;
      user = {
        id: userId,
        email,
        fullName: supabaseData?.user?.user_metadata?.full_name || email.split('@')[0],
        timezone: 'UTC',
        createdAt: now,
        updatedAt: now,
      };
      memoryDb.users.set(lowerEmail, user);
      memoryDb.passwords.set(lowerEmail, password);
    }

    let org: Organization | undefined;
    const userMemberships = memoryDb.memberships.get(user.id);
    if (userMemberships && userMemberships.length > 0) {
      org = memoryDb.organizations.get(userMemberships[0].organizationId);
    }

    const activeOrg: Organization = org || memoryDb.organizations.get('org_default' as TenantId) || {
      id: 'org_default' as TenantId,
      name: 'Field Operations',
      slug: 'field-operations',
      subscriptionTier: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
      settings: {
        allowedRadiusMeters: 150,
        timezone: 'UTC',
        requirePhotoProof: true,
        requireSignature: false,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    memoryDb.organizations.set(activeOrg.id, activeOrg);

    const session = createSessionResponse(user, activeOrg);

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

    response.cookies.set('fieldops_active_org_id', activeOrg.id, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('[Login API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error?.message || 'Login failed',
        },
      },
      { status: 500 }
    );
  }
}
