'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';
import { can, Permissions, UserRole } from '@fieldops/types';

export function AppHeader() {
  const { authState, user, activeRole, signOut } = useAuth();
  const { activeOrganization } = useOrganization();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAuthenticated = authState === 'AUTHENTICATED' && user;
  const role = activeRole || UserRole.FIELD_WORKER;

  const canManageMembers = can(role, Permissions.MEMBER_INVITE);
  const canViewMap = can(role, Permissions.LOCATION_VIEW_ALL) || can(role, Permissions.LOCATION_VIEW_TEAM);
  const canViewWorkforce = can(role, Permissions.MEMBER_PROFILE_VIEW_TEAM);
  const canViewReports = can(role, Permissions.REPORT_VIEW);
  const canManageBilling = role === UserRole.OWNER || role === UserRole.ADMIN;

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:px-6">
        {/* Left: Brand Logo & Desktop Org Selector */}
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" onClick={closeMobileMenu} className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-primary">FieldOps</span>
          </Link>

          {isAuthenticated && activeOrganization && (
            <div className="hidden lg:flex items-center gap-4 text-sm font-medium">
              <Link
                href="/org/select"
                className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-slate-200 transition-colors"
              >
                <span className="font-normal text-text-muted">Org:</span>
                <span className="max-w-[120px] truncate">{activeOrganization.name}</span>
              </Link>

              {/* Desktop Nav */}
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

        {/* Right: User Profile & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated ? (
            <>
              {/* Desktop User Info */}
              <div className="hidden lg:flex items-center gap-3">
                <Link
                  href="/account/profile"
                  className="flex items-center gap-2 text-xs text-text-muted hover:text-primary"
                >
                  <span className="max-w-[150px] truncate">{user.fullName || user.email}</span>
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

              {/* Mobile Hamburger Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex lg:hidden items-center justify-center rounded-lg p-2 text-primary hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link href="/login">
                <Button variant="secondary" className="h-8 px-2.5 sm:px-3 text-xs">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" className="h-8 px-2.5 sm:px-3 text-xs whitespace-nowrap">
                  Create Account
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer / Dropdown */}
      {isAuthenticated && isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-surface px-4 py-4 shadow-lg animate-in slide-in-from-top-2 duration-150">
          {/* Active Org Banner */}
          {activeOrganization && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 p-2.5 border border-border">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-text-muted">Active Workspace</span>
                <span className="text-xs font-semibold text-primary">{activeOrganization.name}</span>
              </div>
              <Link
                href="/org/select"
                onClick={closeMobileMenu}
                className="rounded bg-white border border-border px-2 py-1 text-[11px] font-medium text-primary hover:bg-slate-50"
              >
                Switch
              </Link>
            </div>
          )}

          {/* Nav Categories */}
          <div className="space-y-4">
            {/* Operations */}
            <div>
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Operations
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs font-medium">
                <Link
                  href="/dashboard"
                  onClick={closeMobileMenu}
                  className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                >
                  📊 Dashboard
                </Link>
                <Link
                  href="/tasks"
                  onClick={closeMobileMenu}
                  className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                >
                  ✓ Tasks
                </Link>
                <Link
                  href="/visits"
                  onClick={closeMobileMenu}
                  className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                >
                  📍 Visits
                </Link>
                <Link
                  href="/calendar"
                  onClick={closeMobileMenu}
                  className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                >
                  📅 Calendar
                </Link>
                {canViewMap && (
                  <Link
                    href="/map"
                    onClick={closeMobileMenu}
                    className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                  >
                    🗺️ Live Map
                  </Link>
                )}
                <Link
                  href="/locations"
                  onClick={closeMobileMenu}
                  className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                >
                  📌 Locations
                </Link>
              </div>
            </div>

            {/* Workforce */}
            <div>
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Workforce
              </p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs font-medium">
                <Link
                  href="/attendance"
                  onClick={closeMobileMenu}
                  className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                >
                  ⏱️ Attendance
                </Link>
                {canViewWorkforce && (
                  <>
                    <Link
                      href="/employees"
                      onClick={closeMobileMenu}
                      className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                    >
                      👥 Employees
                    </Link>
                    <Link
                      href="/teams"
                      onClick={closeMobileMenu}
                      className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                    >
                      🏷️ Teams
                    </Link>
                    <Link
                      href="/activity"
                      onClick={closeMobileMenu}
                      className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                    >
                      📜 Activity Log
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Administration & Reporting */}
            {(canViewReports || canManageBilling || canManageMembers) && (
              <div>
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Management
                </p>
                <div className="mt-1 grid grid-cols-2 gap-1 text-xs font-medium">
                  {canViewReports && (
                    <Link
                      href="/reports"
                      onClick={closeMobileMenu}
                      className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                    >
                      📈 Reports
                    </Link>
                  )}
                  {canManageBilling && (
                    <Link
                      href="/settings/billing"
                      onClick={closeMobileMenu}
                      className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                    >
                      💳 Billing & Plan
                    </Link>
                  )}
                  {canManageMembers && (
                    <Link
                      href="/organization/members"
                      onClick={closeMobileMenu}
                      className="rounded-md px-2.5 py-2 text-primary hover:bg-slate-100 transition-colors"
                    >
                      🔑 Members
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Mobile User Profile & Sign Out Footer */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between pb-3">
                <Link
                  href="/account/profile"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-2 text-xs text-text-muted hover:text-primary"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
                    {(user.fullName || user.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-primary">{user.fullName || user.email}</span>
                    {activeRole && (
                      <span className="text-[10px] font-bold text-brand-primary">{activeRole}</span>
                    )}
                  </div>
                </Link>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  closeMobileMenu();
                  signOut();
                }}
                className="w-full justify-center text-xs h-9"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
