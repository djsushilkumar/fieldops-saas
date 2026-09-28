'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { authState, user } = useAuth();
  const { activeOrganization } = useOrganization();

  const isAuthenticated = authState === 'AUTHENTICATED' && user;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded bg-brand-primary/10 px-2 py-0.5 text-xs font-bold text-brand-primary">
            Phase 03 Active
          </span>
          <span className="text-xs text-text-muted">Identity, Multi-Tenancy & Access Control</span>
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary">
          FieldOps Enterprise Management Platform
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Multi-tenant operations, strict organization boundaries, and role-based access control.
        </p>

        {isAuthenticated ? (
          <div className="mt-6 rounded-lg bg-slate-50 p-4 border border-border">
            <h2 className="text-sm font-semibold text-primary">
              Authenticated as {user.fullName || user.email}
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Active Organization:{' '}
              <strong>{activeOrganization?.name || 'No tenant selected'}</strong>
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/dashboard">
                <Button variant="primary">Enter Dashboard →</Button>
              </Link>
              <Link href="/org/select">
                <Button variant="secondary">Switch Workspace</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex gap-3">
            <Link href="/login">
              <Button variant="primary">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="secondary">Create Tenant Workspace</Button>
            </Link>
          </div>
        )}

        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Phase 03 Architectural Invariants
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-text-muted">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>
                <strong>Strict Tenant Isolation:</strong> Every request and database operation is partitioned by Organization ID.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>
                <strong>Role-Based Access Control:</strong> 5 distinct system roles (Owner, Admin, Manager, Supervisor, Field Worker) enforced server-side.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>
                <strong>Final Owner Protection:</strong> The last active Owner cannot be removed, suspended, or demoted.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>
                <strong>Cache Isolation:</strong> Query caches are isolated per organization to prevent cross-tenant data leakage.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
