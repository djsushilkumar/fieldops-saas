import '../../sync/offline_mutation_queue.dart';
import '../domain/location_models.dart';
import '../domain/visit_models.dart';

abstract class VisitRepositoryContract {
  Future<List<VisitModel>> getVisits({VisitStatus? status});
  Future<VisitModel?> getVisitById(String id);
  Future<VisitModel> checkIn({
    required String visitId,
    required GpsCoordinatesModel coords,
    String? exceptionReason,
    Map<String, dynamic>? deviceMetadata,
  });
  Future<VisitModel> checkOut({
    required String visitId,
    required GpsCoordinatesModel coords,
    String? notes,
  });
  Future<VisitModel> addProof({
    required String visitId,
    required ProofType type,
    String? storagePath,
    String? fileName,
    String? notes,
    String? signerName,
    String? taskId,
  });
  Future<VisitModel> transitionStatus({
    required String visitId,
    required VisitStatus targetStatus,
    String? cancelReason,
  });
}

class VisitRepository implements VisitRepositoryContract {
  final OfflineMutationQueue mutationQueue;
  final String tenantId;
  final String userId;

  // In-memory local database for durable offline state
  final Map<String, VisitModel> _localVisits = {};

  VisitRepository({
    required this.mutationQueue,
    required this.tenantId,
    required this.userId,
    List<VisitModel>? initialVisits,
  }) {
    if (initialVisits != null) {
      for (final v in initialVisits) {
        _localVisits[v.id] = v;
      }
    } else {
      _seedDefaultVisits();
    }
  }

  void _seedDefaultVisits() {
    const loc1 = LocationModel(
      id: 'loc_sf_01',
      organizationId: 'org_tenant_1',
      name: 'Downtown Substation Alpha',
      address: '100 Main St, San Francisco, CA',
      latitude: 37.7749,
      longitude: -122.4194,
      allowedRadiusMeters: 100,
    );

    const loc2 = LocationModel(
      id: 'loc_sf_02',
      organizationId: 'org_tenant_1',
      name: 'Mission Relay Tower 4',
      address: '2400 Mission St, San Francisco, CA',
      latitude: 37.7599,
      longitude: -122.4190,
      allowedRadiusMeters: 150,
    );

    final now = DateTime.now();

    final v1 = VisitModel(
      id: 'vis_today_1',
      organizationId: tenantId,
      locationId: loc1.id,
      assignedTo: userId,
      scheduledStart: DateTime(now.year, now.month, now.day, 10, 0),
      scheduledEnd: DateTime(now.year, now.month, now.day, 12, 0),
      status: VisitStatus.scheduled,
      location: loc1,
    );

    final v2 = VisitModel(
      id: 'vis_today_2',
      organizationId: tenantId,
      locationId: loc2.id,
      assignedTo: userId,
      scheduledStart: DateTime(now.year, now.month, now.day, 14, 0),
      scheduledEnd: DateTime(now.year, now.month, now.day, 16, 0),
      status: VisitStatus.ready,
      location: loc2,
    );

    _localVisits[v1.id] = v1;
    _localVisits[v2.id] = v2;
  }

  @override
  Future<List<VisitModel>> getVisits({VisitStatus? status}) async {
    var visits = _localVisits.values.toList();
    if (status != null) {
      visits = visits.where((v) => v.status == status).toList();
    }
    visits.sort((a, b) => a.scheduledStart.compareTo(b.scheduledStart));
    return visits;
  }

  @override
  Future<VisitModel?> getVisitById(String id) async {
    return _localVisits[id];
  }

