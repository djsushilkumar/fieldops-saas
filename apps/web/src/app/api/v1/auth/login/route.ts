import { NextRequest, NextResponse } from 'next/server';
import { signInSchema } from '@fieldops/validation';
import {
  UserProfile,
  Organization,
  Membership,
  AuthSession,
  IsoDateTime,
  UserId,
  TenantId,
  UserRole,
  MembershipStatus,
} from '@fieldops/types';
import {
  getSupabaseAdminClient,
  mapDbProfileToUserProfile,
  mapDbOrgToOrganization,
  mapDbMembershipToMembership,
  isSupabaseConfigured,
} from '@/lib/supabase-server';

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
            message: parseResult.error.errors[0]?.message || 'Invalid credentials format',
          },
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;
    const lowerEmail = email.toLowerCase().trim();
    const adminClient = getSupabaseAdminClient();

    let user: UserProfile;
    let accessToken: string;
    let memberships: Membership[] = [];
    let activeMembership: Membership | undefined;

    if (isSupabaseConfigured()) {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
        email: lowerEmail,
        password,
      });

      if (authError || !authData.session || !authData.user) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: authError?.message || 'Invalid email or password',
            },
          },
          { status: 401 }
        );
      }

      accessToken = authData.session.access_token;
      const sbUser = authData.user;

      // 2. Fetch Profile from profiles table
      const { data: profileRow } = await adminClient
        .from('profiles')
        .select('*')
        .eq('user_id', sbUser.id)
        .maybeSingle();

      if (profileRow) {
        user = mapDbProfileToUserProfile(profileRow);
      } else {
        const { data: newProfile } = await adminClient
          .from('profiles')
          .insert({
            user_id: sbUser.id,
            email: lowerEmail,
            full_name: sbUser.user_metadata?.full_name || lowerEmail.split('@')[0],
            timezone: 'UTC',
          })
          .select()
          .single();

        user = newProfile
          ? mapDbProfileToUserProfile(newProfile)
          : {
              id: sbUser.id as UserId,
              email: lowerEmail,
              fullName: sbUser.user_metadata?.full_name || lowerEmail.split('@')[0],
              timezone: 'UTC',
              createdAt: new Date().toISOString() as IsoDateTime,
              updatedAt: new Date().toISOString() as IsoDateTime,
            };
      }

      // 3. Fetch user's active memberships
      const { data: memRows } = await adminClient
        .from('memberships')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          status,
          created_at,
          updated_at,
          organizations (*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE');

      if (memRows && memRows.length > 0) {
        memberships = memRows.map((row: any) => {
          const org = row.organizations ? mapDbOrgToOrganization(row.organizations) : undefined;
          return mapDbMembershipToMembership(row, org, user);
        });
        activeMembership = memberships[0];
      }
    } else {
      // Offline/Test fallback mode
      const now = new Date().toISOString() as IsoDateTime;
      const userId = `usr_${Buffer.from(lowerEmail).toString('hex').slice(0, 12)}` as UserId;
      const orgId = 'org_default' as TenantId;

      user = {
        id: userId,
        email: lowerEmail,
        fullName: lowerEmail.split('@')[0],
        timezone: 'UTC',
        createdAt: now,
        updatedAt: now,
      };

      const mockOrg: Organization = {
        id: orgId,
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
        createdAt: now,
        updatedAt: now,
      };

      const mockMem: Membership = {
        id: 'mem_default' as any,
        organizationId: orgId,
        userId,
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        organization: mockOrg,
        user,
      };

      memberships = [mockMem];
      activeMembership = mockMem;
      accessToken = `fo_jwt_${Buffer.from(
        JSON.stringify({
          sub: userId,
          email: lowerEmail,
          tenant_id: orgId,
          role: UserRole.OWNER,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400 * 7,
        })
      ).toString('base64url')}`;
    }

    const session: AuthSession = {
      user,
      tokens: {
        accessToken,
        expiresIn: 604800,
        tokenType: 'Bearer',
      },
      activeMembership: activeMembership || undefined,
      availableMemberships: memberships,
    };

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

    if (activeMembership) {
      response.cookies.set('fieldops_active_org_id', activeMembership.organizationId, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400 * 7,
      });
    }

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
