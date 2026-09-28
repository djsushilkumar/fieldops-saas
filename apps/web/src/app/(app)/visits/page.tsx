'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { getVisitService, getLocationService } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Visit,
  VisitStatus,
  Location,
  can,
  Permissions,
  UserRole,
  isVisitOverdue,
  LocationId,
  UserId,
  IsoDateTime,
} from '@fieldops/types';
import { createVisitSchema } from '@fieldops/validation';

export default function VisitsPage() {
  const { user, activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const visitService = getVisitService();
  const locationService = getLocationService();

  const [visits, setVisits] = useState<readonly Visit[]>([]);
  const [locations, setLocations] = useState<readonly Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Schedule Visit Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [locationId, setLocationId] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [scheduledStart, setScheduledStart] = useState<string>('');
  const [scheduledEnd, setScheduledEnd] = useState<string>('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const role = activeRole || UserRole.FIELD_WORKER;
  const canScheduleVisits = can(role, Permissions.VISIT_SCHEDULE);

  const fetchLocations = useCallback(async () => {
    try {
      const locs = await locationService.listLocations({ status: undefined });
      setLocations(locs);
      if (locs.length > 0 && !locationId) {
        setLocationId(locs[0].id);
      }
    } catch {
      // Locations fetch fallback
    }
  }, [locationService, locationId]);

  const fetchVisits = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const filters: Record<string, unknown> = {};
      if (selectedStatus !== 'ALL') {
        filters.status = selectedStatus as VisitStatus;
      }
      if (selectedLocation !== 'ALL') {
        filters.locationId = selectedLocation as LocationId;
      }
      if (onlyOverdue) {
        filters.isOverdue = true;
      }

      const res = await visitService.listVisits(
        filters,
        { page: 1, pageSize: 50 },
        { field: 'scheduledStart', order: 'asc' }
      );
      setVisits(res.items || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load visits.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, selectedLocation, onlyOverdue]);

  useEffect(() => {
    if (activeOrganization) {
      fetchLocations();
      fetchVisits();
    }
  }, [activeOrganization, fetchLocations, fetchVisits]);

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        locationId: locationId as LocationId,
        assignedTo: assignedTo.trim() ? (assignedTo.trim() as UserId) : undefined,
        scheduledStart: new Date(scheduledStart).toISOString() as IsoDateTime,
        scheduledEnd: scheduledEnd ? (new Date(scheduledEnd).toISOString() as IsoDateTime) : undefined,
      };

      const parsed = createVisitSchema.parse(payload);
      await visitService.createVisit(parsed);

      setScheduledStart('');
      setScheduledEnd('');
      setIsScheduleModalOpen(false);
      fetchVisits();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodErr = err as { errors: Array<{ message: string }> };
        setScheduleError(zodErr.errors.map((e) => e.message).join('. '));
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to schedule visit.';
        setScheduleError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: VisitStatus, overdue: boolean) => {
    if (overdue && status !== VisitStatus.COMPLETED && status !== VisitStatus.CANCELED) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          OVERDUE
        </span>
      );
    }

    const styles: Record<VisitStatus, string> = {
      [VisitStatus.SCHEDULED]: 'bg-blue-50 text-blue-700 border-blue-200',
      [VisitStatus.READY]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      [VisitStatus.EN_ROUTE]: 'bg-amber-50 text-amber-700 border-amber-200',
      [VisitStatus.CHECKED_IN]: 'bg-teal-50 text-teal-700 border-teal-200',
      [VisitStatus.IN_PROGRESS]: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      [VisitStatus.CHECKED_OUT]: 'bg-purple-50 text-purple-700 border-purple-200',
      [VisitStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      [VisitStatus.CANCELED]: 'bg-slate-100 text-slate-600 border-slate-200',
      [VisitStatus.MISSED]: 'bg-rose-50 text-rose-700 border-rose-200',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
          styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Field Visits & Verification</h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch, track, and review real-time GPS check-ins, proof of work, and operational completion.
          </p>
        </div>
        {canScheduleVisits && (
          <Button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <span>+ Schedule Visit</span>
          </Button>
        )}
      </div>

      {/* Overview Status Map / Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Live Field Ops Dispatch
            </span>
            <h2 className="text-lg font-bold mt-1">Active Geospatial Monitoring</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Field force arrivals are validated using high-precision geodesic radius checks. Workers outside the authorized site boundary generate auditable location exception records.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
              <span className="block text-2xl font-bold text-white">{visits.length}</span>
              <span className="text-[11px] text-slate-400 font-medium">Total Visits</span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
              <span className="block text-2xl font-bold text-teal-400">
                {visits.filter((v) => v.status === VisitStatus.CHECKED_IN || v.status === VisitStatus.IN_PROGRESS).length}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">On-Site</span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700">
              <span className="block text-2xl font-bold text-emerald-400">
                {visits.filter((v) => v.status === VisitStatus.COMPLETED).length}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value={VisitStatus.SCHEDULED}>Scheduled</option>
            <option value={VisitStatus.READY}>Ready</option>
            <option value={VisitStatus.EN_ROUTE}>En Route</option>
            <option value={VisitStatus.CHECKED_IN}>Checked In</option>
            <option value={VisitStatus.IN_PROGRESS}>In Progress</option>
            <option value={VisitStatus.CHECKED_OUT}>Checked Out</option>
            <option value={VisitStatus.COMPLETED}>Completed</option>
            <option value={VisitStatus.CANCELED}>Canceled</option>
            <option value={VisitStatus.MISSED}>Missed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Location:</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(e) => setOnlyOverdue(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-semibold">Only Overdue</span>
          </label>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Visits Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading scheduled visits...</div>
        ) : visits.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">No field visits scheduled</p>
            <p className="text-xs text-slate-500 mt-1">
              Create a visit appointment to dispatch a field worker to an authorized location.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                  <th className="py-3 px-4">Visit ID</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4">Assigned Worker</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visits.map((vis) => {
                  const overdue = isVisitOverdue(vis);
                  return (
                    <tr key={vis.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        <Link href={`/visits/${vis.id}`} className="text-blue-600 hover:underline font-semibold">
                          {vis.id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {vis.location ? vis.location.name : 'Authorized Site'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{new Date(vis.scheduledStart).toLocaleString()}</div>
                        {vis.scheduledEnd && (
                          <div className="text-[10px] text-slate-400">
                            to {new Date(vis.scheduledEnd).toLocaleTimeString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {vis.assignee ? vis.assignee.fullName : vis.assignedTo ? 'Field Worker' : 'Unassigned'}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(vis.status, overdue)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/visits/${vis.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Visit Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Schedule Field Visit</h2>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleVisit} className="p-6 flex flex-col gap-4">
              {scheduleError && (
                <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-700">
                  {scheduleError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Location *
                </label>
                <select
                  required
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.allowedRadiusMeters}m radius)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assignee User ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Worker UUID or leave unassigned"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Start *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledStart}
                    onChange={(e) => setScheduledStart(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled End (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledEnd}
                    onChange={(e) => setScheduledEnd(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Scheduling...' : 'Schedule Visit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
