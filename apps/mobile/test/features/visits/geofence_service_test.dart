import 'package:flutter_test/flutter_test.dart';
import 'package:fieldops_mobile/features/visits/domain/location_models.dart';

void main() {
  group('GeofenceService Haversine Calculations', () {
    test('returns 0 for identical coordinates', () {
      final dist = GeofenceService.calculateDistanceMeters(
        37.7749,
        -122.4194,
        37.7749,
        -122.4194,
      );
      expect(dist, 0.0);
    });

    test('calculates accurate distance between known landmarks', () {
      // SF City Hall to SF Ferry Building ~2.85 km
      final dist = GeofenceService.calculateDistanceMeters(
        37.7793,
        -122.4192,
        37.7955,
        -122.3937,
      );
      expect(dist, greaterThan(2800));
      expect(dist, lessThan(2900));
    });

    test('is strictly symmetric', () {
      final d1 = GeofenceService.calculateDistanceMeters(40.7128, -74.006, 51.5074, -0.1278);
      final d2 = GeofenceService.calculateDistanceMeters(51.5074, -0.1278, 40.7128, -74.006);
      expect(d1, d2);
    });
  });

  group('Geofence Arrival Verification', () {
    const targetLat = 37.7749;
    const targetLon = -122.4194;
    const allowedRadius = 100;

    test('verifies VALID when within radius, high accuracy, and fresh GPS fix', () {
      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: 37.77495,
        longitude: -122.4194,
        accuracyMeters: 8.0,
        capturedAt: now.subtract(const Duration(seconds: 10)),
      );

      final result = GeofenceService.verifyArrival(
        workerCoords: coords,
        targetLat: targetLat,
        targetLon: targetLon,
        allowedRadiusMeters: allowedRadius,
        now: now,
      );

      expect(result.verificationResult, LocationVerificationResult.valid);
      expect(result.isWithinRadius, isTrue);
      expect(result.isAccurate, isTrue);
      expect(result.isFresh, isTrue);
    });

    test('detects OUTSIDE_RADIUS when worker exceeds allowed geofence boundary', () {
      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: 37.785, // ~1.1km away
        longitude: -122.4194,
        accuracyMeters: 10.0,
        capturedAt: now.subtract(const Duration(seconds: 5)),
      );

      final result = GeofenceService.verifyArrival(
        workerCoords: coords,
        targetLat: targetLat,
        targetLon: targetLon,
        allowedRadiusMeters: allowedRadius,
        now: now,
      );

      expect(result.verificationResult, LocationVerificationResult.outsideRadius);
      expect(result.isWithinRadius, isFalse);
      expect(result.message, contains('away from location'));
    });

    test('detects LOW_ACCURACY when GPS uncertainty exceeds 150m', () {
      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: 37.77495,
        longitude: -122.4194,
        accuracyMeters: 250.0, // > 150m
        capturedAt: now.subtract(const Duration(seconds: 5)),
      );

      final result = GeofenceService.verifyArrival(
        workerCoords: coords,
        targetLat: targetLat,
        targetLon: targetLon,
        allowedRadiusMeters: allowedRadius,
        now: now,
      );

      expect(result.verificationResult, LocationVerificationResult.lowAccuracy);
      expect(result.isAccurate, isFalse);
    });

    test('detects STALE_LOCATION when fix is older than 120 seconds', () {
      final now = DateTime.now();
      final coords = GpsCoordinatesModel(
        latitude: 37.77495,
        longitude: -122.4194,
        accuracyMeters: 10.0,
        capturedAt: now.subtract(const Duration(minutes: 5)),
      );

      final result = GeofenceService.verifyArrival(
        workerCoords: coords,
        targetLat: targetLat,
        targetLon: targetLon,
        allowedRadiusMeters: allowedRadius,
        now: now,
      );

      expect(result.verificationResult, LocationVerificationResult.staleLocation);
      expect(result.isFresh, isFalse);
    });
  });
}
