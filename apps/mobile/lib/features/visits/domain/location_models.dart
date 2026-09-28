import 'dart:math' as math;
import 'package:flutter/foundation.dart';

enum LocationStatus {
  active,
  archived;

  static LocationStatus fromString(String val) {
    switch (val.toUpperCase()) {
      case 'ARCHIVED':
        return LocationStatus.archived;
      case 'ACTIVE':
      default:
        return LocationStatus.active;
    }
  }

  String toDbCode() {
    switch (this) {
      case LocationStatus.active:
        return 'ACTIVE';
      case LocationStatus.archived:
        return 'ARCHIVED';
    }
  }
}

enum LocationVerificationResult {
  valid,
  outsideRadius,
  lowAccuracy,
  locationUnavailable,
  staleLocation,
  permissionDenied;

  static LocationVerificationResult fromString(String val) {
    switch (val.toUpperCase()) {
      case 'OUTSIDE_RADIUS':
        return LocationVerificationResult.outsideRadius;
      case 'LOW_ACCURACY':
        return LocationVerificationResult.lowAccuracy;
      case 'LOCATION_UNAVAILABLE':
        return LocationVerificationResult.locationUnavailable;
      case 'STALE_LOCATION':
        return LocationVerificationResult.staleLocation;
      case 'PERMISSION_DENIED':
        return LocationVerificationResult.permissionDenied;
      case 'VALID':
      default:
        return LocationVerificationResult.valid;
    }
  }

  String toDbCode() {
    switch (this) {
      case LocationVerificationResult.valid:
        return 'VALID';
      case LocationVerificationResult.outsideRadius:
        return 'OUTSIDE_RADIUS';
      case LocationVerificationResult.lowAccuracy:
        return 'LOW_ACCURACY';
      case LocationVerificationResult.locationUnavailable:
        return 'LOCATION_UNAVAILABLE';
      case LocationVerificationResult.staleLocation:
        return 'STALE_LOCATION';
      case LocationVerificationResult.permissionDenied:
        return 'PERMISSION_DENIED';
    }
  }
}

@immutable
class GpsCoordinatesModel {
  final double latitude;
  final double longitude;
  final double accuracyMeters;
  final DateTime capturedAt;

  const GpsCoordinatesModel({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
    required this.capturedAt,
  });

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy_meters': accuracyMeters,
        'client_captured_at': capturedAt.toUtc().toIso8601String(),
      };

  factory GpsCoordinatesModel.fromJson(Map<String, dynamic> json) =>
      GpsCoordinatesModel(
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        accuracyMeters: (json['accuracy_meters'] as num).toDouble(),
        capturedAt: DateTime.parse(json['client_captured_at'] as String),
      );
}

@immutable
class LocationModel {
  final String id;
  final String organizationId;
  final String name;
  final String? address;
  final double latitude;
  final double longitude;
  final int allowedRadiusMeters;
  final LocationStatus status;

  const LocationModel({
    required this.id,
    required this.organizationId,
    required this.name,
    this.address,
    required this.latitude,
    required this.longitude,
    this.allowedRadiusMeters = 100,
    this.status = LocationStatus.active,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'organization_id': organizationId,
        'name': name,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'allowed_radius_meters': allowedRadiusMeters,
        'status': status.toDbCode(),
      };

  factory LocationModel.fromJson(Map<String, dynamic> json) => LocationModel(
        id: json['id'] as String,
        organizationId: json['organization_id'] as String,
        name: json['name'] as String,
        address: json['address'] as String?,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        allowedRadiusMeters: json['allowed_radius_meters'] as int? ?? 100,
        status: LocationStatus.fromString(json['status'] as String? ?? 'ACTIVE'),
      );
}

@immutable
class GeofenceVerificationEvaluation {
  final double distanceMeters;
  final LocationVerificationResult verificationResult;
  final bool isWithinRadius;
  final bool isAccurate;
  final bool isFresh;
  final String? message;

  const GeofenceVerificationEvaluation({
    required this.distanceMeters,
    required this.verificationResult,
    required this.isWithinRadius,
    required this.isAccurate,
    required this.isFresh,
    this.message,
  });
}

/// Geospatial Haversine calculation and verification service for mobile field operations.
class GeofenceService {
  static const double earthMeanRadiusMeters = 6371000.0;

  /// Calculates geodesic distance between two points on the WGS-84 sphere in meters.
  static double calculateDistanceMeters(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    if (lat1 == lat2 && lon1 == lon2) {
      return 0.0;
    }

    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);

    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRadians(lat1)) *
            math.cos(_toRadians(lat2)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);

    final clampedA = math.min(1.0, math.max(0.0, a));
    final c = 2.0 * math.atan2(math.sqrt(clampedA), math.sqrt(1.0 - clampedA));

    final dist = earthMeanRadiusMeters * c;
    return (dist * 100).round() / 100;
  }

  static double _toRadians(double degrees) => degrees * (math.pi / 180.0);

  /// Evaluates GPS fix against target geofence with accuracy and staleness validation.
  static GeofenceVerificationEvaluation verifyArrival({
    required GpsCoordinatesModel workerCoords,
    required double targetLat,
    required double targetLon,
    required int allowedRadiusMeters,
    double maxAccuracyMeters = 150.0,
    int maxStaleAgeSeconds = 120,
    DateTime? now,
  }) {
    final distanceMeters = calculateDistanceMeters(
      workerCoords.latitude,
      workerCoords.longitude,
      targetLat,
      targetLon,
    );

    final isWithinRadius = distanceMeters <= allowedRadiusMeters;
    final isAccurate = workerCoords.accuracyMeters <= maxAccuracyMeters;

    final evalNow = now ?? DateTime.now();
    final ageSeconds = evalNow.difference(workerCoords.capturedAt).inSeconds;
    final isFresh = ageSeconds <= maxStaleAgeSeconds;

    LocationVerificationResult result = LocationVerificationResult.valid;
    String? message;

    if (!isFresh) {
      result = LocationVerificationResult.staleLocation;
      message = 'GPS fix is stale (${ageSeconds}s old). Acquire a fresh fix.';
    } else if (!isAccurate) {
      result = LocationVerificationResult.lowAccuracy;
      message =
          'GPS accuracy too low (±${workerCoords.accuracyMeters.round()}m). Maximum allowed is ±${maxAccuracyMeters.round()}m.';
    } else if (!isWithinRadius) {
      result = LocationVerificationResult.outsideRadius;
      message =
          'You are ${distanceMeters.round()}m away from location (allowed: ${allowedRadiusMeters}m).';
    }

    return GeofenceVerificationEvaluation(
      distanceMeters: distanceMeters,
      verificationResult: result,
      isWithinRadius: isWithinRadius,
      isAccurate: isAccurate,
      isFresh: isFresh,
      message: message,
    );
  }
}
