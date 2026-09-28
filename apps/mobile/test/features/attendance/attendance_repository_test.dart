import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/attendance/data/attendance_repository.dart';
import 'package:fieldops_mobile/features/attendance/domain/attendance_models.dart';
import 'package:fieldops_mobile/features/sync/offline_mutation_queue.dart';

void main() {
  group('AttendanceRepository Unit Tests', () {
    late OfflineMutationQueue queue;
    late AttendanceRepository repo;
    const testTenant = '00000000-0000-0000-0000-000000000001';
    const testUser = 'e0000000-0000-0000-0000-000000000004';

    setUp(() {
      queue = OfflineMutationQueue();
      repo = AttendanceRepository(
        mutationQueue: queue,
        tenantId: testTenant,
        userId: testUser,
        initialRecords: [], // empty for isolated tests
      );
    });

    test('clockIn creates active shift and enqueues offline mutation', () async {
      expect(await repo.getActiveShift(), isNull);

      final record = await repo.clockIn(
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 10.5,
        notes: 'Clocking in at HQ depot.',
      );

      expect(record.status, AttendanceStatus.clockedIn);
      expect(record.isActive, isTrue);
      expect(record.checkInLatitude, 37.7749);
      expect(record.checkInLongitude, -122.4194);
      expect(record.checkInAccuracyMeters, 10.5);

      final active = await repo.getActiveShift();
      expect(active?.id, record.id);

      // Verify offline mutation queueing
      expect(queue.pendingCount, 1);
      final mutation = queue.getPendingMutations().first;
      expect(mutation.action, 'attendance.clock_in');
      expect(mutation.entityType, 'attendance');
      expect(mutation.entityId, record.id);
      expect(mutation.payload['notes'], 'Clocking in at HQ depot.');
    });

    test('clockIn throws if an active shift is already open', () async {
      await repo.clockIn(
        latitude: 37.7749,
        longitude: -122.4194,
      );

      expect(
        () => repo.clockIn(latitude: 37.7749, longitude: -122.4194),
        throwsA(isA<StateError>().having(
          (e) => e.message,
          'message',
          contains('already has an active attendance session'),
        )),
      );
    });

    test('clockIn validates coordinate bounds', () async {
      expect(
        () => repo.clockIn(latitude: 95.0, longitude: -122.0),
        throwsArgumentError,
      );
      expect(
        () => repo.clockIn(latitude: 37.0, longitude: 195.0),
        throwsArgumentError,
      );
    });

    test('clockOut calculates duration and enqueues offline mutation', () async {
      final clockInTime = DateTime.now().toUtc().subtract(const Duration(hours: 4));
      final initialRecord = AttendanceRecordModel(
        id: 'shift_manual_01',
        organizationId: testTenant,
        userId: testUser,
        date: '2026-09-28',
        checkInAt: clockInTime,
        status: AttendanceStatus.clockedIn,
      );

      repo = AttendanceRepository(
        mutationQueue: queue,
        tenantId: testTenant,
        userId: testUser,
        initialRecords: [initialRecord],
      );

      final completed = await repo.clockOut(
        attendanceId: 'shift_manual_01',
        latitude: 37.7750,
        longitude: -122.4190,
        accuracyMeters: 8.0,
        notes: 'Shift finished on schedule.',
      );

      expect(completed.status, AttendanceStatus.clockedOut);
      expect(completed.isCompleted, isTrue);
      expect(completed.durationSeconds, greaterThanOrEqualTo(4 * 3600));
      expect(completed.checkOutLatitude, 37.7750);

      // Verify active shift is now cleared
      expect(await repo.getActiveShift(), isNull);

      // Verify offline queue entry
      expect(queue.pendingCount, 1);
      final mutation = queue.getPendingMutations().first;
      expect(mutation.action, 'attendance.clock_out');
      expect(mutation.entityId, 'shift_manual_01');
      expect(mutation.payload['duration_seconds'], completed.durationSeconds);
    });

    test('clockOut throws when record is not active', () async {
      final initialRecord = AttendanceRecordModel(
        id: 'shift_closed_01',
        organizationId: testTenant,
        userId: testUser,
        date: '2026-09-28',
        checkInAt: DateTime.now().toUtc().subtract(const Duration(hours: 5)),
        checkOutAt: DateTime.now().toUtc().subtract(const Duration(hours: 1)),
        status: AttendanceStatus.clockedOut,
      );

      repo = AttendanceRepository(
        mutationQueue: queue,
        tenantId: testTenant,
        userId: testUser,
        initialRecords: [initialRecord],
      );

      expect(
        () => repo.clockOut(attendanceId: 'shift_closed_01'),
        throwsA(isA<StateError>().having(
          (e) => e.message,
          'message',
          contains('Cannot clock out of attendance record in status CLOCKED_OUT'),
        )),
      );
    });
  });
}
