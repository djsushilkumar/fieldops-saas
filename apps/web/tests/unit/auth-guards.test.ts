import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  requireAuthenticatedUser,
  requireTenantContext,
} from '../../src/lib/auth-guards';
import { UserRole, MembershipStatus } from '@fieldops/types';

// Mock supabase-server module
vi.mock('../../src/lib/supabase-server', () => {
  return {
    isSupabaseConfigured: vi.fn().mockReturnValue(true),
    verifySupabaseToken: vi.fn(),
    getSupabaseAdminClient: vi.fn(),
    getSupabaseUserClient: vi.fn(),
    mapDbProfileToUserProfile: vi.fn((row) => ({
      id: row.user_id || row.id,
      email: row.email,
      fullName: row.full_name || 'Test User',
      timezone: 'UTC',
      createdAt: row.created_at || '2026-10-01T00:00:00.000Z',
      updatedAt: row.updated_at || '2026-10-01T00:00:00.000Z',
    })),
    mapDbOrgToOrganization: vi.fn((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      subscriptionTier: row.subscription_tier || 'GROWTH',
      subscriptionStatus: row.subscription_status || 'ACTIVE',
      settings: {
        allowedRadiusMeters: 150,
        timezone: 'UTC',
        requirePhotoProof: true,
        requireSignature: false,
      },
      createdAt: row.created_at || '2026-10-01T00:00:00.000Z',
      updatedAt: row.updated_at || '2026-10-01T00:00:00.000Z',
    })),
    mapDbMembershipToMembership: vi.fn((row, org, profile) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      createdAt: row.created_at || '2026-10-01T00:00:00.000Z',
      updatedAt: row.updated_at || '2026-10-01T00:00:00.000Z',
      organization: org,
      user: profile,
    })),
  };
});

import {
  verifySupabaseToken,
  getSupabaseAdminClient,
} from '../../src/lib/supabase-server';

