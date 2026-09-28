import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  AuthService,
  OrganizationService,
  MembershipService,
  ProfileService,
} from '../src/index';
import {
  UserRole,
  MembershipStatus,
  InvitationStatus,
  TenantId,
  UserId,
  UUID,
  IsoDateTime,
} from '@fieldops/types';

describe('Phase 03 API Domain Services', () => {
  const mockSession = {
    user: {
      id: 'usr_1' as UserId,
      email: 'alice@demo.io',
      fullName: 'Alice Smith',
      timezone: 'UTC',
      createdAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
    },
    tokens: {
      accessToken: 'jwt_mock_token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    },
    availableMemberships: [],
  };

  it('AuthService calls login endpoint and returns session', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockSession,
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const authService = new AuthService(client);

    const session = await authService.signIn({
      email: 'alice@demo.io',
      password: 'Password123!',
    });

    expect(session.user.email).toBe('alice@demo.io');
    expect(customFetch).toHaveBeenCalledTimes(1);
    const calledUrl = customFetch.mock.calls[0][0];
    expect(calledUrl).toContain('/api/v1/auth/login');
  });

  it('OrganizationService creates tenant and owner membership', async () => {
    const orgPayload = {
      name: 'Apex Field Co',
      slug: 'apex-field',
    };
    const mockCreated = {
      organization: {
        id: 'org_1' as TenantId,
        name: 'Apex Field Co',
        slug: 'apex-field',
        subscriptionTier: 'TRIAL',
        subscriptionStatus: 'ACTIVE',
        settings: { allowedRadiusMeters: 100, timezone: 'UTC' },
        createdAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
      },
      membership: {
        id: 'mem_1' as UUID,
        organizationId: 'org_1' as TenantId,
        userId: 'usr_1' as UserId,
        role: UserRole.OWNER,
        status: MembershipStatus.ACTIVE,
        createdAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
        updatedAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
      },
    };

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: mockCreated,
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const orgService = new OrganizationService(client);

    const result = await orgService.createOrganization(orgPayload);
    expect(result.organization.name).toBe('Apex Field Co');
    expect(result.membership.role).toBe(UserRole.OWNER);
  });

  it('MembershipService invites member and propagates tenant header', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          id: 'inv_1' as UUID,
          organizationId: tenantId,
          email: 'worker@demo.io',
          role: UserRole.FIELD_WORKER,
          status: InvitationStatus.PENDING,
          expiresAt: '2026-10-05T00:00:00.000Z' as IsoDateTime,
          createdBy: 'usr_1' as UserId,
          createdAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
          updatedAt: '2026-09-28T00:00:00.000Z' as IsoDateTime,
        },
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getTenantId: () => tenantId,
      customFetch: customFetch as unknown as typeof fetch,
    });
    const memberService = new MembershipService(client);

    const invitation = await memberService.inviteMember(tenantId, {
      email: 'worker@demo.io',
      role: UserRole.FIELD_WORKER,
    });

    expect(invitation.email).toBe('worker@demo.io');
    expect(invitation.role).toBe(UserRole.FIELD_WORKER);
    const headers = customFetch.mock.calls[0][1].headers;
    expect(headers['x-tenant-id']).toBe(tenantId);
  });

  it('ProfileService fetches user profile', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockSession.user,
      }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      customFetch: customFetch as unknown as typeof fetch,
    });
    const profileService = new ProfileService(client);

    const profile = await profileService.getProfile();
    expect(profile.fullName).toBe('Alice Smith');
  });
});
