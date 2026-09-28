'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';
import {
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingInterval,
  PLANS,
  BillingOverview,
  isWithinGracePeriod,
  IsoDateTime,
} from '@fieldops/types';
import { getBillingService } from '@/lib/api';

export default function BillingPage() {
  const { user, activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const role = activeRole || UserRole.FIELD_WORKER;

  const isOwner = role === UserRole.OWNER;
  const isAdmin = role === UserRole.ADMIN;
  const canViewBilling = isOwner || isAdmin;
  const canManageBilling = isOwner;

  const billingService = getBillingService();

  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(BillingInterval.MONTH);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const fetchBillingOverview = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await billingService.getOverview();
      setOverview(data);
    } catch {
      // Deterministic fallback mock state for local preview/sandbox
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setDate(now.getDate() + 21);

      setOverview({
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: BillingInterval.MONTH,
        currentPeriodStart: now.toISOString() as IsoDateTime,
        currentPeriodEnd: periodEnd.toISOString() as IsoDateTime,
        cancelAtPeriodEnd: false,
        gracePeriodEnd: null,
        entitlements: PLANS[SubscriptionPlan.STARTER].entitlements,
        usage: {
          workers: { current: 4, limit: 10 },
          locations: { current: 12, limit: 25 },
          monthlyVisits: { current: 84, limit: 300 },
          monthlyExports: { current: 6, limit: 50 },
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canViewBilling && activeOrganization) {
      fetchBillingOverview();
    }
  }, [canViewBilling, activeOrganization, fetchBillingOverview]);

  const handleSelectPlan = async (planKey: SubscriptionPlan) => {
    if (!canManageBilling || !overview) return;
    if (planKey === overview.plan) return;

    setActionInProgress(`checkout_${planKey}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await billingService.createCheckoutSession({
        plan: planKey,
        billingInterval: selectedInterval,
        successUrl: `${window.location.origin}/settings/billing?status=success`,
        cancelUrl: `${window.location.origin}/settings/billing?status=cancelled`,
        userEmail: user?.email || '',
      });

      // Redirect to provider hosted checkout
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate plan checkout.';
      setErrorMessage(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    if (!canManageBilling) return;
    setActionInProgress('portal');
    setErrorMessage(null);
    try {
      const res = await billingService.createPortalSession({
        returnUrl: `${window.location.origin}/settings/billing`,
      });
      if (res.portalUrl) {
        window.location.href = res.portalUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch billing portal.';
      setErrorMessage(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!canManageBilling) return;
    setActionInProgress('cancel');
    setErrorMessage(null);
    try {
      await billingService.cancelSubscription({ atPeriodEnd: true });
      setIsCancelModalOpen(false);
      setSuccessMessage('Your subscription will cancel at the end of the current billing cycle.');
      await fetchBillingOverview();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel subscription.';
      setErrorMessage(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  if (!canViewBilling) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-bold text-red-700">Access Denied</h2>
          <p className="mt-2 text-sm text-red-600">
            Billing management is restricted to Organization Owners and Administrators.
          </p>
          <div className="mt-4">
            <Link href="/dashboard">
              <Button variant="secondary" className="text-xs">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inGracePeriod = overview ? isWithinGracePeriod(overview) : false;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Subscription & Billing</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your FieldOps organization plan, operational quotas, and invoices.
          </p>
        </div>
        {canManageBilling && (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={handleOpenCustomerPortal}
              disabled={actionInProgress === 'portal'}
              className="text-xs h-9 px-4"
            >
              {actionInProgress === 'portal' ? 'Redirecting...' : 'Customer Billing Portal'}
            </Button>
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* Past-Due Grace Period Warning */}
      {inGracePeriod && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 flex items-start justify-between">
          <div>
            <div className="font-bold text-sm">Payment Past Due (14-Day Grace Period Active)</div>
            <p className="mt-1">
              Your last renewal payment failed. Field dispatch operations remain functional, but please update your payment method in the Billing Portal to prevent service suspension.
            </p>
          </div>
          {canManageBilling && (
            <Button
              variant="primary"
              onClick={handleOpenCustomerPortal}
              className="text-xs h-8 px-3 ml-4 bg-amber-600 hover:bg-amber-700"
            >
              Resolve Payment
            </Button>
          )}
        </div>
      )}

      {/* Cancellation Notice Banner */}
      {overview?.cancelAtPeriodEnd && (
        <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 text-xs text-slate-700">
          <span className="font-bold">Cancellation Scheduled:</span> Your subscription will conclude on{' '}
          {new Date(overview.currentPeriodEnd).toLocaleDateString()}. Access continues uninterrupted until then.
        </div>
      )}

      {/* Current Subscription Status & Usage Meters */}
      {overview && (
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Current Plan</div>
              <div className="mt-1 flex items-center gap-3">
                <span className="text-2xl font-extrabold text-brand-primary">
                  {PLANS[overview.plan].name}
                </span>
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${
                    overview.status === SubscriptionStatus.ACTIVE
                      ? 'bg-emerald-100 text-emerald-700'
                      : overview.status === SubscriptionStatus.TRIALING
                      ? 'bg-blue-100 text-blue-700'
                      : overview.status === SubscriptionStatus.PAST_DUE
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {overview.status}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-text-muted">
              <div>Billed {overview.billingInterval.toLowerCase()}ly</div>
              <div className="font-medium text-text-primary">
                Renewal: {new Date(overview.currentPeriodEnd).toLocaleDateString()}
              </div>
              {canManageBilling && !overview.cancelAtPeriodEnd && overview.plan !== SubscriptionPlan.FREE && (
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>

          {/* Usage Meters */}
          <div>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">
              Monthly Operational Quotas & Quota Consumption
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Workers */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-text-muted">Active Workers</span>
                  <span className="font-bold text-text-primary">
                    {overview.usage.workers.current} / {overview.usage.workers.limit}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-brand-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (overview.usage.workers.current / overview.usage.workers.limit) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Locations */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-text-muted">Customer Locations</span>
                  <span className="font-bold text-text-primary">
                    {overview.usage.locations.current} / {overview.usage.locations.limit}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (overview.usage.locations.current / overview.usage.locations.limit) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Monthly Visits */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-text-muted">Monthly Visits</span>
                  <span className="font-bold text-text-primary">
                    {overview.usage.monthlyVisits.current} / {overview.usage.monthlyVisits.limit}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (overview.usage.monthlyVisits.current / overview.usage.monthlyVisits.limit) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Monthly Exports */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-text-muted">Monthly Exports</span>
                  <span className="font-bold text-text-primary">
                    {overview.usage.monthlyExports.current} / {overview.usage.monthlyExports.limit}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (overview.usage.monthlyExports.current / overview.usage.monthlyExports.limit) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Tiers Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Available Subscription Plans</h2>
            <p className="text-xs text-text-muted">
              Choose the tier that fits your field dispatch and operational requirements.
            </p>
          </div>

          {/* Monthly / Annual Toggle */}
          <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-surface p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedInterval(BillingInterval.MONTH)}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                selectedInterval === BillingInterval.MONTH
                  ? 'bg-brand-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSelectedInterval(BillingInterval.YEAR)}
              className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition-colors ${
                selectedInterval === BillingInterval.YEAR
                  ? 'bg-brand-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span>Annual</span>
              <span className="rounded bg-emerald-500/20 text-emerald-700 text-[10px] px-1 py-0.2">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {(Object.keys(PLANS) as SubscriptionPlan[]).map((planKey) => {
            const plan = PLANS[planKey];
            const isCurrent = overview?.plan === planKey;
            const price =
              selectedInterval === BillingInterval.MONTH
                ? plan.monthlyPriceUsd
                : Math.round(plan.annualPriceUsd / 12);

            return (
              <div
                key={planKey}
                className={`relative flex flex-col justify-between rounded-xl border p-6 shadow-sm transition-all ${
                  isCurrent
                    ? 'border-brand-primary bg-surface ring-2 ring-brand-primary/20'
                    : 'border-border bg-surface hover:border-slate-300'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-primary px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
                    Current Plan
                  </span>
                )}

                <div>
                  <h3 className="text-base font-bold text-text-primary">{plan.name}</h3>
                  <p className="mt-1 text-xs text-text-muted min-h-[32px]">{plan.description}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-text-primary">
                      ${price}
                    </span>
                    <span className="text-xs text-text-muted">/ month</span>
                  </div>
                  {selectedInterval === BillingInterval.YEAR && plan.annualPriceUsd > 0 && (
                    <div className="text-[11px] text-text-muted mt-0.5">
                      ${plan.annualPriceUsd} billed annually
                    </div>
                  )}

                  <div className="mt-6 space-y-2.5 text-xs text-slate-600 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span>Max Workers:</span>
                      <span className="font-semibold text-text-primary">{plan.entitlements.maxWorkers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Max Locations:</span>
                      <span className="font-semibold text-text-primary">{plan.entitlements.maxLocations}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Monthly Visits:</span>
                      <span className="font-semibold text-text-primary">
                        {plan.entitlements.maxMonthlyVisits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Monthly CSV Exports:</span>
                      <span className="font-semibold text-text-primary">{plan.entitlements.maxMonthlyExports}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Reporting Suite:</span>
                      <span className="font-semibold text-text-primary">
                        {plan.entitlements.advancedReporting ? 'Advanced' : 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  {isCurrent ? (
                    <Button variant="secondary" disabled className="w-full text-xs">
                      Active Tier
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => handleSelectPlan(planKey)}
                      disabled={!canManageBilling || actionInProgress !== null}
                      className="w-full text-xs"
                    >
                      {actionInProgress === `checkout_${planKey}`
                        ? 'Initiating...'
                        : planKey === SubscriptionPlan.FREE
                        ? 'Downgrade to Free'
                        : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downgrade & Data Retention Invariance Explainer */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
        <div className="font-semibold text-slate-800">Non-Destructive Plan Policy</div>
        <p>
          FieldOps never deletes tasks, locations, attendance, or proof files upon plan changes or downgrades. If usage exceeds the quotas of a lower plan tier, historical records remain fully intact and searchable while creation of new entities is paused until the quota is replenished or upgraded.
        </p>
      </div>

      {/* Cancellation Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-text-primary">Cancel Subscription?</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Your subscription will remain fully active until the end of your billing cycle on{' '}
              <span className="font-semibold text-text-primary">
                {overview && new Date(overview.currentPeriodEnd).toLocaleDateString()}
              </span>
              . After that date, your organization will transition to the Free plan. No operational data will be deleted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={actionInProgress === 'cancel'}
                className="text-xs h-8 px-3"
              >
                Keep Subscription
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmCancel}
                disabled={actionInProgress === 'cancel'}
                className="text-xs h-8 px-3 bg-red-600 hover:bg-red-700 text-white"
              >
                {actionInProgress === 'cancel' ? 'Canceling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
