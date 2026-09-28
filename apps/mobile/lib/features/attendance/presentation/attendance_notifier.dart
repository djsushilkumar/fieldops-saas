import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_notifier.dart';
import '../../sync/offline_mutation_queue.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_models.dart';

final offlineMutationQueueProvider = Provider<OfflineMutationQueue>((ref) {
  return OfflineMutationQueue();
});

final attendanceRepositoryProvider = Provider<AttendanceRepositoryContract>((ref) {
  final authState = ref.watch(authNotifierProvider);
  final queue = ref.watch(offlineMutationQueueProvider);
  final tenantId = authState.activeMembership?.organizationId ?? '00000000-0000-0000-0000-000000000001';
  final userId = authState.user?.id ?? 'e0000000-0000-0000-0000-000000000004';

  return AttendanceRepository(
    mutationQueue: queue,
    tenantId: tenantId,
    userId: userId,
  );
});

class AttendanceState {
  final AttendanceRecordModel? activeShift;
  final List<AttendanceRecordModel> todayShifts;
  final bool isLoading;
  final String? errorMessage;
  final int elapsedSeconds;

  const AttendanceState({
    this.activeShift,
    this.todayShifts = const [],
    this.isLoading = false,
    this.errorMessage,
    this.elapsedSeconds = 0,
  });

  bool get isClockedIn => activeShift != null && activeShift!.isActive;

  AttendanceState copyWith({
    AttendanceRecordModel? activeShift,
    bool clearActiveShift = false,
    List<AttendanceRecordModel>? todayShifts,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    int? elapsedSeconds,
  }) {
    return AttendanceState(
      activeShift: clearActiveShift ? null : (activeShift ?? this.activeShift),
      todayShifts: todayShifts ?? this.todayShifts,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
    );
  }
}

class AttendanceNotifier extends StateNotifier<AttendanceState> {
  final AttendanceRepositoryContract _repository;
  Timer? _ticker;

  AttendanceNotifier(this._repository) : super(const AttendanceState()) {
    loadAttendance();
  }

  Future<void> loadAttendance() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final active = await _repository.getActiveShift();
      final today = await _repository.getTodayShifts();
      final elapsed = active != null ? active.calculateCurrentDurationSeconds() : 0;

      state = state.copyWith(
        activeShift: active,
        clearActiveShift: active == null,
        todayShifts: today,
        isLoading: false,
        elapsedSeconds: elapsed,
      );

      _manageTicker();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  void _manageTicker() {
    _ticker?.cancel();
    if (state.isClockedIn) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (state.activeShift != null) {
          state = state.copyWith(
            elapsedSeconds: state.activeShift!.calculateCurrentDurationSeconds(),
          );
        }
      });
    }
  }

  Future<void> clockIn({
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    String? notes,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final newShift = await _repository.clockIn(
        latitude: latitude,
        longitude: longitude,
        accuracyMeters: accuracyMeters,
        notes: notes,
      );

      final today = await _repository.getTodayShifts();
      state = state.copyWith(
        activeShift: newShift,
        todayShifts: today,
        isLoading: false,
        elapsedSeconds: 0,
      );

      _manageTicker();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      rethrow;
    }
  }

  Future<void> clockOut({
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    String? notes,
  }) async {
    final active = state.activeShift;
    if (active == null) {
      throw StateError('No active attendance shift to clock out from.');
    }

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.clockOut(
        attendanceId: active.id,
        latitude: latitude,
        longitude: longitude,
        accuracyMeters: accuracyMeters,
        notes: notes,
      );

      _ticker?.cancel();
      final today = await _repository.getTodayShifts();

      state = state.copyWith(
        clearActiveShift: true,
        todayShifts: today,
        isLoading: false,
        elapsedSeconds: 0,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      rethrow;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }
}

final attendanceNotifierProvider =
    StateNotifierProvider<AttendanceNotifier, AttendanceState>((ref) {
  final repo = ref.watch(attendanceRepositoryProvider);
  return AttendanceNotifier(repo);
});
