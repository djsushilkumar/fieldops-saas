import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  MembershipService,
  OrganizationService,
  ApiClientError,
} from '@fieldops/api';
import { TenantId, ErrorCode, UserRole } from '@fieldops/types';

describe('Security Suite: Cross-Tenant Isolation Matrix', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('rejects access when User from Tenant A attempts to access Tenant B resources', async () => {
    // Simulated backend RLS response returning 403 Forbidden for cross-tenant query
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      // If user session is bound to Tenant A, but request targets Tenant B
      if (url.includes(tenantB) || requestTenant === tenantB) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cross-tenant resource access strictly prohibited.',
              request_id: 'req_sec_test_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    });

    // Client authenticated as Tenant A user
    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_user_tenant_a',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const membershipService = new MembershipService(client);

    // Attempt to query Tenant B's members
    await expect(membershipService.listMembers(tenantB)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('ensures headers strictly isolate tenant ID on every outgoing API request', async () => {
    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
    });

    const orgService = new OrganizationService(client);
    await orgService.listOrganizations();

    expect(customFetch).toHaveBeenCalledTimes(1);
    const sentHeaders = customFetch.mock.calls[0][1].headers;
    expect(sentHeaders['x-tenant-id']).toBe(tenantA);
    expect(sentHeaders['x-tenant-id']).not.toBe(tenantB);
  });
});
