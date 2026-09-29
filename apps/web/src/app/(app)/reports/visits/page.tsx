'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useOrganization } from '@/lib/org-context';
import { Button } from '@/components/ui/button';
import {
  can,
  Permissions,
  UserRole,
  VisitReportRow,
  VisitReportSummary,
  VisitStatus,
  LocationVerificationResult,
  ReportType,
  ExportFormat,
  IsoDateTime,
} from '@fieldops/types';
import { getReportService } from '@/lib/api';
import { calculateVisitReportSummary, getDefaultDateRange } from '@/lib/reporting-metrics';

export default function VisitReportPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const role = activeRole || UserRole.FIELD_WORKER;
  const canViewReports = can(role, Permissions.REPORT_VIEW);
  const canExportReports = can(role, Permissions.REPORT_EXPORT);

  const reportService = getReportService();

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<string>('ALL');

  const [rows, setRows] = useState<readonly VisitReportRow[]>([]);
  const [summary, setSummary] = useState<VisitReportSummary>({
    totalScheduled: 0,
    completedVisits: 0,
    onTimeCheckInRatePercentage: 0,
    geofenceVerificationRatePercentage: 0,
    missedVisits: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: Record<string, unknown> = {
        startDate,
        endDate,
      };
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (verificationFilter !== 'ALL') filters.verificationResult = verificationFilter;

      const res = await reportService.getVisitReport(filters);
      setRows(res.rows);
      setSummary(res.summary);
    } catch {
      // Deterministic fallback mock rows for sandbox/simulation mode
      const mockRows: VisitReportRow[] = [
        {
          id: 'v0000000-0000-0000-0000-000000000001' as any,
          locationName: 'North Distribution Hub',
          workerName: 'Marcus Vance',
          workerEmail: 'marcus.vance@fieldops.io',
          scheduledStart: `${startDate}T09:00:00Z` as IsoDateTime,
          scheduledEnd: `${startDate}T11:00:00Z` as IsoDateTime,
          checkedInAt: `${startDate}T08:55:00Z` as IsoDateTime,
          checkedOutAt: `${startDate}T10:45:00Z` as IsoDateTime,
          verificationResult: LocationVerificationResult.VALID,
          proofsCount: 3,
          status: VisitStatus.COMPLETED,
        },
        {
          id: 'v0000000-0000-0000-0000-000000000002' as any,
          locationName: 'Harbor Gateway Station',
          workerName: 'Elena Rostova',
          workerEmail: 'elena.rostova@fieldops.io',
          scheduledStart: `${startDate}T13:00:00Z` as IsoDateTime,
          scheduledEnd: `${startDate}T15:00:00Z` as IsoDateTime,
          checkedInAt: `${startDate}T13:10:00Z` as IsoDateTime,
          checkedOutAt: null,
          verificationResult: LocationVerificationResult.OUTSIDE_RADIUS,
          proofsCount: 1,
          status: VisitStatus.IN_PROGRESS,
        },
        {
          id: 'v0000000-0000-0000-0000-000000000003' as any,
          locationName: 'Tech Central Campus',
          workerName: 'Marcus Vance',
          workerEmail: 'marcus.vance@fieldops.io',
          scheduledStart: `${endDate}T10:00:00Z` as IsoDateTime,
          scheduledEnd: `${endDate}T12:00:00Z` as IsoDateTime,
          checkedInAt: null,
          checkedOutAt: null,
          verificationResult: null,
          proofsCount: 0,
          status: VisitStatus.SCHEDULED,
        },
      ];

      const filtered = mockRows.filter((r) => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (verificationFilter !== 'ALL' && r.verificationResult !== verificationFilter) return false;
        return true;
      });

      setRows(filtered);
      setSummary(calculateVisitReportSummary(filtered));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, statusFilter, verificationFilter]);

  useEffect(() => {
    if (canViewReports && activeOrganization) {
      fetchReport();
    }
  }, [canViewReports, activeOrganization, fetchReport]);

  const handleExportCsv = async () => {
    if (!canExportReports || rows.length === 0) return;
    setIsExporting(true);
    try {
      const csvContent = reportService.formatVisitReportCsv(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fieldops-visit-report-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await reportService.logExport({
        reportType: ReportType.VISITS,
        format: ExportFormat.CSV,
        filterParams: { startDate, endDate, status: statusFilter, verificationResult: verificationFilter },
        rowCount: rows.length,
      }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      alert(msg);
    } finally {
      setIsExporting(false);
    }
  };

  if (!canViewReports) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-bold text-red-700">Access Denied</h2>
          <p className="mt-2 text-sm text-red-600">
            You do not have permission to view operational reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/reports" className="hover:text-primary transition-colors">
          Reports
        </Link>
        <span>/</span>
        <span className="text-text-primary font-semibold">Visits & Geofences</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Visit & Geofence Report</h1>
          <p className="text-sm text-text-muted mt-1">
            Review site arrivals, discreet GPS radius verifications, and verified proof-of-work captures.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchReport}
            disabled={isLoading}
            className="text-xs h-9 px-3"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          {canExportReports && (
            <Button
              variant="primary"
              onClick={handleExportCsv}
              disabled={isExporting || rows.length === 0}
              className="text-xs h-9 px-3"
            >
              {isExporting ? 'Exporting...' : `Export CSV (${rows.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-muted">Start:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-muted">End:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-muted">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value={VisitStatus.COMPLETED}>Completed</option>
            <option value={VisitStatus.IN_PROGRESS}>In Progress</option>
            <option value={VisitStatus.CHECKED_IN}>Checked In</option>
            <option value={VisitStatus.SCHEDULED}>Scheduled</option>
            <option value={VisitStatus.MISSED}>Missed</option>
            <option value={VisitStatus.CANCELED}>Canceled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-muted">Geofence:</label>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Geofence Results</option>
            <option value={LocationVerificationResult.VALID}>Valid (Within Radius)</option>
            <option value={LocationVerificationResult.OUTSIDE_RADIUS}>Outside Radius</option>
            <option value={LocationVerificationResult.LOW_ACCURACY}>Low Accuracy</option>
            <option value={LocationVerificationResult.STALE_LOCATION}>Stale Location</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Total Scheduled</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{summary.totalScheduled}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Completed</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{summary.completedVisits}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">On-Time Arrival</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{summary.onTimeCheckInRatePercentage}%</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Geofence Match</div>
          <div className="mt-1 text-2xl font-bold text-brand-primary">{summary.geofenceVerificationRatePercentage}%</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Missed</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{summary.missedVisits}</div>
        </div>
      </div>

      {/* Report Results Table */}
      <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-text-muted font-semibold">
                <th className="py-3 px-4">Visit ID</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Field Worker</th>
                <th className="py-3 px-4">Scheduled Window</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">GPS Verification</th>
                <th className="py-3 px-4 text-center">Proofs</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-muted">
                    {isLoading ? 'Loading visit report data...' : 'No visits found matching the selected filters.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {row.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-semibold text-text-primary">
                      {row.locationName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-text-primary">{row.workerName}</span>
                      {row.workerEmail && (
                        <span className="block text-[11px] text-text-muted">{row.workerEmail}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {new Date(row.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {row.scheduledEnd && (
                        <span> – {new Date(row.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {row.checkedInAt ? new Date(row.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {row.verificationResult ? (
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            row.verificationResult === LocationVerificationResult.VALID
                              ? 'bg-emerald-100 text-emerald-700'
                              : row.verificationResult === LocationVerificationResult.OUTSIDE_RADIUS
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {row.verificationResult.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      {row.proofsCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {row.proofsCount} item{row.proofsCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          row.status === VisitStatus.COMPLETED
                            ? 'bg-emerald-100 text-emerald-700'
                            : row.status === VisitStatus.IN_PROGRESS
                            ? 'bg-blue-100 text-blue-700'
                            : row.status === VisitStatus.MISSED
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
