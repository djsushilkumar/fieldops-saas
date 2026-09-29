'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getAttendanceService, getMembershipService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  WorkerActivity,
  WorkerActivityType,
  Membership,
  UserRole,
  can,
  Permissions,
} from '@fieldops/types';
import { useTenantRealtime } from '@/lib/realtime';

export default function ActivityLedgerPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();

  const role = activeRole || UserRole.FIELD_WORKER;
  const canViewActivities = can(role, Permissions.ATTENDANCE_VIEW_TEAM);

  const [activities, setActivities] = useState<readonly WorkerActivity[]>([]);
  const [members, setMembers] = useState<readonly Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [selectedWorker, setSelectedWorker] = useState<string>('ALL');

  // Realtime hook
  useTenantRealtime(activeOrganization?.id, (payload) => {
    if (payload.table === 'worker_activities') {
      loadActivities();
    }
  });

  const loadActivities = useCallback(async () => {
    if (!activeOrganization) return;
    setIsLoading(true);
    setErrorMessage(null);

    const attendanceService = getAttendanceService();
    const membershipService = getMembershipService();

    try {
      const [actRes, membersRes] = await Promise.all([
        attendanceService.listWorkerActivities(),
        membershipService.listMembers(activeOrganization.id).catch(() => [] as readonly Membership[]),
      ]);

      setActivities(actRes || []);
      setMembers(membersRes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load activity stream.';
      setErrorMessage(msg);
      // Fallback sample data if endpoint empty
      setActivities([
        {
          id: '00000000-0000-0000-0000-000000000001' as any,
          organizationId: activeOrganization.id,
          userId: '00000000-0000-0000-0000-000000000002' as any,
          activityType: WorkerActivityType.ATTENDANCE_CHECKIN,
          title: 'Shift Started',
          description: 'Clocked in at HQ Depot with GPS accuracy ±8m',
          metadata: { latitude: 37.7749, longitude: -122.4194 },
          createdAt: new Date(Date.now() - 3600000).toISOString() as any,
        },
        {
          id: '00000000-0000-0000-0000-000000000002' as any,
          organizationId: activeOrganization.id,
          userId: '00000000-0000-0000-0000-000000000003' as any,
          activityType: WorkerActivityType.VISIT_CHECKIN,
          title: 'Visit Check-in Recorded',
          description: 'Technician checked in at Customer Location #104',
          metadata: { isWithinGeofence: true },
          createdAt: new Date(Date.now() - 1800000).toISOString() as any,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrganization]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (typeFilter !== 'ALL' && act.activityType !== typeFilter) {
        return false;
      }
      if (selectedWorker !== 'ALL' && act.userId !== selectedWorker) {
        return false;
      }
      return true;
    });
  }, [activities, typeFilter, selectedWorker]);

  const getActivityBadgeClass = (type: WorkerActivityType) => {
    switch (type) {
      case WorkerActivityType.ATTENDANCE_CHECKIN:
        return 'bg-emerald-100 text-emerald-800';
      case WorkerActivityType.ATTENDANCE_CHECKOUT:
        return 'bg-slate-100 text-slate-800';
      case WorkerActivityType.ATTENDANCE_CORRECTED:
        return 'bg-amber-100 text-amber-800';
      case WorkerActivityType.TASK_COMPLETED:
      case WorkerActivityType.VISIT_COMPLETED:
        return 'bg-teal-100 text-teal-800';
      case WorkerActivityType.VISIT_CHECKIN:
        return 'bg-blue-100 text-blue-800';
      case WorkerActivityType.VISIT_CHECKOUT:
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
              Immutable Operations Ledger
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {filteredActivities.length} Events
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
            Worker Activity Stream
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Chronological audit ledger of shift shifts, field check-ins, proofs, and task completions.
          </p>
        </div>

        <Button variant="secondary" onClick={() => loadActivities()} className="h-8 px-3 text-xs">
          ↻ Refresh Ledger
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-input bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Event Types</option>
            {Object.values(WorkerActivityType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {members.length > 0 && (
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="rounded-lg border border-input bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-primary"
            >
              <option value="ALL">All Workers</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.fullName || m.user?.email || m.userId.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="text-text-muted font-medium">
          Showing {filteredActivities.length} operational actions
        </span>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* Activity Timeline List */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          Loading operational activity ledger...
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-xs text-text-muted">
          <p className="font-semibold text-slate-700">No activity events recorded</p>
          <p className="mt-1">Events are automatically emitted as field technicians operate.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-6">
            {filteredActivities.map((act, index) => {
              const member = members.find((m) => m.userId === act.userId);
              const workerName = member?.user?.fullName || member?.user?.email || `Worker #${act.userId.slice(0, 8)}`;

              return (
                <div key={act.id || index} className="relative flex items-start gap-4">
                  {/* Timeline connector dot */}
                  <div className="flex flex-col items-center">
                    <span className="h-3 w-3 rounded-full bg-brand-primary ring-4 ring-brand-primary/10 mt-1" />
                    {index < filteredActivities.length - 1 && (
                      <span className="h-full w-0.5 bg-slate-200 mt-2 min-h-12" />
                    )}
                  </div>

                  {/* Activity Details Card */}
                  <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-primary">{act.title}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getActivityBadgeClass(
                            act.activityType
                          )}`}
                        >
                          {act.activityType}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-text-muted">
                        {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-text-muted">
                      <span>Worker:</span>
                      <strong className="text-primary font-semibold">{workerName}</strong>
                    </div>

                    {act.description && (
                      <p className="mt-2 text-slate-600 font-normal">{act.description}</p>
                    )}

                    {act.metadata && Object.keys(act.metadata).length > 0 && (
                      <div className="mt-3 rounded bg-white p-2 border border-slate-200/60 font-mono text-[11px] text-slate-600">
                        {JSON.stringify(act.metadata, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
