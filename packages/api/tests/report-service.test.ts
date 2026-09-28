import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportService, FieldOpsApiClient } from '../src/index';
import {
  ReportType,
  ExportFormat,
  Priority,
  TaskStatus,
  VisitStatus,
  LocationVerificationResult,
  AttendanceStatus,
  UserRole,
  IsoDateTime,
} from '@fieldops/types';

describe('ReportService', () => {
  let mockClient: FieldOpsApiClient;
  let service: ReportService;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as FieldOpsApiClient;
    service = new ReportService(mockClient);
  });

  it('queries task report with filter parameters', async () => {
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      summary: { totalTasks: 1 },
      rows: [],
      totalRows: 0,
    });

    await service.getTaskReport({
      startDate: '2026-09-01',
      endDate: '2026-09-28',
      status: TaskStatus.COMPLETED,
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/v1/reports/tasks',
      undefined,
      expect.objectContaining({
        query: {
          startDate: '2026-09-01',
          endDate: '2026-09-28',
          status: TaskStatus.COMPLETED,
        },
      })
    );
  });

  it('queries visit report with geofence verification filters', async () => {
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      summary: { totalScheduled: 1 },
      rows: [],
      totalRows: 0,
    });

    await service.getVisitReport({
      verificationResult: LocationVerificationResult.VALID,
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/v1/reports/visits',
      undefined,
      expect.objectContaining({
        query: {
          verificationResult: LocationVerificationResult.VALID,
        },
      })
    );
  });

  it('posts report audit log entry', async () => {
    (mockClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'audit-1',
      reportType: ReportType.TASKS,
    });

    await service.logExport({
      reportType: ReportType.TASKS,
      format: ExportFormat.CSV,
      filterParams: { date: '2026-09-28' },
      rowCount: 42,
    });

    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/reports/audit', {
      reportType: ReportType.TASKS,
      format: ExportFormat.CSV,
      filterParams: { date: '2026-09-28' },
      rowCount: 42,
    });
  });

  it('formats task report rows into RFC 4180 CSV correctly', () => {
    const csv = service.formatTaskReportCsv([
      {
        id: 't-1' as any,
        title: 'Fix boiler, Unit 2',
        priority: Priority.HIGH,
        status: TaskStatus.COMPLETED,
        assigneeName: 'Marcus Vance',
        assigneeEmail: 'marcus@fieldops.io',
        teamName: 'Crew 1',
        locationName: 'Plant 4',
        dueAt: '2026-09-28T18:00:00Z' as IsoDateTime,
        completedAt: '2026-09-28T17:00:00Z' as IsoDateTime,
        checklistCompleted: 3,
        checklistTotal: 3,
        createdAt: '2026-09-28T08:00:00Z' as IsoDateTime,
      },
    ]);

    expect(csv).toContain('Task ID,Title,Priority,Status');
    expect(csv).toContain('"Fix boiler, Unit 2"');
    expect(csv).toContain('marcus@fieldops.io');
  });

  it('formats visit report rows into RFC 4180 CSV without raw GPS coordinates', () => {
    const csv = service.formatVisitReportCsv([
      {
        id: 'v-1' as any,
        locationName: 'HQ Facility',
        workerName: 'Elena Rostova',
        workerEmail: 'elena@fieldops.io',
        scheduledStart: '2026-09-28T09:00:00Z' as IsoDateTime,
        scheduledEnd: '2026-09-28T11:00:00Z' as IsoDateTime,
        checkedInAt: '2026-09-28T08:55:00Z' as IsoDateTime,
        checkedOutAt: '2026-09-28T10:45:00Z' as IsoDateTime,
        verificationResult: LocationVerificationResult.VALID,
        proofsCount: 2,
        status: VisitStatus.COMPLETED,
      },
    ]);

    expect(csv).toContain('Visit ID,Location Name,Field Worker');
    expect(csv).toContain('HQ Facility');
    expect(csv).toContain('VALID');
    // Ensure raw coordinates are not present in header
    expect(csv).not.toContain('Latitude');
    expect(csv).not.toContain('Longitude');
  });
});