  @override
  Future<VisitModel> checkIn({
    required String visitId,
    required GpsCoordinatesModel coords,
    String? exceptionReason,
    Map<String, dynamic>? deviceMetadata,
  }) async {
    final visit = _localVisits[visitId];
    if (visit == null) {
      throw Exception('Visit $visitId not found');
    }

    final location = visit.location;
    if (location == null) {
      throw Exception('Location metadata missing for visit $visitId');
    }

    // Geofence Verification
    final evaluation = GeofenceService.verifyArrival(
      workerCoords: coords,
      targetLat: location.latitude,
      targetLon: location.longitude,
      allowedRadiusMeters: location.allowedRadiusMeters,
      now: coords.capturedAt,
    );

    final isException = evaluation.verificationResult != LocationVerificationResult.valid;
    if (isException && (exceptionReason == null || exceptionReason.trim().isEmpty)) {
      throw Exception(
        'Worker is ${evaluation.distanceMeters.round()}m away from location (allowed: ${location.allowedRadiusMeters}m). Reason required.',
      );
    }

    final checkin = VisitCheckinModel(
      id: 'chk_${DateTime.now().millisecondsSinceEpoch}',
      visitId: visitId,
      workerId: userId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: coords.accuracyMeters,
      distanceMeters: evaluation.distanceMeters,
      verificationResult: evaluation.verificationResult,
      isException: isException,
      exceptionReason: exceptionReason,
      clientCapturedAt: coords.capturedAt,
    );

    // 1. Enqueue offline mutation
    await mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'visit',
      entityId: visitId,
      action: 'visit.checkin',
      payload: {
        'visit_id': visitId,
        'latitude': coords.latitude,
        'longitude': coords.longitude,
        'accuracy_meters': coords.accuracyMeters,
        'distance_meters': evaluation.distanceMeters,
        'verification_result': evaluation.verificationResult.toDbCode(),
        'is_exception': isException,
        'exception_reason': exceptionReason,
        'client_captured_at': coords.capturedAt.toUtc().toIso8601String(),
        'device_metadata': deviceMetadata ?? {},
      },
    );

    // 2. Update local state
    final updated = visit.copyWith(
      status: VisitStatus.checkedIn,
      checkin: checkin,
      version: visit.version + 1,
    );

    _localVisits[visitId] = updated;
    return updated;
  }

  @override
  Future<VisitModel> checkOut({
    required String visitId,
    required GpsCoordinatesModel coords,
    String? notes,
  }) async {
    final visit = _localVisits[visitId];
    if (visit == null) {
      throw Exception('Visit $visitId not found');
    }

    final checkout = VisitCheckoutModel(
      id: 'cho_${DateTime.now().millisecondsSinceEpoch}',
      visitId: visitId,
      workerId: userId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: coords.accuracyMeters,
      notes: notes,
      clientCapturedAt: coords.capturedAt,
    );

    // 1. Enqueue offline mutation
    await mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'visit',
      entityId: visitId,
      action: 'visit.checkout',
      payload: {
        'visit_id': visitId,
        'latitude': coords.latitude,
        'longitude': coords.longitude,
        'accuracy_meters': coords.accuracyMeters,
        'notes': notes,
        'client_captured_at': coords.capturedAt.toUtc().toIso8601String(),
      },
    );

    // 2. Update local state
    final updated = visit.copyWith(
      status: VisitStatus.checkedOut,
      checkout: checkout,
      version: visit.version + 1,
    );

    _localVisits[visitId] = updated;
    return updated;
  }

  @override
  Future<VisitModel> addProof({
    required String visitId,
    required ProofType type,
    String? storagePath,
    String? fileName,
    String? notes,
    String? signerName,
    String? taskId,
  }) async {
    final visit = _localVisits[visitId];
    if (visit == null) {
      throw Exception('Visit $visitId not found');
    }

    final now = DateTime.now();
    final proof = VisitProofModel(
      id: 'prf_${now.millisecondsSinceEpoch}',
      visitId: visitId,
      taskId: taskId ?? visit.taskId,
      proofType: type,
      storagePath: storagePath,
      fileName: fileName,
      notes: notes,
      signerName: signerName,
      createdAt: now,
    );

    await mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'visit',
      entityId: visitId,
      action: 'visit.proof',
      payload: proof.toJson(),
    );

    final updatedProofs = [...visit.proofs, proof];
    final updated = visit.copyWith(proofs: updatedProofs);
    _localVisits[visitId] = updated;
    return updated;
  }

  @override
  Future<VisitModel> transitionStatus({
    required String visitId,
    required VisitStatus targetStatus,
    String? cancelReason,
  }) async {
    final visit = _localVisits[visitId];
    if (visit == null) {
      throw Exception('Visit $visitId not found');
    }

    if (targetStatus == VisitStatus.completed && visit.checkout == null) {
      throw Exception('Cannot complete visit without recording check-out.');
    }

    await mutationQueue.enqueue(
      tenantId: tenantId,
      userId: userId,
      entityType: 'visit',
      entityId: visitId,
      action: 'visit.status_change',
      payload: {
        'from_status': visit.status.toDbCode(),
        'to_status': targetStatus.toDbCode(),
        'cancel_reason': cancelReason,
      },
    );

    final updated = visit.copyWith(
      status: targetStatus,
      version: visit.version + 1,
    );

    _localVisits[visitId] = updated;
    return updated;
  }
}
