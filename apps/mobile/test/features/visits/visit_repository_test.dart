import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/sync/offline_mutation_queue.dart';
import 'package:fieldops_mobile/features/visits/data/visit_repository.dart';
import 'package:fieldops_mobile/features/visits/domain/location_models.dart';
import 'package:fieldops_mobile/features/visits/domain/visit_models.dart';

void main() {
  late OfflineMutationQueue mutationQueue;
  late VisitRepository repository;

  setUp(() {
    mutationQueue = OfflineMutationQueue();
    repository = VisitRepository(
      mutationQueue: mutationQueue,
      tenantId: 'org_test_1',
      userId: 'usr_tech_1',
    );
  });

  group('VisitRepository Operations', () {
    test('retrieves seeded visits properly', () async {
      final visits = await repository.getVisits();
      expect(visits.length, greaterThanOrEqualTo(2));
      expect(visits.first.location, isNotNull);
    });

    test('valid check-in within radius succeeds and queues offline mutation', () async {
      final visits = await repository.getVisits();
      final visit = visits.first;

      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: visit.location!.latitude,
        longitude: visit.location!.longitude,
        accuracyMeters: 5.0,
        capturedAt: now,
      );

      final updated = await repository.checkIn(
        visitId: visit.id,
        coords: coords,
      );

      expect(updated.status, VisitStatus.checkedIn);
      expect(updated.checkin, isNotNull);
      expect(updated.checkin!.verificationResult, LocationVerificationResult.valid);
      expect(updated.checkin!.isException, isFalse);

      final queue = mutationQueue.getPendingMutations();
      expect(queue.any((m) => m.action == 'visit.checkin'), isTrue);
    });

    test('check-in outside radius without reason throws exception', () async {
      final visits = await repository.getVisits();
      final visit = visits.first;

      final now = DateTime.now();
      // Far away coordinates
      final coords = GpsCoordinatesModel(
        latitude: visit.location!.latitude + 0.1,
        longitude: visit.location!.longitude,
        accuracyMeters: 5.0,
        capturedAt: now,
      );

      expect(
        () => repository.checkIn(
          visitId: visit.id,
          coords: coords,
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('check-in outside radius with reason records exception override', () async {
      final visits = await repository.getVisits();
      final visit = visits.first;

      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: visit.location!.latitude + 0.05, // outside radius
        longitude: visit.location!.longitude,
        accuracyMeters: 5.0,
        capturedAt: now,
      );

      final updated = await repository.checkIn(
        visitId: visit.id,
        coords: coords,
        exceptionReason: 'Client requested meeting at gate entrance.',
      );

      expect(updated.status, VisitStatus.checkedIn);
      expect(updated.checkin!.isException, isTrue);
      expect(updated.checkin!.exceptionReason, 'Client requested meeting at gate entrance.');
      expect(updated.checkin!.verificationResult, LocationVerificationResult.outsideRadius);
    });

    test('check-out records departure and enqueues offline mutation', () async {
      final visits = await repository.getVisits();
      final visit = visits.first;

      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: visit.location!.latitude,
        longitude: visit.location!.longitude,
        accuracyMeters: 8.0,
        capturedAt: now,
      );

      final updated = await repository.checkOut(
        visitId: visit.id,
        coords: coords,
        notes: 'Replaced high-voltage fuse successfully.',
      );

      expect(updated.status, VisitStatus.checkedOut);
      expect(updated.checkout, isNotNull);
      expect(updated.checkout!.notes, 'Replaced high-voltage fuse successfully.');

      final queue = mutationQueue.getPendingMutations();
      expect(queue.any((m) => m.action == 'visit.checkout'), isTrue);
    });

    test('addProof records proof evidence and enqueues offline mutation', () async {
      final visits = await repository.getVisits();
      final visit = visits.first;

      final updated = await repository.addProof(
        visitId: visit.id,
        type: ProofType.photo,
        storagePath: 'tenants/org_1/visits/${visit.id}/photo.jpg',
        fileName: 'breaker_panel.jpg',
      );

      expect(updated.proofs.length, 1);
      expect(updated.proofs.first.proofType, ProofType.photo);

      final queue = mutationQueue.getPendingMutations();
      expect(queue.any((m) => m.action == 'visit.proof'), isTrue);
    });

    test('transition to completed requires checkout to be recorded first', () async {
      final visits = await repository.getVisits();
      final visit = visits.first; // Not checked out

      expect(
        () => repository.transitionStatus(
          visitId: visit.id,
          targetStatus: VisitStatus.completed,
        ),
        throwsA(isA<Exception>()),
      );
    });
  });
}
