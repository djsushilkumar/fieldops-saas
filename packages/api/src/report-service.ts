import {
  ReportType,
  ExportFormat,
  ReportFilterParams,
  TaskReportData,
  TaskReportRow,
  VisitReportData,
  VisitReportRow,
  AttendanceReportData,
  AttendanceReportRow,
  WorkforceReportData,
  WorkforceReportRow,
  ReportAuditLog,
  formatShiftDuration,
} from '@fieldops/types';
import { buildCsv } from './csv';
import type { FieldOpsApiClient } from './index';

export class ReportService {
  constructor(private readonly client: FieldOpsApiClient) {}

  public async getTaskReport(filters?: ReportFilterParams): Promise<TaskReportData> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (filters?.startDate) query.startDate = filters.startDate;
    if (filters?.endDate) query.endDate = filters.endDate;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.teamId) query.teamId = filters.teamId;
    if (filters?.locationId) query.locationId = filters.locationId;
    if (filters?.status) query.status = filters.status;
    if (filters?.priority) query.priority = filters.priority;
    if (filters?.limit) query.limit = filters.limit;
    if (filters?.offset) query.offset = filters.offset;

    return this.client.get<TaskReportData>('/api/v1/reports/tasks', undefined, { query });
  }

  public async getVisitReport(filters?: ReportFilterParams): Promise<VisitReportData> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (filters?.startDate) query.startDate = filters.startDate;
    if (filters?.endDate) query.endDate = filters.endDate;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.locationId) query.locationId = filters.locationId;
    if (filters?.status) query.status = filters.status;
    if (filters?.verificationResult) query.verificationResult = filters.verificationResult;
    if (filters?.limit) query.limit = filters.limit;
    if (filters?.offset) query.offset = filters.offset;

    return this.client.get<VisitReportData>('/api/v1/reports/visits', undefined, { query });
  }

  public async getAttendanceReport(filters?: ReportFilterParams): Promise<AttendanceReportData> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (filters?.startDate) query.startDate = filters.startDate;
    if (filters?.endDate) query.endDate = filters.endDate;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.status) query.status = filters.status;
    if (filters?.isAdjusted !== undefined) query.isAdjusted = filters.isAdjusted;
    if (filters?.limit) query.limit = filters.limit;
    if (filters?.offset) query.offset = filters.offset;

    return this.client.get<AttendanceReportData>('/api/v1/reports/attendance', undefined, { query });
  }

  public async getWorkforceReport(filters?: ReportFilterParams): Promise<WorkforceReportData> {
    const query: Record<string, string | number | boolean | undefined> = {};
    if (filters?.startDate) query.startDate = filters.startDate;
    if (filters?.endDate) query.endDate = filters.endDate;
    if (filters?.userId) query.userId = filters.userId;
    if (filters?.teamId) query.teamId = filters.teamId;
    if (filters?.limit) query.limit = filters.limit;
    if (filters?.offset) query.offset = filters.offset;

    return this.client.get<WorkforceReportData>('/api/v1/reports/workforce', undefined, { query });
  }

  public async logExport(params: {
    reportType: ReportType;
    format: ExportFormat;
    filterParams: Record<string, unknown>;
    rowCount: number;
  }): Promise<ReportAuditLog> {
    return this.client.post<ReportAuditLog>('/api/v1/reports/audit', params);
  }

  // --- CSV Export Formatters ---

  public formatTaskReportCsv(rows: readonly TaskReportRow[]): string {
    const headers = [
      'Task ID',
      'Title',
      'Priority',
      'Status',
      'Assignee Name',
      'Assignee Email',
      'Team',
      'Location',
      'Due Date',
      'Completed Date',
      'Checklists Completed',
      'Checklists Total',
      'Created At',
    ];

    const dataRows = rows.map((r) => [
      r.id,
      r.title,
      r.priority,
      r.status,
      r.assigneeName || '',
      r.assigneeEmail || '',
      r.teamName || '',
      r.locationName || '',
      r.dueAt || '',
      r.completedAt || '',
      r.checklistCompleted,
      r.checklistTotal,
      r.createdAt,
    ]);

    return buildCsv(headers, dataRows);
  }

  public formatVisitReportCsv(rows: readonly VisitReportRow[]): string {
    const headers = [
      'Visit ID',
      'Location Name',
      'Field Worker',
      'Field Worker Email',
      'Scheduled Start',
      'Scheduled End',
      'Check-in At',
      'Check-out At',
      'GPS Verification',
      'Proofs Count',
      'Status',
    ];

    const dataRows = rows.map((r) => [
      r.id,
      r.locationName,
      r.workerName,
      r.workerEmail || '',
      r.scheduledStart,
      r.scheduledEnd || '',
      r.checkedInAt || '',
      r.checkedOutAt || '',
      r.verificationResult || '',
      r.proofsCount,
      r.status,
    ]);

    return buildCsv(headers, dataRows);
  }

  public formatAttendanceReportCsv(rows: readonly AttendanceReportRow[]): string {
    const headers = [
      'Attendance ID',
      'Date',
      'Worker Name',
      'Worker Email',
      'Check-in At',
      'Check-out At',
      'Duration',
      'Status',
      'Manually Adjusted',
      'Adjustment Reason',
    ];

    const dataRows = rows.map((r) => [
      r.id,
      r.date,
      r.workerName,
      r.workerEmail || '',
      r.checkInAt,
      r.checkOutAt || '',
      formatShiftDuration(r.durationSeconds),
      r.status,
      r.isManuallyAdjusted ? 'Yes' : 'No',
      r.adjustmentReason || '',
    ]);

    return buildCsv(headers, dataRows);
  }

  public formatWorkforceReportCsv(rows: readonly WorkforceReportRow[]): string {
    const headers = [
      'Worker ID',
      'Worker Name',
      'Worker Email',
      'Role',
      'Team',
      'Assigned Tasks',
      'Completed Tasks',
      'Scheduled Visits',
      'Completed Visits',
      'Completed Shifts',
      'Total Recorded Activities',
    ];

    const dataRows = rows.map((r) => [
      r.userId,
      r.workerName,
      r.workerEmail,
      r.role,
      r.teamName || '',
      r.assignedTasksCount,
      r.completedTasksCount,
      r.scheduledVisitsCount,
      r.completedVisitsCount,
      r.completedShiftsCount,
      r.totalActivitiesCount,
    ]);

    return buildCsv(headers, dataRows);
  }
}
