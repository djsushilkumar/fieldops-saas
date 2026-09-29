'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';
import { TenantId } from '@fieldops/types';

export default function OrganizationSelectPage() {
  const router = useRouter();
  const { memberships, activeMembership } = useAuth();
  const { switchOrganization } = useOrganization();
  const [switchingId, setSwitchingId] = useState<TenantId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (orgId: TenantId) => {
    setSwitchingId(orgId);
    setError(null);
    try {
      await switchOrganization(orgId);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to switch organization');
      setSwitchingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Your Organizations</h1>
          <p className="mt-1 text-sm text-text-muted">
            Select an operational tenant workspace to enter.
          </p>
        </div>
        <Link href="/org/create">
          <Button variant="primary" className="text-xs">
            + New Organization
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {memberships.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center bg-surface">
            <p className="text-sm font-medium text-text-muted">
              You are not a member of any organizations yet.
            </p>
            <div className="mt-4">
              <Link href="/org/create">
                <Button variant="primary">Create an Organization</Button>
              </Link>
            </div>
          </div>
        ) : (
          memberships.map((membership) => {
            const isActive = activeMembership?.organizationId === membership.organizationId;
            const orgName = membership.organization?.name || `Tenant ${membership.organizationId.slice(0, 8)}`;
            const isSwitching = switchingId === membership.organizationId;

            return (
              <div
                key={membership.id}
                className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                  isActive
                    ? 'border-brand-primary/50 bg-brand-primary/5'
                    : 'border-border bg-surface hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">{orgName}</span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      {membership.role}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        membership.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {membership.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    ID: {membership.organizationId}
                  </p>
                </div>

                <div>
                  {isActive ? (
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() => router.push('/dashboard')}
                    >
                      Enter Console →
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      className="text-xs"
                      disabled={isSwitching || membership.status !== 'ACTIVE'}
                      onClick={() => handleSelect(membership.organizationId)}
                    >
                      {isSwitching ? 'Switching...' : 'Select'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
