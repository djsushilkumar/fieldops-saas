'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';
import { can, Permissions, ROLE_PERMISSIONS, UserRole } from '@fieldops/types';

export default function DashboardPage() {
  const { user, activeMembership, activeRole } = useAuth();
  const { activeOrganization, isLoading } = useOrganization();

  const role = activeRole || UserRole.FIELD_WORKER;
  const permissions = ROLE_PERMISSIONS[role] || [];

  const canManageMembers = can(role, Permissions.MEMBER_INVITE);
  const canEditSettings = can(role, Permissions.ORG_SETTINGS_EDIT);
  const canViewAudit = can(role, Permissions.AUDIT_VIEW);

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Top Banner */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                Active Tenant Context
              </span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                ISOLATED
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
              {isLoading ? 'Loading workspace...' : activeOrganization?.name || 'FieldOps Tenant'}
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              Tenant ID: <code className="font-mono text-[11px]">{activeMembership?.organizationId}</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/org/select">
              <Button variant="secondary" className="text-xs">
                Switch Organization
              </Button>
            </Link>
            {canManageMembers && (
              <Link href="/organization/members">
                <Button variant="primary" className="text-xs">
                  Manage Members
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Identity & Role Summary Card */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-border pt-6">
          <div className="rounded-lg bg-slate-50 p-4">
            <span className="text-xs font-semibold text-text-muted">Current User</span>
            <p className="mt-1 text-sm font-bold text-primary">{user?.fullName || 'User'}</p>
            <p className="text-xs text-text-muted">{user?.email}</p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <span className="text-xs font-semibold text-text-muted">Assigned System Role</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-brand-primary px-2.5 py-0.5 text-xs font-bold text-white">
                {role}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Status: <strong>{activeMembership?.status || 'ACTIVE'}</strong>
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <span className="text-xs font-semibold text-text-muted">Subscription & Scope</span>
            <p className="mt-1 text-sm font-bold text-primary">
              {activeOrganization?.subscriptionTier || 'TRIAL'} PLAN
            </p>
            <p className="text-xs text-text-muted">
              Timezone: {activeOrganization?.settings?.timezone || 'UTC'}
            </p>
          </div>
        </div>
      </div>

      {/* Permissions Matrix Inspection */}
      <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-primary">
              Role Authority & Capability Matrix
            </h2>
            <p className="text-xs text-text-muted">
              Server-enforced Row-Level Security capabilities active for <strong>{role}</strong>.
            </p>
          </div>
          <span className="rounded bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
            {permissions.length} Capabilities Granted
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {permissions.map((perm) => (
            <div
              key={perm}
              className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/50 p-2 text-xs"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <code className="font-mono text-slate-700">{perm}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Governance Notice */}
      <div className="mt-8 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-4 text-xs">
        <h3 className="font-semibold text-brand-primary">Phase 03 Governance Verified</h3>
        <p className="mt-1 text-text-muted">
          Identity, multi-tenancy, and organization-scoped access control are active.
          Task CRUD, GPS tracking, and attendance drivers remain strictly gated until subsequent phases per AGENTS.md.
        </p>
      </div>
    </div>
  );
}