describe('Phase 1 & 2 Security: Auth Guards & Tenant Isolation Matrix', () => {
  const tenantA = 'org_tenant_alpha';
  const tenantB = 'org_tenant_beta';
  const userAId = 'usr_alice_123';
  const userBId = 'usr_bob_456';

  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(options: {
    token?: string;
    tenantHeader?: string;
    cookieToken?: string;
    cookieTenant?: string;
  }) {
    const headers: Record<string, string> = {};
    if (options.token) {
      headers['authorization'] = `Bearer ${options.token}`;
    }
    if (options.tenantHeader) {
      headers['x-tenant-id'] = options.tenantHeader;
    }

    const req = new NextRequest(new URL('https://app.fieldops.test/api/v1/tasks'), {
      headers,
    });

    if (options.cookieToken) {
      req.cookies.set('fieldops_access_token', options.cookieToken);
    }
    if (options.cookieTenant) {
      req.cookies.set('fieldops_active_org_id', options.cookieTenant);
    }

    return req;
  }

  describe('requireAuthenticatedUser()', () => {
    it('returns 401 when authorization token is completely missing', async () => {
      const req = createRequest({});
      const result = await requireAuthenticatedUser(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(401);
        const data = await result.response.json();
        expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
      }
    });

    it('returns 401 when token verification fails or token is expired', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: null,
        error: new Error('Token is expired or invalid signature'),
      });

      const req = createRequest({ token: 'invalid_or_expired_jwt' });
      const result = await requireAuthenticatedUser(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(401);
        const data = await result.response.json();
        expect(data.error.code).toBe('UNAUTHORIZED');
        expect(data.error.message).toContain('expired or invalid');
      }
    });

    it('returns verified user context when valid token is presented', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: { id: userAId, email: 'alice@fieldops.com', user_metadata: { full_name: 'Alice' } } as any,
        error: null,
      });

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'prof_1', user_id: userAId, email: 'alice@fieldops.com', full_name: 'Alice' },
            error: null,
          }),
        })),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);

      const req = createRequest({ token: 'valid_crypto_token' });
      const result = await requireAuthenticatedUser(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.user.id).toBe(userAId);
        expect(result.context.user.email).toBe('alice@fieldops.com');
      }
    });
  });

  describe('requireTenantContext() - Tenant Isolation Boundary', () => {
    it('returns 400 when active tenant header (x-tenant-id) is missing', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: { id: userAId, email: 'alice@fieldops.com' } as any,
        error: null,
      });

      const mockAdmin = {
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'prof_1', user_id: userAId, email: 'alice@fieldops.com' },
          }),
        })),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);

      const req = createRequest({ token: 'valid_token' });
      const result = await requireTenantContext(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error.code).toBe('TENANT_HEADER_REQUIRED');
      }
    });

    it('User A → Own Tenant (allowed): grants access when ACTIVE membership exists', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: { id: userAId, email: 'alice@fieldops.com' } as any,
        error: null,
      });

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'prof_1', user_id: userAId, email: 'alice@fieldops.com' },
              }),
            };
          }
          if (table === 'memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string, val: string) => ({
                eq: vi.fn().mockImplementation((col2: string, val2: string) => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'mem_alice',
                      organization_id: tenantA,
                      user_id: userAId,
                      role: UserRole.ADMIN,
                      status: MembershipStatus.ACTIVE,
                    },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === 'organizations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: tenantA, name: 'Tenant Alpha', slug: 'tenant-alpha' },
                error: null,
              }),
            };
          }
          return {};
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);

      const req = createRequest({ token: 'valid_token', tenantHeader: tenantA });
      const result = await requireTenantContext(req);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.tenantId).toBe(tenantA);
        expect(result.context.user.id).toBe(userAId);
        expect(result.context.role).toBe(UserRole.ADMIN);
      }
    });

    it('User A → User B Tenant (denied): returns 403 when User A attempts to access Tenant B with forged header', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: { id: userAId, email: 'alice@fieldops.com' } as any,
        error: null,
      });

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'prof_1', user_id: userAId, email: 'alice@fieldops.com' },
              }),
            };
          }
          if (table === 'memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  // No membership found for User A in Tenant B
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);

      const req = createRequest({ token: 'valid_token_user_a', tenantHeader: tenantB });
      const result = await requireTenantContext(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(403);
        const data = await result.response.json();
        expect(data.error.code).toBe('CROSS_TENANT_FORBIDDEN');
      }
    });

    it('inactive membership (SUSPENDED / REMOVED) is denied with 403', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: { id: userAId, email: 'alice@fieldops.com' } as any,
        error: null,
      });

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'prof_1', user_id: userAId, email: 'alice@fieldops.com' },
              }),
            };
          }
          if (table === 'memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'mem_suspended',
                      organization_id: tenantA,
                      user_id: userAId,
                      role: UserRole.FIELD_WORKER,
                      status: MembershipStatus.SUSPENDED,
                    },
                    error: null,
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);

      const req = createRequest({ token: 'valid_token', tenantHeader: tenantA });
      const result = await requireTenantContext(req);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(403);
        const data = await result.response.json();
        expect(data.error.code).toBe('MEMBERSHIP_INACTIVE');
      }
    });

    it('denies execution when user role does not satisfy required allowedRoles', async () => {
      vi.mocked(verifySupabaseToken).mockResolvedValueOnce({
        user: { id: userAId, email: 'alice@fieldops.com' } as any,
        error: null,
      });

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'prof_1', user_id: userAId, email: 'alice@fieldops.com' },
              }),
            };
          }
          if (table === 'memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation(() => ({
                eq: vi.fn().mockImplementation(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'mem_worker',
                      organization_id: tenantA,
                      user_id: userAId,
                      role: UserRole.FIELD_WORKER,
                      status: MembershipStatus.ACTIVE,
                    },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === 'organizations') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: tenantA, name: 'Tenant Alpha', slug: 'tenant-alpha' },
                error: null,
              }),
            };
          }
          return {};
        }),
      };
      vi.mocked(getSupabaseAdminClient).mockReturnValue(mockAdmin as any);

      const req = createRequest({ token: 'valid_token', tenantHeader: tenantA });
      // Endpoint requires OWNER or ADMIN
      const result = await requireTenantContext(req, [UserRole.OWNER, UserRole.ADMIN]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(403);
        const data = await result.response.json();
        expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      }
    });
  });
});
