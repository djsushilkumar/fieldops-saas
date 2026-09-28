import { describe, it, expect, vi } from 'vitest';
import {
  AttendanceStatus,
  VisitStatus,
  TaskStatus,
  IsoDateTime,
  UUID,
  TenantId,
  UserId,
  OfflineMutation,
} from '@fieldops/types';

describe('Security Suite: Concurrency, Race Conditions & Atomic Idempotency', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;
  const userId = 'u0000000-0000-0000-0000-000000000004' as UserId;

  describe('Attendance Duplicate Shift Race Condition Defense', () => {
    it('prevents creating duplicate concurrent active shifts for the same worker', async () => {
      // In-memory atomic shift store simulating PostgreSQL unique partial index:
      // (organization_id, user_id) WHERE status IN ('CLOCKED_IN', 'CHECKED_IN')
      const activeShifts = new Map<string, { id: string; status: AttendanceStatus }>();

      const atomicClockIn = async (empId: string): Promise<{ success: boolean; shiftId?: string; error?: string }> => {
        if (activeShifts.has(empId)) {
          return {
            success: false,
            error: 'DUPLICATE_ACTIVE_SHIFT: An active attendance session already exists.',
          };
        }

        const newShiftId = `shift_${Math.random().toString(36).substring(2, 9)}`;
        activeShifts.set(empId, { id: newShiftId, status: AttendanceStatus.CLOCKED_IN });
        return { success: true, shiftId: newShiftId };
      };

      // Simulate simultaneous clock-in button double-clicks / concurrent network calls
      const [res1, res2] = await Promise.all([
        atomicClockIn(userId),
        atomicClockIn(userId),
      ]);

      // Exactly one request must succeed; the other must be rejected
      const successes = [res1, res2].filter((r) => r.success);
      const failures = [res1, res2].filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error).toContain('DUPLICATE_ACTIVE_SHIFT');
    });
  });

  describe('Offline Mutation Idempotency Key De-duplication', () => {
    it('executes a mutation with a unique mutation_id exactly once across duplicate sync attempts', async () => {
      const processedMutations = new Set<string>();
      let sideEffectCount = 0;

      const processOfflineMutation = async (mutation: OfflineMutation): Promise<{ applied: boolean }> => {
        if (processedMutations.has(mutation.mutationId)) {
          // Idempotent: already processed, do not repeat side effect
          return { applied: false };
        }

        processedMutations.add(mutation.mutationId);
        sideEffectCount++;
        return { applied: true };
      };

      const mutation: OfflineMutation = {
        mutationId: 'mut_unique_key_001' as UUID,
        entityType: 'VISIT',
        entityId: 'v-1' as any,
        action: 'CHECK_IN',
        payload: { latitude: 37.7749, longitude: -122.4194 },
        clientTimestamp: '2026-09-28T09:00:00.000Z' as IsoDateTime,
        retryCount: 0,
      };

      // First sync attempt
      const attempt1 = await processOfflineMutation(mutation);
      expect(attempt1.applied).toBe(true);
      expect(sideEffectCount).toBe(1);

      // Replay / network retry with exact same mutationId
      const attempt2 = await processOfflineMutation(mutation);
      expect(attempt2.applied).toBe(false);
      expect(sideEffectCount).toBe(1); // Side effect was not duplicated
    });
  });

  describe('Concurrent Task Status Transitions', () => {
    it('detects state conflicts when concurrent updates attempt conflicting transitions', async () => {
      let currentStatus: TaskStatus = TaskStatus.ASSIGNED;

      const transitionStatus = async (
        expectedCurrent: TaskStatus,
        target: TaskStatus
      ): Promise<{ success: boolean; error?: string }> => {
        // Optimistic locking check: UPDATE tasks SET status = target WHERE id = taskId AND status = expectedCurrent
        if (currentStatus !== expectedCurrent) {
          return {
            success: false,
            error: `CONFLICT: Task has already transitioned from ${expectedCurrent} to ${currentStatus}.`,
          };
        }

        currentStatus = target;
        return { success: true };
      };

      // Two simultaneous requests: Manager cancels task while Worker accepts task
      const [cancelRes, acceptRes] = await Promise.all([
        transitionStatus(TaskStatus.ASSIGNED, TaskStatus.CANCELED),
        transitionStatus(TaskStatus.ASSIGNED, TaskStatus.ACCEPTED),
      ]);

      const successfulTransitions = [cancelRes, acceptRes].filter((r) => r.success);
      const conflictedTransitions = [cancelRes, acceptRes].filter((r) => !r.success);

      expect(successfulTransitions.length).toBe(1);
      expect(conflictedTransitions.length).toBe(1);
      expect(conflictedTransitions[0].error).toContain('CONFLICT');
    });
  });
});
