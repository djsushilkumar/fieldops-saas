import { describe, it, expect } from 'vitest';
import {
  TenantId,
  UserId,
  TeamId,
  TaskId,
  VisitId,
  LocationId,
  AttendanceId,
  TaskStatus,
  VisitStatus,
  AttendanceStatus,
  Priority,
  ProofType,
  LocationVerificationResult,
  UserRole,
  SubscriptionPlan,
  PLANS,
  verifyGeofence,
  isValidVisitTransition,
  isValidTaskTransition,
  isValidAttendanceTransition,
  calculateHaversineDistance,
  formatShiftDuration,
  calculateShiftDurationSeconds,
  IsoDateTime,
} from '@fieldops/types';
import { buildCsv } from '@fieldops/api';

describe('Security & QA Suite: End-to-End Golden Path & Failure Paths', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
  const ownerId = 'u0000000-0000-0000-0000-000000000001' as UserId;
  const workerId = 'u0000000-0000-0000-0000-000000000004' as UserId;
  const teamId = 'team-001' as TeamId;
  const locationId = 'loc-001' as LocationId;
  const taskId = 'task-001' as TaskId;
  const visitId = 'visit-001' as VisitId;
  const attendanceId = 'att-001' as AttendanceId;

  // Golden Path Simulation
  describe('Full Golden Path Workflow', () => {
    it('executes complete operational dispatch, verification, proof capture, and reporting lifecycle', () => {
      // 1. Quota check before dispatch
      const planLimits = PLANS[SubscriptionPlan.STARTER].entitlements;
      const currentWorkers = 4;
      expect(currentWorkers + 1 <= planLimits.maxWorkers).toBe(true);

      // 2. Attendance Clock-in
      let attendanceStatus = AttendanceStatus.CLOCKED_IN;
      const checkInTime = '2026-09-28T08:00:00.000Z' as IsoDateTime;
      expect(attendanceStatus).toBe(AttendanceStatus.CLOCKED_IN);

      // 3. Task Creation & Assignment
      let taskStatus = TaskStatus.ASSIGNED;
      expect(taskStatus).toBe(TaskStatus.ASSIGNED);

      // 4. Worker accepts task
      const acceptCheck = isValidTaskTransition(taskStatus, TaskStatus.ACCEPTED);
      expect(acceptCheck.valid).toBe(true);
      taskStatus = TaskStatus.ACCEPTED;

      // 5. Worker starts task
      const startCheck = isValidTaskTransition(taskStatus, TaskStatus.IN_PROGRESS);
      expect(startCheck.valid).toBe(true);
      taskStatus = TaskStatus.IN_PROGRESS;

      // 6. Visit Dispatch & En-Route
      let visitStatus = VisitStatus.SCHEDULED;
      const enRouteCheck = isValidVisitTransition(visitStatus, VisitStatus.EN_ROUTE, UserRole.FIELD_WORKER);
      expect(enRouteCheck.valid).toBe(true);
      visitStatus = VisitStatus.EN_ROUTE;

      // 7. On-site GPS Geofence Verification
      const targetLat = 37.7749;
      const targetLon = -122.4194;
      const allowedRadiusMeters = 100;

      // Worker is 25 meters away with high accuracy (10m)
      const workerCoords = {
        latitude: 37.7751,
        longitude: -122.4193,
        accuracyMeters: 10,
        capturedAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
      };

      const geoEval = verifyGeofence({
        workerCoordinates: workerCoords,
        targetLatitude: targetLat,
        targetLongitude: targetLon,
        allowedRadiusMeters,
        now: new Date('2026-09-28T09:00:30.000Z'),
      });

      expect(geoEval.isWithinRadius).toBe(true);
      expect(geoEval.isAccurate).toBe(true);
      expect(geoEval.isFresh).toBe(true);
      expect(geoEval.verificationResult).toBe(LocationVerificationResult.VALID);

      // 8. Visit Check-in
      const checkinTransition = isValidVisitTransition(visitStatus, VisitStatus.CHECKED_IN, UserRole.FIELD_WORKER);
      expect(checkinTransition.valid).toBe(true);
      visitStatus = VisitStatus.CHECKED_IN;

      // 9. Proof of Work Captured
      const proofs = [
        {
          id: 'proof-1',
          type: ProofType.PHOTO,
          storagePath: `${tenantId}/proofs/2026/09/${visitId}/proof_01.jpg`,
        },
      ];
      expect(proofs.length).toBeGreaterThanOrEqual(1);

      // 10. Visit Check-out
      const checkoutTransition = isValidVisitTransition(
        visitStatus,
        VisitStatus.CHECKED_OUT,
        UserRole.FIELD_WORKER
      );
      expect(checkoutTransition.valid).toBe(true);
      visitStatus = VisitStatus.CHECKED_OUT;

      // 11. Visit Completion (with proofs check)
      const completeVisitCheck = isValidVisitTransition(
        visitStatus,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        { hasCheckout: true, proofCount: proofs.length, requiredProofCount: 1 }
      );
      expect(completeVisitCheck.valid).toBe(true);
      visitStatus = VisitStatus.COMPLETED;

      // 12. Task Completion
      const completeTaskCheck = isValidTaskTransition(taskStatus, TaskStatus.COMPLETED);
      expect(completeTaskCheck.valid).toBe(true);
      taskStatus = TaskStatus.COMPLETED;

      // 13. Attendance Clock-out
      const checkOutTime = '2026-09-28T16:30:00.000Z' as IsoDateTime;
      const clockoutCheck = isValidAttendanceTransition(attendanceStatus, AttendanceStatus.CLOCKED_OUT);
      expect(clockoutCheck.valid).toBe(true);
      attendanceStatus = AttendanceStatus.CLOCKED_OUT;

      const durationSeconds = calculateShiftDurationSeconds(checkInTime, checkOutTime);
      expect(durationSeconds).toBe(30600); // 8h 30m
      expect(formatShiftDuration(durationSeconds)).toBe('8h 30m');

      // 14. Report Generation & Export
      const csv = buildCsv(
        ['Task ID', 'Status', 'Worker', 'Visit Status', 'GPS Result', 'Duty Duration'],
        [[taskId, taskStatus, 'Marcus Vance', visitStatus, geoEval.verificationResult, '8h 30m']]
      );
      expect(csv).toContain(taskId);
      expect(csv).toContain('COMPLETED');
      expect(csv).toContain('VALID');
      expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    });
  });

  // Failure Paths & Boundary Resilience
  describe('Failure Path & Edge Case Protections', () => {
    it('rejects visit completion when required proofs are missing', () => {
      const check = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        { hasCheckout: true, proofCount: 0, requiredProofCount: 2 }
      );
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('required 2 proof(s)');
    });

    it('rejects visit completion when check-out timestamp is missing', () => {
      const check = isValidVisitTransition(
        VisitStatus.CHECKED_OUT,
        VisitStatus.COMPLETED,
        UserRole.FIELD_WORKER,
        { hasCheckout: false, proofCount: 2, requiredProofCount: 1 }
      );
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('without recording check-out');
    });

    it('classifies out-of-bounds check-ins as OUTSIDE_RADIUS', () => {
      const targetLat = 37.7749;
      const targetLon = -122.4194;
      const allowedRadiusMeters = 50;

      // Worker is 500m away
      const farWorkerCoords = {
        latitude: 37.7794,
        longitude: -122.4194,
        accuracyMeters: 10,
        capturedAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
      };

      const geoEval = verifyGeofence({
        workerCoordinates: farWorkerCoords,
        targetLatitude: targetLat,
        targetLongitude: targetLon,
        allowedRadiusMeters,
        now: new Date('2026-09-28T09:00:30.000Z'),
      });

      expect(geoEval.isWithinRadius).toBe(false);
      expect(geoEval.verificationResult).toBe(LocationVerificationResult.OUTSIDE_RADIUS);
    });

    it('classifies low accuracy GPS fixes as LOW_ACCURACY', () => {
      const targetLat = 37.7749;
      const targetLon = -122.4194;

      const inaccurateCoords = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 500, // Excessive inaccuracy
        capturedAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
      };

      const geoEval = verifyGeofence({
        workerCoordinates: inaccurateCoords,
        targetLatitude: targetLat,
        targetLongitude: targetLon,
        allowedRadiusMeters: 100,
        maxAccuracyMeters: 150,
        now: new Date('2026-09-28T09:00:30.000Z'),
      });

      expect(geoEval.isAccurate).toBe(false);
      expect(geoEval.verificationResult).toBe(LocationVerificationResult.LOW_ACCURACY);
    });
  });
});
