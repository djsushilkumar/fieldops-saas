import { describe, it, expect, vi } from 'vitest';
import { FieldOpsApiClient, BillingService } from '@fieldops/api';
import { TenantId, ErrorCode, SubscriptionPlan, BillingInterval } from '@fieldops/types';

describe('Security Suite: SaaS Billing Tenant Isolation & Role Governance', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('rejects cross-tenant access to billing overview', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      if (url.includes('/api/v1/billing/overview') && requestTenant !== tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cross-tenant billing access strictly prohibited.',
              request_id: 'req_sec_bill_iso_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            plan: 'STARTER',
            status: 'ACTIVE',
            billingInterval: 'MONTH',
          },
        }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_b_user',
      getTenantId: () => tenantB,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new BillingService(client);

    await expect(service.getOverview()).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('blocks non-admin/non-owner members from initiating plan checkouts', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const authHeader = headers['Authorization'];

      // User has FIELD_WORKER role token
      if (authHeader?.includes('field_worker_token')) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.BILLING_ACCESS_DENIED,
              message: 'Billing modification requires organization OWNER privileges.',
              request_id: 'req_sec_bill_rbac_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { sessionId: 'cs_1', checkoutUrl: 'https://checkout.test' },
        }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_field_worker_token',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new BillingService(client);

    await expect(
      service.createCheckoutSession({
        plan: SubscriptionPlan.GROWTH,
        billingInterval: BillingInterval.MONTH,
        successUrl: 'https://app.test/success',
        cancelUrl: 'https://app.test/cancel',
        userEmail: 'worker@fieldops.io',
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.BILLING_ACCESS_DENIED,
        }),
      })
    );
  });
});
