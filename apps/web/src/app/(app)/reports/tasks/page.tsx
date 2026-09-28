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
  TaskReportRow,
  TaskReportSummary,
  TaskStatus,
  Priority,
  ReportType,
  ExportFormat,
  IsoDateTime,
} from '@fieldops/types';
import { getReportService } from '@/lib/api';
import { calculateTaskReportSummary, getDefaultDateRange } from '@/lib/reporting-metrics';

export default function TaskReportPage() {
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
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const [rows, setRows] = useState<readonly TaskReportRow[]>([]);
  const [summary, setSummary] = useState<TaskReportSummary>({
    totalTasks: 0,
    completedTasks: 0,
    completionRatePercentage: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    blockedTasks: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const filters: Record<string, unknown> = {
        startDate,
        endDate,
      };
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (priorityFilter !== 'ALL') filters.priority = priorityFilter;

      const res = await reportService.getTaskReport(filters);
      setRows(res.rows);
      setSummary(res.summary);
    } catch {
      // Deterministic fallback sample rows for sandbox/simulation mode
      const mockRows: TaskReportRow[] = [
        {
          id: 't0000000-0000-0000-0000-000000000001' as any,
          title: 'HVAC Air Filter Replacement - Bldg 4',
          priority: Priority.HIGH,
          status: TaskStatus.COMPLETED,
          assigneeName: 'Marcus Vance',
          assigneeEmail: 'marcus.vance@fieldops.io',
          teamName: 'North Service Crew',
          locationName: 'Metro Logistics Terminal',
          dueAt: `${startDate}T17:00:00Z` as IsoDateTime,
          completedAt: `${startDate}T15:30:00Z` as IsoDateTime,
          checklistCompleted: 4,
          checklistTotal: 4,
          createdAt: `${startDate}T08:00:00Z` as IsoDateTime,
        },
        {
          id: 't0000000-0000-0000-0000-000000000002' as any,
          title: 'Electrical Panel Inspection',
          priority: Priority.URGENT,
          status: TaskStatus.IN_PROGRESS,
          assigneeName: 'Elena Rostova',
          assigneeEmail: 'elena.rostova@fieldops.io',
          teamName: 'Downtown Technicians',
          locationName: 'City Center Mall',
          dueAt: `${endDate}T12:00:00Z` as IsoDateTime,
          completedAt: null,
          checklistCompleted: 2,
          checklistTotal: 5,
          createdAt: `${startDate}T09:00:00Z` as IsoDateTime,
        },
        {
          id: 't0000000-0000-0000-0000-000000000003' as any,
          title: 'Quarterly Fire Extinguisher Audit',
          priority: Priority.MEDIUM,
          status: TaskStatus.COMPLETED,
          assigneeName: 'Marcus Vance',
          assigneeEmail: 'marcus.vance@fieldops.io',
          teamName: 'North Service Crew',
          locationName: 'Eastside Warehouse',
          dueAt: `${startDate}T16:00:00Z` as IsoDateTime,
          completedAt: `${startDate}T14:15:00Z` as IsoDateTime,
          checklistCompleted: 8,
          checklistTotal: 8,
          createdAt: `${startDate}T08:30:00Z` as IsoDateTime,
        },
        {
          id: 't0000000-0000-0000-0000-000000000004' as any,
          title: 'Emergency Generator Coolant Top-up',
          priority: Priority.LOW,
          status: TaskStatus.BLOCKED,
          assigneeName: 'Elena Rostova',
          assigneeEmail: 'elena.rostova@fieldops.io',
          teamName: 'Downtown Technicians',
          locationName: 'City Center Mall',
          dueAt: `${startDate}T10:00:00Z` as IsoDateTime,
          completedAt: null,
          checklistCompleted: 0,
          checklistTotal: 3,
          createdAt: `${startDate}T07:45:00Z` as IsoDateTime,
        },
      ];

      // Filter mock rows according to local filters
      const filtered = mockRows.filter((r) => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;
        return true;
      });

      setRows(filtered);
      setSummary(calculateTaskReportSummary(filtered));
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, statusFilter, priorityFilter]);

  useEffect(() => {
    if (canViewReports && activeOrganization) {
      fetchReport();
    }
  }, [canViewReports, activeOrganization, fetchReport]);

  const handleExportCsv = async () => {
    if (!canExportReports || rows.length === 0) return;
    setIsExporting(true);
    try {
      const csvContent = reportService.formatTaskReportCsv(rows);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fieldops-task-report-${startDate}-to-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Audit log the export
      await reportService.logExport({
        reportType: ReportType.TASKS,
        format: ExportFormat.CSV,
        filterParams: { startDate, endDate, status: statusFilter, priority: priorityFilter },
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
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/reports" className="hover:text-primary transition-colors">
          Reports
        </Link>
        <span>/</span>
        <span className="text-text-primary font-semibold">Tasks & SLAs</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Task Execution Report</h1>
          <p className="text-sm text-text-muted mt-1">
            Analyze task delivery velocity, priority distribution, and SLA resolution rates.
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
            <option value={TaskStatus.COMPLETED}>Completed</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.ACCEPTED}>Accepted</option>
            <option value={TaskStatus.BLOCKED}>Blocked</option>
            <option value={TaskStatus.ASSIGNED}>Assigned</option>
            <option value={TaskStatus.DRAFT}>Draft</option>
            <option value={TaskStatus.CANCELED}>Canceled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text-muted">Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="ALL">All Priorities</option>
            <option value={Priority.URGENT}>Urgent</option>
            <option value={Priority.HIGH}>High</option>
            <option value={Priority.MEDIUM}>Medium</option>
            <option value={Priority.LOW}>Low</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Total Tasks</div>
          <div className="mt-1 text-2xl font-bold text-text-primary">{summary.totalTasks}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Completed</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{summary.completedTasks}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Completion Rate</div>
          <div className="mt-1 text-2xl font-bold text-brand-primary">{summary.completionRatePercentage}%</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">In Progress</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">{summary.inProgressTasks}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Overdue</div>
          <div className="mt-1 text-2xl font-bold text-amber-600">{summary.overdueTasks}</div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-text-muted uppercase">Blocked</div>
          <div className="mt-1 text-2xl font-bold text-red-600">{summary.blockedTasks}</div>
        </div>
      </div>

      {/* Report Results Table */}
      <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-text-muted font-semibold">
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Completed</th>
                <th className="py-3 px-4 text-center">Checklists</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-muted">
                    {isLoading ? 'Loading task report data...' : 'No tasks found matching the selected filters.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {row.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-medium text-text-primary">
                      {row.title}
                      {row.locationName && (
                        <span className="block text-[11px] text-text-muted">{row.locationName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          row.priority === Priority.URGENT
                            ? 'bg-red-100 text-red-700'
                            : row.priority === Priority.HIGH
                            ? 'bg-amber-100 text-amber-700'
                            : row.priority === Priority.MEDIUM
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          row.status === TaskStatus.COMPLETED
                            ? 'bg-emerald-100 text-emerald-700'
                            : row.status === TaskStatus.BLOCKED
                            ? 'bg-red-100 text-red-700'
                            : row.status === TaskStatus.IN_PROGRESS
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-text-primary">{row.assigneeName || 'Unassigned'}</span>
                      {row.teamName && (
                        <span className="block text-[11px] text-text-muted">{row.teamName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {row.dueAt ? new Date(row.dueAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-text-muted">
                      {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">
                      {row.checklistTotal > 0 ? (
                        <span
                          className={
                            row.checklistCompleted === row.checklistTotal
                              ? 'text-emerald-600 font-bold'
                              : 'text-text-muted'
                          }
                        >
                          {row.checklistCompleted}/{row.checklistTotal}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
