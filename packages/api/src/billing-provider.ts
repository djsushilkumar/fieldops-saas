import {
  BillingProviderType,
  TenantId,
  CreateCheckoutSessionParams,
  CheckoutSessionResult,
  CreatePortalSessionParams,
  PortalSessionResult,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingInterval,
  UUID,
  IsoDateTime,
} from '@fieldops/types';

export interface BillingProvider {
  readonly type: BillingProviderType;
  createCustomer(params: { organizationId: TenantId; email: string; name: string }): Promise<{ customerId: string }>;
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;
  createPortalSession(params: CreatePortalSessionParams): Promise<PortalSessionResult>;
  getSubscription(providerSubscriptionId: string): Promise<Subscription | null>;
  cancelSubscription(providerSubscriptionId: string, atPeriodEnd?: boolean): Promise<{ success: boolean; cancelAtPeriodEnd: boolean }>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}

export class MockBillingProvider implements BillingProvider {
  public readonly type = BillingProviderType.MOCK;
  private readonly subscriptions = new Map<string, Subscription>();

  public async createCustomer(params: { organizationId: TenantId; email: string; name: string }): Promise<{ customerId: string }> {
    const customerId = `cus_mock_${params.organizationId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
    return { customerId };
  }

  public async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    const sessionId = `cs_mock_${Math.random().toString(36).substring(2, 10)}`;
    const checkoutUrl = `${params.successUrl}?session_id=${sessionId}&plan=${params.plan}&interval=${params.billingInterval}`;
    return { sessionId, checkoutUrl };
  }

  public async createPortalSession(params: CreatePortalSessionParams): Promise<PortalSessionResult> {
    const portalUrl = `${params.returnUrl}?portal_session=pt_mock_${Math.random().toString(36).substring(2, 10)}`;
    return { portalUrl };
  }

  public async getSubscription(providerSubscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.get(providerSubscriptionId) || null;
  }

  public setMockSubscription(providerSubscriptionId: string, subscription: Subscription): void {
    this.subscriptions.set(providerSubscriptionId, subscription);
  }

  public async cancelSubscription(
    providerSubscriptionId: string,
    atPeriodEnd: boolean = true
  ): Promise<{ success: boolean; cancelAtPeriodEnd: boolean }> {
    const existing = this.subscriptions.get(providerSubscriptionId);
    if (existing) {
      this.subscriptions.set(providerSubscriptionId, {
        ...existing,
        cancelAtPeriodEnd: atPeriodEnd,
        status: atPeriodEnd ? existing.status : SubscriptionStatus.CANCELED,
        canceledAt: new Date().toISOString() as IsoDateTime,
        updatedAt: new Date().toISOString() as IsoDateTime,
      });
    }
    return { success: true, cancelAtPeriodEnd: atPeriodEnd };
  }

  public verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      return false;
    }
    // Deterministic mock verification
    return signature === 'valid_mock_signature' || signature.startsWith('mock_sig_') || signature === secret;
  }
}
