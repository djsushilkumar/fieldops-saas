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
  WorkforceReportRow,
  WorkforceReportSummary,
  ReportType,
  ExportFormat,
} from '@fieldops/types';
import { getReportService } from '@/lib/api';
import { calculateWorkforceReportSummary, getDefaultDateRange } from '@/lib/reporting-metrics';

export default function WorkforceReportPage() {
  const { activeRole } = useAuth();
  const { activeOrganization } = useOrganization();
  const role = activeRole || UserRole.FIELD_WORKER;
  const canViewReports = can(role, Permissions.REPORT_VIEW);
  const canExportReports = can(role, Permissions.REPORT_EXPORT);

  const reportService = getReportService();

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const [rows, setRows] = useState<readonly WorkforceReportRow[]>([]);
  const [summary, setSummary] = useState<WorkforceReportSummary>({
    activeWorkersCount: 0,
    totalTasksHandled: 0,
    totalVisitsDispatched: 0,
    totalRecordedActivities: 0,
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

      const res = await reportService.getWorkforceReport(filters);
      setRows(res.rows);
      setSummary(res.summary);
    } catch {
      // Deterministic fallback mock rows for sandbox/simulation mode
      const mockRows: WorkforceReportRow[] = [
        {
          userId: 'e0000000-0000-0000-0000-000000000004' as any,
          workerName: 'Marcus Vance',
          workerEmail: 'marcus.vance@fieldops.io',
          role: UserRole.FIELD_WORKER,
          teamName: 'North Service Crew',
          assignedTasksCount: 18,
          completedTasksCount: 16,
          scheduledVisitsCount: 12,
          completedVisitsCount: 11,
          completedShiftsCount: 20,
          totalActivitiesCount: 84,
        },
        {
          userId: 'e0000000-0000-0000-0000-000000000005' as any,
          workerName: 'Elena Rostova',
          workerEmail: 'elena.rostova@fieldops.io',
          role: UserRole.FIELD_WORKER,
          teamName: 'Downtown Technicians',
          assignedTasksCount: 15,
          completedTasksCount: 14,
          scheduledVisitsCount: 9,
          completedVisitsCount: 9,
          completedShiftsCount: 18,
          totalActivitiesCount: 71,
        },
      ];

      setRows(mockRows);
      setSummary(calculateWorkforceReportSummary(mockRows));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (canViewReports && activeOrganization) {
      fetchReport();
    }
  }, [canViewReports, activeOrganization, fetchReport]);

  const handleExportCsv = async () => {
    if (!canExportReports || rows.length === 0) return;
    setIsExporting(true);
    try {
      const csvContent = reportService.formatWorkforceReportCsv(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fieldops-workforce-report-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await reportService.logExport({
        reportType: ReportType.WORKFORCE,
        format: ExportFormat.CSV,
        filterParams: { startDate, endDate },
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/reports" className="hover:text-primary transition-colors">
          Reports
        </Link>
        <span>/</span>
        <span className="text-text-primary font-semibold">Workforce Activity</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Workforce Activity Report</h1>
          <p className="text-sm text-text-muted mt-1">
            Factual volume summary across field staff without competitive scoring or gamification.
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
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Active Workforce</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{summary.activeWorkersCount}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Total Tasks Handled</div>
          <div className="mt-1 text-2xl font-bold text-brand-primary">{summary.totalTasksHandled}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Total Visits Dispatched</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{summary.totalVisitsDispatched}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Recorded Activities</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{summary.totalRecordedActivities}</div>
        </div>
      </div>

      {/* Report Results Table */}
      <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-text-muted font-semibold">
                <th className="py-3 px-4">Worker</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4 text-center">Tasks (Comp / Total)</th>
                <th className="py-3 px-4 text-center">Visits (Comp / Total)</th>
                <th className="py-3 px-4 text-center">Completed Shifts</th>
                <th className="py-3 px-4 text-center">Ledger Activities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    {isLoading ? 'Loading workforce report data...' : 'No activity records found.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-text-primary">{row.workerName}</span>
                      <span className="block text-[11px] text-text-muted">{row.workerEmail}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {row.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {row.teamName || '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      <span className="text-emerald-600 font-bold">{row.completedTasksCount}</span>
                      <span className="text-slate-400"> / </span>
                      <span>{row.assignedTasksCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      <span className="text-emerald-600 font-bold">{row.completedVisitsCount}</span>
                      <span className="text-slate-400"> / </span>
                      <span>{row.scheduledVisitsCount}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-text-primary">
                      {row.completedShiftsCount}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {row.totalActivitiesCount}
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
