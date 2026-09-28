import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  verifyGeofence,
  LocationVerificationResult,
  IsoDateTime,
} from '@fieldops/types';
import {
  createLocationSchema,
  checkinSchema,
} from '@fieldops/validation';

describe('Security & Geospatial Suite: Distance Computation & Geofence Verification', () => {
  describe('Haversine Formula Accuracy & Mathematical Invariants', () => {
    it('returns zero distance for identical coordinates', () => {
      const dist = calculateHaversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between SF City Hall and SF Ferry Building (~2.87 km)', () => {
      const cityHallLat = 37.7792;
      const cityHallLon = -122.4191;
      const ferryBuildingLat = 37.7955;
      const ferryBuildingLon = -122.3937;

      const distance = calculateHaversineDistance(
        cityHallLat,
        cityHallLon,
        ferryBuildingLat,
        ferryBuildingLon
      );

      // Distance is ~2,870 meters (tolerance +/- 50m)
      expect(distance).toBeGreaterThanOrEqual(2820);
      expect(distance).toBeLessThanOrEqual(2920);
    });

    it('calculates accurate distance between London and Paris (~343 km)', () => {
      const londonLat = 51.5074;
      const londonLon = -0.1278;
      const parisLat = 48.8566;
      const parisLon = 2.3522;

      const distance = calculateHaversineDistance(londonLat, londonLon, parisLat, parisLon);

      // Distance is ~343,500 meters (tolerance +/- 1,000m)
      expect(distance).toBeGreaterThanOrEqual(342500);
      expect(distance).toBeLessThanOrEqual(344500);
    });

    it('calculates equatorial degree distance (~111.19 km)', () => {
      const distance = calculateHaversineDistance(0, 0, 0, 1);
      // 1 degree of longitude at equator is ~111,195 meters
      expect(distance).toBeGreaterThanOrEqual(110500);
      expect(distance).toBeLessThanOrEqual(111500);
    });

    it('correctly handles coordinates wrapping across the 180th meridian (Antimeridian)', () => {
      // 179.9 degrees East to -179.9 degrees West at equator is 0.2 degrees apart (~22.2 km)
      const distance = calculateHaversineDistance(0, 179.9, 0, -179.9);
      expect(distance).toBeGreaterThanOrEqual(22000);
      expect(distance).toBeLessThanOrEqual(22500);
    });

    it('is symmetric: distance(A, B) === distance(B, A)', () => {
      const d1 = calculateHaversineDistance(34.0522, -118.2437, 40.7128, -74.006);
      const d2 = calculateHaversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(d1).toBe(d2);
    });
  });

  describe('Geofence Verification & Boundary Conditions', () => {
    const targetLatitude = 37.774929;
    const targetLongitude = -122.419416;
    const allowedRadiusMeters = 100;

    it('verifies VALID when user is well within geofence radius', () => {
      // ~20 meters away
      const clientCoord = {
        latitude: 37.7751,
        longitude: -122.419416,
        accuracyMeters: 10,
        capturedAt: '2026-09-28T12:00:00.000Z' as IsoDateTime,
      };

      const result = verifyGeofence({
        targetLatitude,
        targetLongitude,
        allowedRadiusMeters,
        workerCoordinates: clientCoord,
        now: new Date('2026-09-28T12:00:30.000Z'),
      });

      expect(result.verificationResult).toBe(LocationVerificationResult.VALID);
      expect(result.isWithinRadius).toBe(true);
      expect(result.isAccurate).toBe(true);
      expect(result.isFresh).toBe(true);
      expect(result.distanceMeters).toBeLessThan(100);
    });

    it('flags OUTSIDE_RADIUS when user is outside geofence boundary', () => {
      // ~250 meters away
      const clientCoord = {
        latitude: 37.7772,
        longitude: -122.419416,
        accuracyMeters: 10,
        capturedAt: '2026-09-28T12:00:00.000Z' as IsoDateTime,
      };

      const result = verifyGeofence({
        targetLatitude,
        targetLongitude,
        allowedRadiusMeters,
        workerCoordinates: clientCoord,
        now: new Date('2026-09-28T12:00:10.000Z'),
      });

      expect(result.verificationResult).toBe(LocationVerificationResult.OUTSIDE_RADIUS);
      expect(result.isWithinRadius).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(100);
      expect(result.message).toContain('away from location');
    });

    it('flags LOW_ACCURACY when GPS accuracy radius exceeds acceptable threshold', () => {
      const clientCoord = {
        latitude: 37.77495,
        longitude: -122.419416,
        accuracyMeters: 180, // Poor GPS reception
        capturedAt: '2026-09-28T12:00:00.000Z' as IsoDateTime,
      };

      const result = verifyGeofence({
        targetLatitude,
        targetLongitude,
        allowedRadiusMeters,
        workerCoordinates: clientCoord,
        maxAccuracyMeters: 100,
        now: new Date('2026-09-28T12:00:05.000Z'),
      });

      expect(result.verificationResult).toBe(LocationVerificationResult.LOW_ACCURACY);
      expect(result.isAccurate).toBe(false);
      expect(result.message).toContain('GPS accuracy too low');
    });

    it('flags STALE_LOCATION when client GPS fix was captured in the past', () => {
      const clientCoord = {
        latitude: 37.77495,
        longitude: -122.419416,
        accuracyMeters: 15,
        capturedAt: '2026-09-28T11:45:00.000Z' as IsoDateTime, // 15 minutes old
      };

      const result = verifyGeofence({
        targetLatitude,
        targetLongitude,
        allowedRadiusMeters,
        workerCoordinates: clientCoord,
        maxStaleAgeSeconds: 300, // 5 minute max age
        now: new Date('2026-09-28T12:00:00.000Z'),
      });

      expect(result.verificationResult).toBe(LocationVerificationResult.STALE_LOCATION);
      expect(result.isFresh).toBe(false);
      expect(result.message).toContain('GPS fix is stale');
    });
  });

  describe('Geospatial Data Validation & Security Constraints', () => {
    it('rejects latitude values outside [-90, 90]', () => {
      const invalidNorth = createLocationSchema.safeParse({
        name: 'North Pole Out of Bounds',
        latitude: 91.5,
        longitude: 0,
        allowedRadiusMeters: 100,
      });
      expect(invalidNorth.success).toBe(false);

      const invalidSouth = createLocationSchema.safeParse({
        name: 'South Pole Out of Bounds',
        latitude: -90.001,
        longitude: 0,
        allowedRadiusMeters: 100,
      });
      expect(invalidSouth.success).toBe(false);
    });

    it('rejects longitude values outside [-180, 180]', () => {
      const invalidEast = createLocationSchema.safeParse({
        name: 'East Out of Bounds',
        latitude: 0,
        longitude: 180.5,
        allowedRadiusMeters: 100,
      });
      expect(invalidEast.success).toBe(false);

      const invalidWest = createLocationSchema.safeParse({
        name: 'West Out of Bounds',
        latitude: 0,
        longitude: -180.001,
        allowedRadiusMeters: 100,
      });
      expect(invalidWest.success).toBe(false);
    });

    it('rejects geofence radius smaller than 10 meters or greater than 50,000 meters', () => {
      const tooSmall = createLocationSchema.safeParse({
        name: 'Too Small Radius',
        latitude: 37.7749,
        longitude: -122.4194,
        allowedRadiusMeters: 5,
      });
      expect(tooSmall.success).toBe(false);

      const tooLarge = createLocationSchema.safeParse({
        name: 'Too Large Radius',
        latitude: 37.7749,
        longitude: -122.4194,
        allowedRadiusMeters: 60000,
      });
      expect(tooLarge.success).toBe(false);

      const validBoundary = createLocationSchema.safeParse({
        name: 'Valid Boundary Radius',
        latitude: 37.7749,
        longitude: -122.4194,
        allowedRadiusMeters: 10,
      });
      expect(validBoundary.success).toBe(true);
    });

    it('validates check-in payload GPS accuracy must be non-negative', () => {
      const negativeAccuracy = checkinSchema.safeParse({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: -5,
        clientCapturedAt: '2026-09-28T12:00:00.000Z',
      });
      expect(negativeAccuracy.success).toBe(false);
    });
  });
});
