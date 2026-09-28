import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BillingService,
  MockBillingProvider,
  FieldOpsApiClient,
} from '../src/index';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  BillingInterval,
  TenantId,
  PLANS,
  IsoDateTime,
} from '@fieldops/types';

describe('BillingService & MockBillingProvider', () => {
  describe('MockBillingProvider', () => {
    let provider: MockBillingProvider;
    const orgId = '00000000-0000-0000-0000-000000000001' as TenantId;

    beforeEach(() => {
      provider = new MockBillingProvider();
    });

    it('creates customer deterministically without external network requests', async () => {
      const res = await provider.createCustomer({
        organizationId: orgId,
        email: 'billing@fieldops.io',
        name: 'Acme Services',
      });

      expect(res.customerId).toBeDefined();
      expect(res.customerId).toContain('cus_mock_');
    });

    it('generates checkout sessions with success/cancel URLs and plan params', async () => {
      const res = await provider.createCheckoutSession({
        organizationId: orgId,
        plan: SubscriptionPlan.GROWTH,
        billingInterval: BillingInterval.MONTH,
        successUrl: 'https://app.fieldops.test/settings/billing?success=true',
        cancelUrl: 'https://app.fieldops.test/settings/billing?cancelled=true',
        userEmail: 'owner@fieldops.io',
      });

      expect(res.sessionId).toContain('cs_mock_');
      expect(res.checkoutUrl).toContain('plan=GROWTH');
      expect(res.checkoutUrl).toContain('interval=MONTH');
    });

    it('generates customer portal sessions', async () => {
      const res = await provider.createPortalSession({
        organizationId: orgId,
        returnUrl: 'https://app.fieldops.test/settings/billing',
      });

      expect(res.portalUrl).toContain('portal_session=pt_mock_');
    });

    it('verifies deterministic webhook signatures safely', () => {
      expect(provider.verifyWebhookSignature('payload', 'valid_mock_signature', 'secret')).toBe(true);
      expect(provider.verifyWebhookSignature('payload', 'mock_sig_123', 'secret')).toBe(true);
      expect(provider.verifyWebhookSignature('payload', 'secret', 'secret')).toBe(true);
      expect(provider.verifyWebhookSignature('payload', 'invalid_sig', 'secret')).toBe(false);
      expect(provider.verifyWebhookSignature('payload', '', 'secret')).toBe(false);
    });

    it('cancels subscription with atPeriodEnd retention', async () => {
      const subId = 'sub_mock_123';
      provider.setMockSubscription(subId, {
        id: 's-1' as any,
        organizationId: orgId,
        plan: SubscriptionPlan.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        providerSubscriptionId: subId,
        billingInterval: BillingInterval.MONTH,
        currentPeriodStart: '2026-09-01T00:00:00Z' as IsoDateTime,
        currentPeriodEnd: '2026-10-01T00:00:00Z' as IsoDateTime,
        cancelAtPeriodEnd: false,
        createdAt: '2026-09-01T00:00:00Z' as IsoDateTime,
        updatedAt: '2026-09-01T00:00:00Z' as IsoDateTime,
      });

      const res = await provider.cancelSubscription(subId, true);
      expect(res.success).toBe(true);
      expect(res.cancelAtPeriodEnd).toBe(true);

      const updated = await provider.getSubscription(subId);
      expect(updated?.cancelAtPeriodEnd).toBe(true);
      expect(updated?.status).toBe(SubscriptionStatus.ACTIVE); // active until period end
    });
  });

  describe('BillingService Client Wrapper', () => {
    let mockClient: FieldOpsApiClient;
    let service: BillingService;

    beforeEach(() => {
      mockClient = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
      } as unknown as FieldOpsApiClient;
      service = new BillingService(mockClient);
    });

    it('fetches billing overview', async () => {
      const mockOverview = {
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        entitlements: PLANS[SubscriptionPlan.STARTER].entitlements,
      };
      (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOverview);

      const result = await service.getOverview();
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/billing/overview');
      expect(result).toEqual(mockOverview);
    });

    it('creates checkout session via API', async () => {
      (mockClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        sessionId: 'cs_123',
        checkoutUrl: 'https://checkout.fieldops.test/cs_123',
      });

      const payload = {
        plan: SubscriptionPlan.GROWTH,
        billingInterval: BillingInterval.YEAR,
        successUrl: 'https://app.fieldops.test/success',
        cancelUrl: 'https://app.fieldops.test/cancel',
        userEmail: 'owner@fieldops.io',
      };

      const result = await service.createCheckoutSession(payload);
      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/billing/checkout', payload);
      expect(result.sessionId).toBe('cs_123');
    });

    it('checks usage quota atomic check', async () => {
      (mockClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: true,
        currentUsage: 5,
        limit: 10,
        metric: 'workers',
      });

      const result = await service.checkUsage('workers', 1);
      expect(mockClient.post).toHaveBeenCalledWith('/api/v1/billing/usage/check', {
        metric: 'workers',
        increment: 1,
      });
      expect(result.allowed).toBe(true);
    });
  });
});
