import { NextRequest, NextResponse } from 'next/server';
import { signUpSchema } from '@fieldops/validation';
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
    const lowerEmail = email.toLowerCase().trim();
    const adminClient = getSupabaseAdminClient();

    let user: UserProfile;
    let org: Organization;
    let membership: Membership;
    let accessToken: string;

    if (isSupabaseConfigured()) {
      // 1. Create Supabase Auth user
      const { data: authData, error: authError } = await adminClient.auth.signUp({
        email: lowerEmail,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'REGISTRATION_FAILED',
              message: authError?.message || 'Failed to create user account.',
            },
          },
          { status: 400 }
        );
      }

      const sbUser = authData.user;
      accessToken = authData.session?.access_token || '';

      // If session not returned on signup (e.g., email confirmation enabled), sign in directly
      if (!accessToken) {
        const { data: signInData } = await adminClient.auth.signInWithPassword({
          email: lowerEmail,
          password,
        });
        accessToken = signInData.session?.access_token || '';
      }

      // 2. Create Profile row
      const { data: profileRow } = await adminClient
        .from('profiles')
        .upsert(
          {
            user_id: sbUser.id,
            email: lowerEmail,
            full_name: fullName,
            timezone: 'UTC',
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      user = profileRow
        ? mapDbProfileToUserProfile(profileRow)
        : {
            id: sbUser.id as UserId,
            email: lowerEmail,
            fullName,
            timezone: 'UTC',
            createdAt: new Date().toISOString() as IsoDateTime,
            updatedAt: new Date().toISOString() as IsoDateTime,
          };

      // 3. Create Organization & Initial Owner Membership via RPC or Direct DB
      const cleanSlug = (organizationSlug || organizationName || 'field-org')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 50);

      const uniqueSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 6)}`;

      // Attempt to invoke the canonical atomic stored procedure
      const { data: rpcData, error: rpcErr } = await adminClient.rpc(
        'create_organization_with_owner',
        {
          p_name: organizationName || `${fullName}'s Organization`,
          p_slug: uniqueSlug,
          p_user_id: sbUser.id,
          p_settings: {
            allowed_radius_meters: 150,
            timezone: 'UTC',
            require_photo_proof: true,
            require_signature: false,
          },
        }
      );

      if (!rpcErr && rpcData?.organization) {
        org = mapDbOrgToOrganization(rpcData.organization);
        membership = mapDbMembershipToMembership(rpcData.membership, org, user);
      } else {
        // Fallback: direct table insert if RPC not loaded
        const { data: insertedOrg } = await adminClient
          .from('organizations')
          .insert({
            name: organizationName || `${fullName}'s Organization`,
            slug: uniqueSlug,
            subscription_tier: 'GROWTH',
            subscription_status: 'ACTIVE',
            settings: {
              allowed_radius_meters: 150,
              timezone: 'UTC',
              require_photo_proof: true,
              require_signature: false,
            },
          })
          .select()
          .single();

        org = mapDbOrgToOrganization(insertedOrg);

        const { data: insertedMem } = await adminClient
          .from('memberships')
          .insert({
            organization_id: org.id,
            user_id: user.id,
            role: 'OWNER',
            status: 'ACTIVE',
          })
          .select()
          .single();

        membership = mapDbMembershipToMembership(insertedMem, org, user);
      }
    } else {
      // Offline/Test fallback mode
      const now = new Date().toISOString() as IsoDateTime;
      const userId = `usr_${Buffer.from(lowerEmail).toString('hex').slice(0, 12)}` as UserId;
      const cleanSlug = (organizationSlug || organizationName || 'field-org')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      const orgId = `org_${cleanSlug}` as TenantId;

      user = {
        id: userId,
        email: lowerEmail,
        fullName,
        timezone: 'UTC',
        createdAt: now,
        updatedAt: now,
      };

      org = {
        id: orgId,
        name: organizationName || `${fullName}'s Organization`,
        slug: cleanSlug,
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

      membership = {
        id: 'mem_owner' as any,
        organizationId: orgId,
        userId,
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        organization: org,
        user,
      };

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
      activeMembership: membership,
      availableMemberships: [membership],
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

    response.cookies.set('fieldops_active_org_id', org.id, {
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
