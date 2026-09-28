import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService, FieldOpsApiClient } from '../src/index';
import {
  AttendanceId,
  UserId,
  TenantId,
  AttendanceStatus,
  AttendanceRecord,
  AttendanceClockInPayload,
  AttendanceClockOutPayload,
  AdjustAttendancePayload,
  WorkerActivity,
  WorkerActivityType,
} from '@fieldops/types';

describe('AttendanceService', () => {
  let mockClient: FieldOpsApiClient;
  let service: AttendanceService;

  const mockRecord: AttendanceRecord = {
    id: 'a0000000-0000-0000-0000-000000000001' as AttendanceId,
    organizationId: '00000000-0000-0000-0000-000000000001' as TenantId,
    userId: 'e0000000-0000-0000-0000-000000000004' as UserId,
    date: '2026-09-28',
    checkInAt: '2026-09-28T08:00:00.000Z',
    checkOutAt: null,
    checkInLatitude: 37.7749,
    checkInLongitude: -122.4194,
    checkInAccuracyMeters: 12.0,
    status: AttendanceStatus.CLOCKED_IN,
    isManuallyAdjusted: false,
    createdAt: '2026-09-28T08:00:00.000Z',
    updatedAt: '2026-09-28T08:00:00.000Z',
  };

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      setTenantContext: vi.fn(),
      clearTenantContext: vi.fn(),
      getTenantContext: vi.fn(),
    };
    service = new AttendanceService(mockClient);
  });

  it('calls clock-in endpoint and returns active shift', async () => {
    (mockClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRecord);
    const payload: AttendanceClockInPayload = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 10.0,
      notes: 'Morning shift started',
    };

    const result = await service.clockIn(payload);
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/attendance/clock-in', payload);
    expect(result.status).toBe(AttendanceStatus.CLOCKED_IN);
    expect(result.id).toBe(mockRecord.id);
  });

  it('calls clock-out endpoint and returns completed shift', async () => {
    const completedRecord = {
      ...mockRecord,
      status: AttendanceStatus.CLOCKED_OUT,
      checkOutAt: '2026-09-28T16:30:00.000Z',
      durationSeconds: 30600,
    };
    (mockClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(completedRecord);
    const payload: AttendanceClockOutPayload = {
      attendanceId: mockRecord.id,
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 12.0,
    };

    const result = await service.clockOut(payload);
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/attendance/clock-out', payload);
    expect(result.status).toBe(AttendanceStatus.CLOCKED_OUT);
    expect(result.durationSeconds).toBe(30600);
  });

  it('fetches active shift for current user', async () => {
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRecord);

    const result = await service.getActiveShift();
    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/attendance/active');
    expect(result?.id).toBe(mockRecord.id);
  });

  it('adjusts attendance with manager justification', async () => {
    const adjustedRecord: AttendanceRecord = {
      ...mockRecord,
      status: AttendanceStatus.CORRECTED,
      isManuallyAdjusted: true,
      adjustmentReason: 'Cell tower outage prevented app clock-out',
      checkOutAt: '2026-09-28T17:00:00.000Z',
      durationSeconds: 32400,
    };
    (mockClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(adjustedRecord);
    const payload: AdjustAttendancePayload = {
      attendanceId: mockRecord.id,
      checkOutAt: '2026-09-28T17:00:00.000Z',
      reason: 'Cell tower outage prevented app clock-out',
    };

    const result = await service.adjustAttendance(payload);
    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/attendance/adjust', payload);
    expect(result.isManuallyAdjusted).toBe(true);
    expect(result.status).toBe(AttendanceStatus.CORRECTED);
  });

  it('lists attendance records with query filtering', async () => {
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [mockRecord],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const result = await service.listAttendance({ date: '2026-09-28', isAdjusted: false }, { page: 1, pageSize: 20 });
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/v1/attendance',
      undefined,
      expect.objectContaining({
        query: expect.objectContaining({
          date: '2026-09-28',
          isAdjusted: false,
          page: 1,
          pageSize: 20,
        }),
      })
    );
    expect(result.items).toHaveLength(1);
  });

  it('lists worker activity audit ledger', async () => {
    const mockActivity: WorkerActivity = {
      id: 'b0000000-0000-0000-0000-000000000001',
      organizationId: mockRecord.organizationId,
      userId: mockRecord.userId,
      activityType: WorkerActivityType.ATTENDANCE_CHECKIN,
      title: 'Clocked In for Workday',
      description: 'Recorded attendance check-in via mobile app.',
      metadata: {},
      createdAt: '2026-09-28T08:00:00.000Z',
    };
    (mockClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([mockActivity]);

    const activities = await service.listWorkerActivities(mockRecord.userId);
    expect(mockClient.get).toHaveBeenCalledWith(
      '/api/v1/attendance/activities',
      undefined,
      expect.objectContaining({ query: { userId: mockRecord.userId } })
    );
    expect(activities).toHaveLength(1);
    expect(activities[0].activityType).toBe(WorkerActivityType.ATTENDANCE_CHECKIN);
  });
});
