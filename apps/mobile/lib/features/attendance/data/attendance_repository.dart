import 'dart:async';
import '../../sync/offline_mutation_queue.dart';
import '../domain/attendance_models.dart';

abstract class AttendanceRepositoryContract {
  Future<AttendanceRecordModel?> getActiveShift();
  Future<List<AttendanceRecordModel>> getTodayShifts();
  Future<List<AttendanceRecordModel>> getShiftHistory();
  Future<AttendanceRecordModel> clockIn({
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    String? notes,
  });
  Future<AttendanceRecordModel> clockOut({
    required String attendanceId,
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    String? notes,
  });
}

class AttendanceRepository implements AttendanceRepositoryContract {
  final OfflineMutationQueue mutationQueue;
  final String tenantId;
  final String userId;

  // Local storage cache for offline operation
  final Map<String, AttendanceRecordModel> _localRecords = {};

  AttendanceRepository({
    required this.mutationQueue,
    required this.tenantId,
    required this.userId,
    List<AttendanceRecordModel>? initialRecords,
  }) {
    if (initialRecords != null) {
      for (final r in initialRecords) {
        _localRecords[r.id] = r;
      }
    } else {
      _seedDefaultShifts();
    }
  }

  void _seedDefaultShifts() {
    final now = DateTime.now().toUtc();

    // Seed a completed shift from yesterday
    final yesterday = now.subtract(const Duration(days: 1));
    final yesterdayDateStr = "${yesterday.year}-${yesterday.month.toString().padLeft(2, '0')}-${yesterday.day.toString().padLeft(2, '0')}";
    final yesterdayStart = DateTime.utc(yesterday.year, yesterday.month, yesterday.day, 8, 0);
    final yesterdayEnd = DateTime.utc(yesterday.year, yesterday.month, yesterday.day, 16, 30);

    final recordPast = AttendanceRecordModel(
      id: 'a0000000-0000-0000-0000-000000000002',
      organizationId: tenantId,
      userId: userId,
      date: yesterdayDateStr,
      checkInAt: yesterdayStart,
      checkOutAt: yesterdayEnd,
      checkInLatitude: 37.7749,
      checkInLongitude: -122.4194,
      checkInAccuracyMeters: 10.0,
      checkOutLatitude: 37.7749,
      checkOutLongitude: -122.4194,
      checkOutAccuracyMeters: 10.0,
      status: AttendanceStatus.clockedOut,
      durationSeconds: 30600,
      notes: 'Full day field dispatch completed.',
    );
    _localRecords[recordPast.id] = recordPast;
  }

  @override
  Future<AttendanceRecordModel?> getActiveShift() async {
    for (final r in _localRecords.values) {
      if (r.userId == userId && r.isActive) {
        return r;
      }
    }
    return null;
  }

  @override
  Future<List<AttendanceRecordModel>> getTodayShifts() async {
    final now = DateTime.now().toUtc();
    final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

    final list = _localRecords.values
        .where((r) => r.userId == userId && r.date == todayStr)
        .toList();
    list.sort((a, b) => b.checkInAt.compareTo(a.checkInAt));
    return list;
  }

  @override
  Future<List<AttendanceRecordModel>> getShiftHistory() async {
    final list = _localRecords.values
        .where((r) => r.userId == userId)
        .toList();
    list.sort((a, b) => b.checkInAt.compareTo(a.checkInAt));
    return list;
  }

  @override
  Future<AttendanceRecordModel> clockIn({
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    String? notes,
  }) async {
    // Validate coordinate bounds if provided
    if (latitude != null && (latitude < -90.0 || latitude > 90.0)) {
      throw ArgumentError('Latitude must be between -90 and 90');
    }
    if (longitude != null && (longitude < -180.0 || longitude > 180.0)) {
      throw ArgumentError('Longitude must be between -180 and 180');
    }

    // Check for existing active shift
    final existingActive = await getActiveShift();
    if (existingActive != null) {
      throw StateError('User already has an active attendance session (ID: ${existingActive.id})');
    }

    final now = DateTime.now().toUtc();
    final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
    final shiftId = 'att_${now.millisecondsSinceEpoch}';

    final newRecord = AttendanceRecordModel(
      id: shiftId,
      organizationId: tenantId,
      userId: userId,
      date: todayStr,
      checkInAt: now,
      checkInLatitude: latitude,
      checkInLongitude: longitude,
      checkInAccuracyMeters: accuracyMeters,
      status: AttendanceStatus.clockedIn,
      notes: notes,
    );

    _localRecords[shiftId] = newRecord;

    // Enqueue mutation for durable offline synchronization
    await mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'attendance',
      entityId: shiftId,
      action: 'attendance.clock_in',
      payload: {
        'attendance_id': shiftId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracyMeters,
        'captured_at': now.toIso8601String(),
        'notes': notes,
      },
    );

    return newRecord;
  }

  @override
  Future<AttendanceRecordModel> clockOut({
    required String attendanceId,
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    String? notes,
  }) async {
    final record = _localRecords[attendanceId];
    if (record == null) {
      throw ArgumentError('Attendance record $attendanceId not found');
    }
    if (!record.isActive) {
      throw StateError('Cannot clock out of attendance record in status ${record.status.toDbCode()}');
    }

    final now = DateTime.now().toUtc();
    if (now.isBefore(record.checkInAt)) {
      throw StateError('Clock-out time cannot be earlier than check-in time');
    }

    final durationSec = now.difference(record.checkInAt).inSeconds;

    final updated = record.copyWith(
      checkOutAt: now,
      checkOutLatitude: latitude,
      checkOutLongitude: longitude,
      checkOutAccuracyMeters: accuracyMeters,
      status: AttendanceStatus.clockedOut,
      durationSeconds: durationSec > 0 ? durationSec : 0,
      notes: notes != null
          ? (record.notes != null ? '${record.notes}\n$notes' : notes)
          : record.notes,
    );

    _localRecords[attendanceId] = updated;

    // Enqueue mutation for durable offline sync
    await mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'attendance',
      entityId: attendanceId,
      action: 'attendance.clock_out',
      payload: {
        'attendance_id': attendanceId,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracyMeters,
        'captured_at': now.toIso8601String(),
        'duration_seconds': durationSec > 0 ? durationSec : 0,
        'notes': notes,
      },
    );

    return updated;
  }
}
