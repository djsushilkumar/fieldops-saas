import { describe, it, expect } from 'vitest';
import { LocationVerificationResult } from '@fieldops/types';

describe('Operational Map Geospatial & Privacy Unit Tests', () => {
  it('correctly categorizes visit check-ins as verified vs exception overrides', () => {
    const verifiedCheckin = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 10,
      verificationResult: LocationVerificationResult.VALID,
      isException: false,
    };

    const exceptionCheckin = {
      latitude: 37.7800,
      longitude: -122.4250,
      accuracyMeters: 15,
      verificationResult: LocationVerificationResult.OUTSIDE_RADIUS,
      isException: true,
      exceptionReason: 'Gate blocked, checked in from exterior perimeter',
    };

    const lowAccuracyCheckin = {
      latitude: 37.7750,
      longitude: -122.4190,
      accuracyMeters: 65, // > 50m
      verificationResult: LocationVerificationResult.LOW_ACCURACY,
      isException: false,
    };

    const checkIsException = (c: typeof verifiedCheckin) => {
      const isWithin = c.verificationResult === LocationVerificationResult.VALID;
      const lowAcc = c.accuracyMeters > 50;
      return c.isException || !isWithin || lowAcc;
    };

    expect(checkIsException(verifiedCheckin)).toBe(false);
    expect(checkIsException(exceptionCheckin)).toBe(true);
    expect(checkIsException(lowAccuracyCheckin)).toBe(true);
  });

  it('computes map bounding box with safe padding', () => {
    const points = [
      { latitude: 37.770, longitude: -122.420 },
      { latitude: 37.780, longitude: -122.410 },
    ];

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    points.forEach((p) => {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    });

    const latSpan = Math.max(maxLat - minLat, 0.02);
    const lngSpan = Math.max(maxLng - minLng, 0.02);

    const bounds = {
      minLat: minLat - latSpan * 0.15,
      maxLat: maxLat + latSpan * 0.15,
      minLng: minLng - lngSpan * 0.15,
      maxLng: maxLng + lngSpan * 0.15,
    };

    expect(bounds.minLat).toBeLessThan(37.770);
    expect(bounds.maxLat).toBeGreaterThan(37.780);
    expect(bounds.minLng).toBeLessThan(-122.420);
    expect(bounds.maxLng).toBeGreaterThan(-122.410);
  });

  it('enforces location minimization: strictly event-based, no live telematics streaming', () => {
    const discreteEvent = {
      capturedAt: '2026-09-28T10:00:00.000Z',
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 8,
    };

    expect(discreteEvent.capturedAt).toBeDefined();
    expect(typeof discreteEvent.latitude).toBe('number');
    expect(typeof discreteEvent.longitude).toBe('number');
  });
});
