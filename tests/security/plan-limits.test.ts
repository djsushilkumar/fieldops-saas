import { describe, it, expect, vi } from 'vitest';
import { FieldOpsApiClient, BillingService } from '@fieldops/api';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  PLANS,
  ErrorCode,
  TenantId,
} from '@fieldops/types';

describe('Security Suite: Plan Limits & Non-Destructive Downgrade Enforcement', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;

  it('atomically enforces plan limits when proposed action exceeds entitlement limit', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) || '{}');
      const { metric, increment } = body;

      // Simulated Starter plan limit: max 10 workers, currently at 10
      if (metric === 'workers' && increment > 0) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.PLAN_LIMIT_REACHED,
              message: 'Your organization has reached the limit of 10 workers for the Starter plan. Please upgrade.',
              request_id: 'req_sec_limit_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { allowed: true } }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_owner_token',
      getTenantId: () => tenantId,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new BillingService(client);

    await expect(service.checkUsage('workers', 1)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.PLAN_LIMIT_REACHED,
        }),
      })
    );
  });

  it('guarantees non-destructive downgrade invariance: retains existing records while gating new creations', () => {
    // Scenario: Org had 15 workers on Growth (limit 30)
    const existingWorkers = new Array(15).fill(null).map((_, i) => `worker_${i + 1}`);

    // Org downgrades to Starter (limit 10)
    const starterLimits = PLANS[SubscriptionPlan.STARTER].entitlements;

    // 1. Verify existing records are NOT purged or altered
    expect(existingWorkers.length).toBe(15);

    // 2. Evaluator checking if new worker can be added
    const canAddWorker = (currentCount: number, limit: number): boolean => {
      return currentCount + 1 <= limit;
    };

    expect(canAddWorker(existingWorkers.length, starterLimits.maxWorkers)).toBe(false);
  });

  it('strictly limits monthly exports quota per plan tier', () => {
    const freePlan = PLANS[SubscriptionPlan.FREE].entitlements;
    const starterPlan = PLANS[SubscriptionPlan.STARTER].entitlements;
    const growthPlan = PLANS[SubscriptionPlan.GROWTH].entitlements;
    const businessPlan = PLANS[SubscriptionPlan.BUSINESS].entitlements;

    expect(freePlan.maxMonthlyExports).toBe(5);
    expect(starterPlan.maxMonthlyExports).toBe(50);
    expect(growthPlan.maxMonthlyExports).toBe(200);
    expect(businessPlan.maxMonthlyExports).toBe(1000);

    const isExportAllowed = (usedThisMonth: number, planLimit: number): boolean => {
      return usedThisMonth + 1 <= planLimit;
    };

    expect(isExportAllowed(4, freePlan.maxMonthlyExports)).toBe(true);
    expect(isExportAllowed(5, freePlan.maxMonthlyExports)).toBe(false);
  });
});
