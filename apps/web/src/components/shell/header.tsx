'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';
import { can, Permissions, UserRole } from '@fieldops/types';

export function AppHeader() {
  const { authState, user, activeRole, signOut } = useAuth();
  const { activeOrganization } = useOrganization();

  const isAuthenticated = authState === 'AUTHENTICATED' && user;
  const role = activeRole || UserRole.FIELD_WORKER;

  const canManageMembers = can(role, Permissions.MEMBER_INVITE);
  const canViewMap = can(role, Permissions.LOCATION_VIEW_ALL) || can(role, Permissions.LOCATION_VIEW_TEAM);
  const canViewWorkforce = can(role, Permissions.MEMBER_PROFILE_VIEW_TEAM);
  const canViewReports = can(role, Permissions.REPORT_VIEW);
  const canManageBilling = role === UserRole.OWNER || role === UserRole.ADMIN;

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-primary">FieldOps</span>
        </Link>

        {isAuthenticated && activeOrganization && (
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/org/select"
              className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-slate-200 transition-colors"
            >
              <span className="font-normal text-text-muted">Org:</span>
              <span>{activeOrganization.name}</span>
            </Link>

            <nav className="flex items-center gap-3 text-xs font-semibold text-text-muted">
              {/* Operations Group */}
              <Link href="/dashboard" className="hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/tasks" className="hover:text-primary transition-colors">
                Tasks
              </Link>
              <Link href="/visits" className="hover:text-primary transition-colors">
                Visits
              </Link>
              <Link href="/calendar" className="hover:text-primary transition-colors">
                Calendar
              </Link>
              {canViewMap && (
                <Link href="/map" className="hover:text-primary transition-colors">
                  Live Map
                </Link>
              )}

              {/* Separator */}
              <span className="text-slate-300">|</span>

              {/* Workforce Group */}
              {canViewWorkforce && (
                <>
                  <Link href="/employees" className="hover:text-primary transition-colors">
                    Employees
                  </Link>
                  <Link href="/teams" className="hover:text-primary transition-colors">
                    Teams
                  </Link>
                </>
              )}
              <Link href="/attendance" className="hover:text-primary transition-colors">
                Attendance
              </Link>
              {canViewWorkforce && (
                <Link href="/activity" className="hover:text-primary transition-colors">
                  Activity
                </Link>
              )}

              {/* Separator */}
              <span className="text-slate-300">|</span>

              {/* Locations */}
              <Link href="/locations" className="hover:text-primary transition-colors">
                Locations
              </Link>

              {/* Reports */}
              {canViewReports && (
                <Link href="/reports" className="hover:text-primary transition-colors">
                  Reports
                </Link>
              )}

              {/* Billing */}
              {canManageBilling && (
                <Link href="/settings/billing" className="hover:text-primary transition-colors">
                  Billing
                </Link>
              )}

              {/* Admin */}
              {canManageMembers && (
                <Link href="/organization/members" className="hover:text-primary transition-colors">
                  Members
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <Link
              href="/account/profile"
              className="flex items-center gap-2 text-xs text-text-muted hover:text-primary"
            >
              <span>{user.fullName || user.email}</span>
              {activeRole && (
                <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-primary">
                  {activeRole}
                </span>
              )}
            </Link>
            <Button
              variant="secondary"
              onClick={() => signOut()}
              className="h-8 px-2.5 text-xs font-medium"
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="secondary" className="h-8 px-3 text-xs">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" className="h-8 px-3 text-xs">
                Create Account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
