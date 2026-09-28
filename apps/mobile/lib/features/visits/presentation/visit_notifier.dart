import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/location_models.dart';
import '../domain/visit_models.dart';
import '../data/visit_repository.dart';
import '../../sync/offline_mutation_queue.dart';

enum VisitTabFilter {
  today,
  upcoming,
  completed,
}

@immutable
class VisitState {
  final bool isLoading;
  final List<VisitModel> visits;
  final VisitTabFilter activeTab;
  final GpsCoordinatesModel? currentCoords;
  final String? errorMessage;
  final String? successMessage;

  const VisitState({
    this.isLoading = false,
    this.visits = const [],
    this.activeTab = VisitTabFilter.today,
    this.currentCoords,
    this.errorMessage,
    this.successMessage,
  });

  VisitState copyWith({
    bool? isLoading,
    List<VisitModel>? visits,
    VisitTabFilter? activeTab,
    GpsCoordinatesModel? currentCoords,
    String? errorMessage,
    String? successMessage,
    bool clearError = false,
    bool clearSuccess = false,
  }) {
    return VisitState(
      isLoading: isLoading ?? this.isLoading,
      visits: visits ?? this.visits,
      activeTab: activeTab ?? this.activeTab,
      currentCoords: currentCoords ?? this.currentCoords,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
    );
  }

  List<VisitModel> get filteredVisits {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final todayEnd = todayStart.add(const Duration(days: 1));

    switch (activeTab) {
      case VisitTabFilter.today:
        return visits.where((v) {
          if (v.status == VisitStatus.completed || v.status == VisitStatus.canceled) {
            return false;
          }
          return v.scheduledStart.isAfter(todayStart) &&
              v.scheduledStart.isBefore(todayEnd);
        }).toList();

      case VisitTabFilter.upcoming:
        return visits.where((v) {
          if (v.status == VisitStatus.completed || v.status == VisitStatus.canceled) {
            return false;
          }
          return v.scheduledStart.isAfter(todayEnd);
        }).toList();

      case VisitTabFilter.completed:
        return visits.where((v) {
          return v.status == VisitStatus.completed ||
              v.status == VisitStatus.canceled;
        }).toList();
    }
  }
}

class VisitNotifier extends StateNotifier<VisitState> {
  final VisitRepositoryContract repository;

  VisitNotifier(this.repository) : super(const VisitState()) {
    loadVisits();
  }

  Future<void> loadVisits() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final visits = await repository.getVisits();
      state = state.copyWith(
        isLoading: false,
        visits: visits,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  void setTab(VisitTabFilter tab) {
    state = state.copyWith(activeTab: tab);
  }

  void updateGpsCoordinates(GpsCoordinatesModel coords) {
    state = state.copyWith(currentCoords: coords);
  }

  Future<bool> checkIn(
    String visitId, {
    GpsCoordinatesModel? coords,
    String? exceptionReason,
  }) async {
    final gps = coords ?? state.currentCoords;
    if (gps == null) {
      state = state.copyWith(
        errorMessage: 'GPS location fix is required to check in.',
      );
      return false;
    }

    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final updated = await repository.checkIn(
        visitId: visitId,
        coords: gps,
        exceptionReason: exceptionReason,
      );

      final updatedList = state.visits.map((v) => v.id == visitId ? updated : v).toList();
      state = state.copyWith(
        isLoading: false,
        visits: updatedList,
        successMessage: 'Successfully checked in to visit.',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> checkOut(
    String visitId, {
    GpsCoordinatesModel? coords,
    String? notes,
  }) async {
    final gps = coords ?? state.currentCoords;
    if (gps == null) {
      state = state.copyWith(
        errorMessage: 'GPS location fix is required to check out.',
      );
      return false;
    }

    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final updated = await repository.checkOut(
        visitId: visitId,
        coords: gps,
        notes: notes,
      );

      final updatedList = state.visits.map((v) => v.id == visitId ? updated : v).toList();
      state = state.copyWith(
        isLoading: false,
        visits: updatedList,
        successMessage: 'Successfully recorded departure.',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> addProof(
    String visitId, {
    required ProofType type,
    String? storagePath,
    String? fileName,
    String? notes,
    String? signerName,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final updated = await repository.addProof(
        visitId: visitId,
        type: type,
        storagePath: storagePath,
        fileName: fileName,
        notes: notes,
        signerName: signerName,
      );

      final updatedList = state.visits.map((v) => v.id == visitId ? updated : v).toList();
      state = state.copyWith(
        isLoading: false,
        visits: updatedList,
        successMessage: 'Proof evidence recorded.',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> completeVisit(String visitId) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final updated = await repository.transitionStatus(
        visitId: visitId,
        targetStatus: VisitStatus.completed,
      );

      final updatedList = state.visits.map((v) => v.id == visitId ? updated : v).toList();
      state = state.copyWith(
        isLoading: false,
        visits: updatedList,
        successMessage: 'Visit marked completed.',
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }
}

final visitRepositoryProvider = Provider<VisitRepositoryContract>((ref) {
  return VisitRepository(
    mutationQueue: OfflineMutationQueue(),
    tenantId: 'org_default',
    userId: 'usr_field_worker',
  );
});

final visitNotifierProvider =
    StateNotifierProvider<VisitNotifier, VisitState>((ref) {
  final repo = ref.watch(visitRepositoryProvider);
  return VisitNotifier(repo);
});
