import { describe, it, expect } from 'vitest';
import {
  TaskStatus,
  VisitStatus,
  AttendanceStatus,
  TenantId,
  TaskId,
  VisitId,
  AttendanceId,
  UserId,
} from '@fieldops/types';

describe('Security & QA Suite: Data Integrity Diagnostics', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001' as TenantId;

  describe('Orphaned Records Audit Function', () => {
    it('detects orphaned task checklists and attachments whose parent task does not exist', () => {
      const existingTaskIds = new Set<TaskId>([
        't-1' as TaskId,
        't-2' as TaskId,
      ]);

      const attachments = [
        { id: 'att-1', taskId: 't-1' as TaskId },
        { id: 'att-2', taskId: 't-99' as TaskId }, // Orphaned!
      ];

      const findOrphanedAttachments = (items: typeof attachments, validTasks: Set<TaskId>) => {
        return items.filter((item) => !validTasks.has(item.taskId));
      };

      const orphans = findOrphanedAttachments(attachments, existingTaskIds);
      expect(orphans.length).toBe(1);
      expect(orphans[0].id).toBe('att-2');
    });

    it('detects orphaned visit proofs whose parent visit does not exist', () => {
      const existingVisitIds = new Set<VisitId>([
        'v-1' as VisitId,
      ]);

      const proofs = [
        { id: 'proof-1', visitId: 'v-1' as VisitId },
        { id: 'proof-2', visitId: 'v-unknown' as VisitId }, // Orphaned!
      ];

      const findOrphanedProofs = (items: typeof proofs, validVisits: Set<VisitId>) => {
        return items.filter((item) => !validVisits.has(item.visitId));
      };

      const orphans = findOrphanedProofs(proofs, existingVisitIds);
      expect(orphans.length).toBe(1);
      expect(orphans[0].id).toBe('proof-2');
    });
  });

  describe('Duplicate Active Shift Invariant Audit', () => {
    it('detects duplicate active shifts for the same worker across attendance records', () => {
      const attendanceRecords = [
        {
          id: 'att-1' as AttendanceId,
          userId: 'u-1' as UserId,
          status: AttendanceStatus.CLOCKED_IN,
        },
        {
          id: 'att-2' as AttendanceId,
          userId: 'u-2' as UserId,
          status: AttendanceStatus.CLOCKED_IN,
        },
        {
          id: 'att-3' as AttendanceId,
          userId: 'u-1' as UserId, // Duplicate active shift for u-1!
          status: AttendanceStatus.CHECKED_IN,
        },
      ];

      const detectDuplicateActiveShifts = (records: typeof attendanceRecords) => {
        const activeUsers = new Map<UserId, string[]>();
        for (const r of records) {
          if (r.status === AttendanceStatus.CLOCKED_IN || r.status === AttendanceStatus.CHECKED_IN) {
            const list = activeUsers.get(r.userId) || [];
            list.push(r.id);
            activeUsers.set(r.userId, list);
          }
        }
        const duplicates: { userId: UserId; shiftIds: string[] }[] = [];
        for (const [userId, shiftIds] of activeUsers.entries()) {
          if (shiftIds.length > 1) {
            duplicates.push({ userId, shiftIds });
          }
        }
        return duplicates;
      };

      const duplicates = detectDuplicateActiveShifts(attendanceRecords);
      expect(duplicates.length).toBe(1);
      expect(duplicates[0].userId).toBe('u-1' as UserId);
      expect(duplicates[0].shiftIds).toEqual(['att-1', 'att-3']);
    });
  });

  describe('State Machine Invariant Integrity', () => {
    it('flags illegal state invariants such as COMPLETED visits missing check-ins or proofs', () => {
      const visits = [
        {
          id: 'v-1' as VisitId,
          status: VisitStatus.COMPLETED,
          checkedInAt: '2026-09-28T09:00:00Z',
          checkedOutAt: '2026-09-28T10:00:00Z',
        },
        {
          id: 'v-2' as VisitId,
          status: VisitStatus.COMPLETED,
          checkedInAt: null, // Illegal: Completed without check-in!
          checkedOutAt: null,
        },
      ];

      const auditVisitInvariants = (items: typeof visits) => {
        return items.filter(
          (v) => v.status === VisitStatus.COMPLETED && (!v.checkedInAt || !v.checkedOutAt)
        );
      };

      const violations = auditVisitInvariants(visits);
      expect(violations.length).toBe(1);
      expect(violations[0].id).toBe('v-2');
    });

    it('flags tasks marked COMPLETED without completedAt timestamp', () => {
      const tasks = [
        { id: 't-1' as TaskId, status: TaskStatus.COMPLETED, completedAt: '2026-09-28T15:00:00Z' },
        { id: 't-2' as TaskId, status: TaskStatus.COMPLETED, completedAt: null }, // Illegal!
      ];

      const auditTaskInvariants = (items: typeof tasks) => {
        return items.filter((t) => t.status === TaskStatus.COMPLETED && !t.completedAt);
      };

      const violations = auditTaskInvariants(tasks);
      expect(violations.length).toBe(1);
      expect(violations[0].id).toBe('t-2');
    });
  });
});
