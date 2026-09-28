import { describe, it, expect } from 'vitest';
import {
  VisitStatus,
  UserRole,
  isValidVisitTransition,
  isVisitOverdue,
  can,
  Permissions,
  calculateHaversineDistance,
  verifyGeofence,
  LocationVerificationResult,
  GpsCoordinates,
  IsoDateTime,
} from '@fieldops/types';

describe('Web Visit Management Unit Tests', () => {
  describe('Visit Lifecycle State Machine in Web Client', () => {
    it('prevents Field Worker from canceling visits', () => {
      const result = isValidVisitTransition(
        VisitStatus.SCHEDULED,
        VisitStatus.CANCELED,
        UserRole.FIELD_WORKER
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Field Workers cannot cancel visits');
    });

    it('allows Supervisor, Manager, and Admin to cancel visits', () => {
      expect(
        isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CANCELED, UserRole.SUPERVISOR).valid
      ).toBe(true);
      expect(
        isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CANCELED, UserRole.MANAGER).valid
      ).toBe(true);
      expect(
        isValidVisitTransition(VisitStatus.SCHEDULED, VisitStatus.CANCELED, UserRole.ADMIN).valid
      ).toBe(true);
    });

    it('blocks completing visit if checkout has not been recorded', () => {
      const result = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.SUPERVISOR,
        { hasCheckout: false }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('recording check-out');
    });

    it('allows completing visit when checkout is recorded', () => {
      const result = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.SUPERVISOR,
        { hasCheckout: true }
      );
      expect(result.valid).toBe(true);
    });

    it('blocks completing visit if required proofs are missing', () => {
      const result = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.SUPERVISOR,
        { hasCheckout: true, requiredProofCount: 2, proofCount: 1 }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('required 2 proof(s), but only 1 provided');
    });

    it('enforces COMPLETED and CANCELED as terminal states', () => {
      expect(
        isValidVisitTransition(VisitStatus.COMPLETED, VisitStatus.READY, UserRole.ADMIN).valid
      ).toBe(false);
      expect(
        isValidVisitTransition(VisitStatus.CANCELED, VisitStatus.SCHEDULED, UserRole.ADMIN).valid
      ).toBe(false);
    });
  });

  describe('RBAC for Visits and Locations in Web Shell', () => {
    it('authorizes OWNER, ADMIN, MANAGER to manage locations and schedule visits', () => {
      [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER].forEach((role) => {
        expect(can(role, Permissions.LOCATION_MANAGE)).toBe(true);
        expect(can(role, Permissions.VISIT_SCHEDULE)).toBe(true);
        expect(can(role, Permissions.VISIT_CANCEL)).toBe(true);
      });
    });

    it('prohibits FIELD_WORKER from managing locations and scheduling visits', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.LOCATION_MANAGE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_SCHEDULE)).toBe(false);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_CANCEL)).toBe(false);
    });

    it('allows FIELD_WORKER to check in to assigned visit and view own visits', () => {
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_CHECKIN_OWN)).toBe(true);
      expect(can(UserRole.FIELD_WORKER, Permissions.VISIT_VIEW_OWN)).toBe(true);
      expect(can(UserRole.FIELD_WORKER, Permissions.PROOF_CREATE)).toBe(true);
    });
  });

  describe('Geospatial Verification in Web Context', () => {
    it('accurately verifies on-site proximity for authorized site', () => {
      const substationLat = 37.7749;
      const substationLon = -122.4194;
      const coords: GpsCoordinates = {
        latitude: 37.77492,
        longitude: -122.41938,
        accuracyMeters: 8,
        capturedAt: '2026-09-28T16:00:00.000Z' as IsoDateTime,
      };

      const result = verifyGeofence({
        workerCoordinates: coords,
        targetLatitude: substationLat,
        targetLongitude: substationLon,
        allowedRadiusMeters: 100,
        now: new Date('2026-09-28T16:00:10.000Z'),
      });

      expect(result.verificationResult).toBe(LocationVerificationResult.VALID);
      expect(result.distanceMeters).toBeLessThan(20);
    });

    it('detects outside geofence radius for far arrival', () => {
      const substationLat = 37.7749;
      const substationLon = -122.4194;
      const coords: GpsCoordinates = {
        latitude: 37.785,
        longitude: -122.4194,
        accuracyMeters: 10,
        capturedAt: '2026-09-28T16:00:00.000Z' as IsoDateTime,
      };

      const result = verifyGeofence({
        workerCoordinates: coords,
        targetLatitude: substationLat,
        targetLongitude: substationLon,
        allowedRadiusMeters: 100,
        now: new Date('2026-09-28T16:00:10.000Z'),
      });

      expect(result.verificationResult).toBe(LocationVerificationResult.OUTSIDE_RADIUS);
      expect(result.distanceMeters).toBeGreaterThan(1000);
    });
  });
});
