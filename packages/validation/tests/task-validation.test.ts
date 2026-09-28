import { describe, it, expect } from 'vitest';
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  transitionTaskStatusSchema,
  createChecklistItemSchema,
  toggleChecklistItemSchema,
  createAttachmentMetadataSchema,
  createCommentSchema,
  taskFilterSchema,
  taskSortSchema,
} from '../src/index';
import { TaskStatus, Priority } from '@fieldops/types';

describe('Phase 04 Task Validation Schemas', () => {
  describe('createTaskSchema', () => {
    it('validates a complete, valid task creation payload', () => {
      const payload = {
        title: 'Inspect HVAC Compressor Unit #3',
        description: 'Verify coolant pressure and replace intake filter.',
        priority: Priority.HIGH,
        assignedTo: '018f2e23-74d3-7d24-811c-d7e174244d28',
        assignedTeam: '018f2e23-74d3-7d24-811c-d7e174244d29',
        dueAt: '2026-10-01T15:00:00.000Z',
        checklists: [
          { title: 'Check system gauges', isRequired: true },
          { title: 'Take photos of compressor label', isRequired: false },
        ],
      };

      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(payload.title);
        expect(result.data.priority).toBe(Priority.HIGH);
        expect(result.data.checklists).toHaveLength(2);
      }
    });

    it('defaults priority to MEDIUM when not provided', () => {
      const payload = {
        title: 'Quarterly Safety Audit',
      };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(Priority.MEDIUM);
      }
    });

    it('rejects titles that are too short (< 3 characters)', () => {
      const payload = {
        title: 'AB',
      };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('at least 3 characters');
      }
    });

    it('rejects invalid dueAt timestamp format', () => {
      const payload = {
        title: 'Fix electrical harness',
        dueAt: 'tomorrow at noon',
      };
      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('updateTaskSchema', () => {
    it('requires a positive integer version for optimistic concurrency', () => {
      const withoutVersion = {
        title: 'Updated title',
      };
      const result1 = updateTaskSchema.safeParse(withoutVersion);
      expect(result1.success).toBe(false);

      const withVersion = {
        title: 'Updated title',
        version: 2,
      };
      const result2 = updateTaskSchema.safeParse(withVersion);
      expect(result2.success).toBe(true);
    });

    it('allows clearing assignedTo and assignedTeam with null', () => {
      const payload = {
        assignedTo: null,
        assignedTeam: null,
        dueAt: null,
        version: 1,
      };
      const result = updateTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('assignTaskSchema', () => {
    it('succeeds when assignedTo is provided', () => {
      const payload = { assignedTo: '018f2e23-74d3-7d24-811c-d7e174244d28' };
      const result = assignTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('succeeds when assignedTeam is provided', () => {
      const payload = { assignedTeam: '018f2e23-74d3-7d24-811c-d7e174244d29' };
      const result = assignTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects when neither assignedTo nor assignedTeam is provided', () => {
      const payload = {};
      const result = assignTaskSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Must specify either an assignee or an assigned team');
      }
    });
  });

  describe('transitionTaskStatusSchema', () => {
    it('validates status transition with optional reasons', () => {
      const payload = {
        status: TaskStatus.BLOCKED,
        blockedReason: 'Awaiting spare parts shipment',
        expectedVersion: 3,
      };
      const result = transitionTaskStatusSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects an invalid task status value', () => {
      const payload = {
        status: 'UNKNOWN_STATUS',
      };
      const result = transitionTaskStatusSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('createChecklistItemSchema & toggleChecklistItemSchema', () => {
    it('validates valid checklist item creation with default isRequired', () => {
      const payload = { title: 'Inspect gasket seal' };
      const result = createChecklistItemSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRequired).toBe(true);
      }
    });

    it('rejects empty checklist item title', () => {
      const payload = { title: '   ' };
      const result = createChecklistItemSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('validates toggle completion schema', () => {
      const result1 = toggleChecklistItemSchema.safeParse({ isCompleted: true });
      expect(result1.success).toBe(true);

      const result2 = toggleChecklistItemSchema.safeParse({ isCompleted: 'yes' });
      expect(result2.success).toBe(false);
    });
  });

  describe('createAttachmentMetadataSchema', () => {
    it('accepts valid MIME types and file sizes within 25MB', () => {
      const validPayload = {
        fileName: 'generator_schematic.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024 * 1024 * 5, // 5MB
        storagePath: 'tenants/tenant-1/tasks/task-1/generator_schematic.pdf',
      };
      const result = createAttachmentMetadataSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects disallowed MIME types (e.g., .exe, .sh, .bat)', () => {
      const invalidPayload = {
        fileName: 'malware.exe',
        mimeType: 'application/x-msdownload',
        fileSizeBytes: 1024,
        storagePath: 'tenants/tenant-1/tasks/task-1/malware.exe',
      };
      const result = createAttachmentMetadataSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('rejects files exceeding 25MB', () => {
      const oversizedPayload = {
        fileName: 'large_video.mp4',
        mimeType: 'image/png',
        fileSizeBytes: 26 * 1024 * 1024, // 26MB
        storagePath: 'tenants/tenant-1/tasks/task-1/large.png',
      };
      const result = createAttachmentMetadataSchema.safeParse(oversizedPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('createCommentSchema', () => {
    it('validates non-empty comment content', () => {
      const result = createCommentSchema.safeParse({ content: 'Customer confirmed site access at 2 PM.' });
      expect(result.success).toBe(true);
    });

    it('rejects empty comments', () => {
      const result = createCommentSchema.safeParse({ content: '   ' });
      expect(result.success).toBe(false);
    });
  });

  describe('taskFilterSchema & taskSortSchema', () => {
    it('validates filter parameters including array filters and coercion', () => {
      const filter = {
        status: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        priority: Priority.HIGH,
        isOverdue: 'true',
        search: 'HVAC',
      };
      const result = taskFilterSchema.safeParse(filter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isOverdue).toBe(true);
      }
    });

    it('validates sort schema with defaults', () => {
      const emptySort = {};
      const result = taskSortSchema.safeParse(emptySort);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.field).toBe('createdAt');
        expect(result.data.order).toBe('desc');
      }
    });

    it('rejects invalid sort fields', () => {
      const invalidSort = { field: 'unsupportedField', order: 'asc' };
      const result = taskSortSchema.safeParse(invalidSort);
      expect(result.success).toBe(false);
    });
  });
});
