import { describe, it, expect } from 'vitest';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  PLANS,
  getPlanConfiguration,
  getPlanEntitlements,
  isSubscriptionEntitled,
  isWithinGracePeriod,
  UserRole,
  IsoDateTime,
} from '@fieldops/types';

describe('SaaS Billing & Entitlements Unit Tests', () => {
  describe('Plan Configurations & Entitlements Matrix', () => {
    it('defines correct limits for the Free plan', () => {
      const plan = getPlanConfiguration(SubscriptionPlan.FREE);
      expect(plan.monthlyPriceUsd).toBe(0);
      expect(plan.annualPriceUsd).toBe(0);
      expect(plan.entitlements.maxWorkers).toBe(3);
      expect(plan.entitlements.maxLocations).toBe(5);
      expect(plan.entitlements.maxMonthlyVisits).toBe(50);
      expect(plan.entitlements.maxMonthlyExports).toBe(5);
      expect(plan.entitlements.advancedReporting).toBe(false);
      expect(plan.entitlements.auditExports).toBe(false);
    });

    it('defines correct limits for the Starter plan', () => {
      const plan = getPlanConfiguration(SubscriptionPlan.STARTER);
      expect(plan.monthlyPriceUsd).toBe(29);
      expect(plan.annualPriceUsd).toBe(290);
      expect(plan.entitlements.maxWorkers).toBe(10);
      expect(plan.entitlements.maxLocations).toBe(25);
      expect(plan.entitlements.maxMonthlyVisits).toBe(300);
      expect(plan.entitlements.maxMonthlyExports).toBe(50);
      expect(plan.entitlements.advancedReporting).toBe(false);
    });

    it('defines correct limits for the Growth plan', () => {
      const plan = getPlanConfiguration(SubscriptionPlan.GROWTH);
      expect(plan.monthlyPriceUsd).toBe(79);
      expect(plan.annualPriceUsd).toBe(790);
      expect(plan.entitlements.maxWorkers).toBe(30);
      expect(plan.entitlements.maxLocations).toBe(100);
      expect(plan.entitlements.maxMonthlyVisits).toBe(1500);
      expect(plan.entitlements.maxMonthlyExports).toBe(200);
      expect(plan.entitlements.advancedReporting).toBe(true);
    });

    it('defines correct limits for the Business plan', () => {
      const plan = getPlanConfiguration(SubscriptionPlan.BUSINESS);
      expect(plan.monthlyPriceUsd).toBe(199);
      expect(plan.annualPriceUsd).toBe(1990);
      expect(plan.entitlements.maxWorkers).toBe(100);
      expect(plan.entitlements.maxLocations).toBe(500);
      expect(plan.entitlements.maxMonthlyVisits).toBe(10000);
      expect(plan.entitlements.maxMonthlyExports).toBe(1000);
      expect(plan.entitlements.advancedReporting).toBe(true);
      expect(plan.entitlements.auditExports).toBe(true);
    });
  });

  describe('Subscription Entitlement & Grace Period Evaluation', () => {
    it('entitles ACTIVE and TRIALING subscriptions to operational services', () => {
      expect(isSubscriptionEntitled({ status: SubscriptionStatus.ACTIVE })).toBe(true);
      expect(isSubscriptionEntitled({ status: SubscriptionStatus.TRIALING })).toBe(true);
    });

    it('denies EXPIRED and CANCELED subscriptions', () => {
      expect(isSubscriptionEntitled({ status: SubscriptionStatus.EXPIRED })).toBe(false);
      expect(isSubscriptionEntitled({ status: SubscriptionStatus.CANCELED })).toBe(false);
    });

    it('allows PAST_DUE subscriptions only within the 14-day grace period', () => {
      const now = new Date('2026-09-28T12:00:00Z');
      const futureGrace = '2026-10-05T12:00:00Z' as IsoDateTime;
      const pastGrace = '2026-09-20T12:00:00Z' as IsoDateTime;

      // Within grace period
      expect(
        isSubscriptionEntitled({ status: SubscriptionStatus.PAST_DUE, gracePeriodEnd: futureGrace }, now)
      ).toBe(true);
      expect(
        isWithinGracePeriod({ status: SubscriptionStatus.PAST_DUE, gracePeriodEnd: futureGrace }, now)
      ).toBe(true);

      // Expired grace period
      expect(
        isSubscriptionEntitled({ status: SubscriptionStatus.PAST_DUE, gracePeriodEnd: pastGrace }, now)
      ).toBe(false);
      expect(
        isWithinGracePeriod({ status: SubscriptionStatus.PAST_DUE, gracePeriodEnd: pastGrace }, now)
      ).toBe(false);
    });
  });

  describe('Billing Role Governance & Access Control', () => {
    it('grants Owner full management access and Admin read-only access', () => {
      const evaluateBillingAccess = (role: UserRole) => ({
        canView: role === UserRole.OWNER || role === UserRole.ADMIN,
        canManage: role === UserRole.OWNER,
      });

      expect(evaluateBillingAccess(UserRole.OWNER)).toEqual({ canView: true, canManage: true });
      expect(evaluateBillingAccess(UserRole.ADMIN)).toEqual({ canView: true, canManage: false });
      expect(evaluateBillingAccess(UserRole.MANAGER)).toEqual({ canView: false, canManage: false });
      expect(evaluateBillingAccess(UserRole.SUPERVISOR)).toEqual({ canView: false, canManage: false });
      expect(evaluateBillingAccess(UserRole.FIELD_WORKER)).toEqual({ canView: false, canManage: false });
    });
  });
});
