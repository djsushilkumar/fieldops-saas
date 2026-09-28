import {
  BillingOverview,
  Subscription,
  SubscriptionPlan,
  BillingInterval,
  CheckoutSessionResult,
  PortalSessionResult,
  BillingProviderType,
} from '@fieldops/types';
import type { FieldOpsApiClient } from './index';
import type { BillingProvider } from './billing-provider';

export interface CheckoutRequestPayload {
  plan: SubscriptionPlan;
  billingInterval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  userEmail: string;
}

export interface PortalRequestPayload {
  returnUrl?: string;
}

export interface CancelSubscriptionPayload {
  atPeriodEnd?: boolean;
}

export interface UsageCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  metric: string;
}

export class BillingService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async getOverview(): Promise<BillingOverview> {
    return this.client.get<BillingOverview>('/api/v1/billing/overview');
  }

  public async getSubscription(): Promise<Subscription | null> {
    return this.client.get<Subscription | null>('/api/v1/billing/subscription');
  }

  public async createCheckoutSession(payload: CheckoutRequestPayload): Promise<CheckoutSessionResult> {
    return this.client.post<CheckoutSessionResult>('/api/v1/billing/checkout', payload);
  }

  public async createPortalSession(payload?: PortalRequestPayload): Promise<PortalSessionResult> {
    return this.client.post<PortalSessionResult>('/api/v1/billing/portal', payload || {});
  }

  public async cancelSubscription(payload?: CancelSubscriptionPayload): Promise<{ success: boolean }> {
    return this.client.post<{ success: boolean }>('/api/v1/billing/cancel', payload || { atPeriodEnd: true });
  }

  public async checkUsage(metric: string, increment: number = 1): Promise<UsageCheckResult> {
    return this.client.post<UsageCheckResult>('/api/v1/billing/usage/check', { metric, increment });
  }
}
