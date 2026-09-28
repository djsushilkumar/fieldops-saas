import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  verifyGeofence,
  isValidVisitTransition,
  isVisitOverdue,
  LocationVerificationResult,
  VisitStatus,
  UserRole,
  GpsCoordinates,
  IsoDateTime,
} from '../src/index';

describe('Geospatial Engine: Haversine Distance Calculation', () => {
  it('returns 0 for identical points', () => {
    const dist = calculateHaversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
    expect(dist).toBe(0);
  });

  it('calculates accurate distance between known San Francisco landmarks', () => {
    // SF City Hall: 37.7793, -122.4192
    // SF Ferry Building: 37.7955, -122.3937
    // Expected distance is approximately 2.85 km (2800m - 2900m)
    const dist = calculateHaversineDistance(37.7793, -122.4192, 37.7955, -122.3937);
    expect(dist).toBeGreaterThan(2800);
    expect(dist).toBeLessThan(2900);
    expect(dist).toBeCloseTo(2855, -2);
  });

  it('guarantees symmetry: dist(A, B) == dist(B, A)', () => {
    const d1 = calculateHaversineDistance(40.7128, -74.006, 51.5074, -0.1278);
    const d2 = calculateHaversineDistance(51.5074, -0.1278, 40.7128, -74.006);
    expect(d1).toBe(d2);
  });

  it('calculates approximately 111 km for 1 degree longitude at equator', () => {
    const dist = calculateHaversineDistance(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });
});

describe('Geofence Verification Engine', () => {
  const targetLat = 37.7749;
  const targetLon = -122.4194;
  const allowedRadius = 100; // 100 meters
  const now = new Date('2026-09-28T16:00:00.000Z');

  it('evaluates VALID when within radius, high accuracy, and fresh GPS fix', () => {
    // 10m away
    const coords: GpsCoordinates = {
      latitude: 37.77495,
      longitude: -122.4194,
      accuracyMeters: 10,
      capturedAt: '2026-09-28T15:59:50.000Z' as IsoDateTime, // 10s old
    };

    const evalResult = verifyGeofence({
      workerCoordinates: coords,
      targetLatitude: targetLat,
      targetLongitude: targetLon,
      allowedRadiusMeters: allowedRadius,
      now,
    });

    expect(evalResult.verificationResult).toBe(LocationVerificationResult.VALID);
    expect(evalResult.isWithinRadius).toBe(true);
    expect(evalResult.isAccurate).toBe(true);
    expect(evalResult.isFresh).toBe(true);
  });

  it('evaluates OUTSIDE_RADIUS when distance exceeds allowed threshold', () => {
    // ~500m away
    const coords: GpsCoordinates = {
      latitude: 37.779,
      longitude: -122.4194,
      accuracyMeters: 15,
      capturedAt: '2026-09-28T15:59:50.000Z' as IsoDateTime,
    };

    const evalResult = verifyGeofence({
      workerCoordinates: coords,
      targetLatitude: targetLat,
      targetLongitude: targetLon,
      allowedRadiusMeters: allowedRadius,
      now,
    });

    expect(evalResult.verificationResult).toBe(LocationVerificationResult.OUTSIDE_RADIUS);
    expect(evalResult.isWithinRadius).toBe(false);
    expect(evalResult.message).toContain('away from location');
  });

  it('evaluates LOW_ACCURACY when GPS fix uncertainty exceeds 150m', () => {
    const coords: GpsCoordinates = {
      latitude: 37.77495,
      longitude: -122.4194,
      accuracyMeters: 250, // > 150m
      capturedAt: '2026-09-28T15:59:50.000Z' as IsoDateTime,
    };

    const evalResult = verifyGeofence({
      workerCoordinates: coords,
      targetLatitude: targetLat,
      targetLongitude: targetLon,
      allowedRadiusMeters: allowedRadius,
      now,
    });

    expect(evalResult.verificationResult).toBe(LocationVerificationResult.LOW_ACCURACY);
    expect(evalResult.isAccurate).toBe(false);
  });

  it('evaluates STALE_LOCATION when timestamp is older than max allowed age (120s)', () => {
    const coords: GpsCoordinates = {
      latitude: 37.77495,
      longitude: -122.4194,
      accuracyMeters: 10,
      capturedAt: '2026-09-28T15:55:00.000Z' as IsoDateTime, // 5 minutes old
    };

    const evalResult = verifyGeofence({
      workerCoordinates: coords,
      targetLatitude: targetLat,
      targetLongitude: targetLon,
      allowedRadiusMeters: allowedRadius,
      now,
    });

    expect(evalResult.verificationResult).toBe(LocationVerificationResult.STALE_LOCATION);
    expect(evalResult.isFresh).toBe(false);
  });
});

describe('Visit State Machine Evaluator & Transitions', () => {
  it('allows valid progression: SCHEDULED -> READY -> CHECKED_IN -> IN_PROGRESS -> CHECKED_OUT -> COMPLETED', () => {
    expect(
      isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.READY, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    expect(
      isValidVisitTransition(VisitStatus.READY, VisitStatus.CHECKED_IN, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    expect(
      isValidVisitTransition(VisitStatus.CHECKED_IN, VisitStatus.IN_PROGRESS, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    expect(
      isValidVisitTransition(VisitStatus.IN_PROGRESS, VisitStatus.CHECKED_OUT, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    expect(
      isValidVisitTransition(VisitStatus.CHECKED_OUT, VisitStatus.COMPLETED, UserRole.FIELD_WORKER, {
        hasCheckout: true,
      }).valid
    ).toBe(true);
  });

  it('allows direct SCHEDULED -> CHECKED_IN and SCHEDULED -> EN_ROUTE', () => {
    expect(
      isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CHECKED_IN, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    expect(
      isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.EN_ROUTE, UserRole.FIELD_WORKER).valid
    ).toBe(true);

    expect(
      isValidVisitTransition(VisitStatus.EN_ROUTE, VisitStatus.CHECKED_IN, UserRole.FIELD_WORKER).valid
    ).toBe(true);
  });

  it('rejects completing visit without recorded checkout', () => {
    const result = isValidVisitTransition(
      VisitStatus.CHECKED_OUT,
      VisitStatus.COMPLETED,
      UserRole.FIELD_WORKER,
      { hasCheckout: false }
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('recording check-out');
  });

  it('rejects completing visit when proof requirement is not satisfied', () => {
    const result = isValidVisitTransition(
      VisitStatus.CHECKED_OUT,
      VisitStatus.COMPLETED,
      UserRole.FIELD_WORKER,
      { hasCheckout: true, requiredProofCount: 2, proofCount: 1 }
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('required 2 proof(s), but only 1 provided');
  });

  it('forbids Field Workers from canceling visits', () => {
    const result = isValidVisitTransition(
      VisitStatus.SCHEDULED,
      VisitStatus.CANCELED,
      UserRole.FIELD_WORKER
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Field Workers cannot cancel visits');
  });

  it('allows Supervisors, Managers, and Owners to cancel visits', () => {
    expect(
      isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CANCELED, UserRole.SUPERVISOR).valid
    ).toBe(true);
    expect(
      isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CANCELED, UserRole.MANAGER).valid
    ).toBe(true);
    expect(
      isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CANCELED, UserRole.OWNER).valid
    ).toBe(true);
  });

  it('enforces CANCELED and COMPLETED as terminal states', () => {
    expect(
      isValidVisitTransition(VisitStatus.CANCELED, VisitStatus.SCHEDULED, UserRole.OWNER).valid
    ).toBe(false);
    expect(
      isValidVisitTransition(VisitStatus.COMPLETED, VisitStatus.IN_PROGRESS, UserRole.OWNER).valid
    ).toBe(false);
  });

  it('evaluates isVisitOverdue accurately', () => {
    const pastTime = '2026-09-28T12:00:00.000Z';
    const futureTime = '2026-09-28T18:00:00.000Z';
    const evalNow = new Date('2026-09-28T15:00:00.000Z');

    expect(
      isVisitOverdue(
        { status: VisitStatus.SCHEDULED, scheduledStart: pastTime, scheduledEnd: pastTime },
        evalNow
      )
    ).toBe(true);

    expect(
      isVisitOverdue(
        { status: VisitStatus.SCHEDULED, scheduledStart: pastTime, scheduledEnd: futureTime },
        evalNow
      )
    ).toBe(false);

    expect(
      isVisitOverdue(
        { status: VisitStatus.COMPLETED, scheduledStart: pastTime, scheduledEnd: pastTime },
        evalNow
      )
    ).toBe(false);
  });
});
