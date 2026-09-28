import { describe, it, expect, vi } from 'vitest';
import {
  TenantId,
  UserId,
  OfflineMutation,
  TaskStatus,
  VisitStatus,
  UUID,
  IsoDateTime,
} from '@fieldops/types';

describe('Security Suite: Mobile Local Storage & Offline Session Security', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;
  const userA = 'u0000000-0000-0000-0000-000000000001' as UserId;
  const userB = 'u0000000-0000-0000-0000-000000000002' as UserId;

  class MockEncryptedLocalStorage {
    private storage = new Map<string, string>();
    private activeUserId: UserId | null = null;
    private activeTenantId: TenantId | null = null;

    public setSession(userId: UserId, tenantId: TenantId) {
      this.activeUserId = userId;
      this.activeTenantId = tenantId;
    }

    public put(key: string, value: string) {
      if (!this.activeTenantId || !this.activeUserId) {
        throw new Error('UNAUTHENTICATED: Cannot write to storage without active session.');
      }
      // Scoped key by tenant and user to guarantee device partitioning
      const scopedKey = `${this.activeTenantId}:${this.activeUserId}:${key}`;
      this.storage.set(scopedKey, value);
    }

    public get(key: string): string | null {
      if (!this.activeTenantId || !this.activeUserId) {
        return null;
      }
      const scopedKey = `${this.activeTenantId}:${this.activeUserId}:${key}`;
      return this.storage.get(scopedKey) || null;
    }

    public purgeUserSessionData(userId: UserId, tenantId: TenantId) {
      const prefix = `${tenantId}:${userId}:`;
      for (const k of Array.from(this.storage.keys())) {
        if (k.startsWith(prefix)) {
          this.storage.delete(k);
        }
      }
      if (this.activeUserId === userId) {
        this.activeUserId = null;
        this.activeTenantId = null;
      }
    }

    public totalStoredKeys(): number {
      return this.storage.size;
    }
  }

  describe('Multi-User Device Shared Storage Sanitization', () => {
    it('purges sensitive cached operational records upon worker logout', () => {
      const localStorage = new MockEncryptedLocalStorage();

      // 1. Worker A logs in and caches offline tasks
      localStorage.setSession(userA, tenantA);
      localStorage.put('cached_tasks', JSON.stringify([{ id: 'task-1', secretNote: 'Gate code 4921' }]));
      localStorage.put('auth_token', 'jwt_worker_a');

      expect(localStorage.get('cached_tasks')).toBeDefined();
      expect(localStorage.totalStoredKeys()).toBe(2);

      // 2. Worker A logs out
      localStorage.purgeUserSessionData(userA, tenantA);

      // Verify data is completely purged
      expect(localStorage.totalStoredKeys()).toBe(0);

      // 3. Worker B from Tenant B logs in to the same shared device
      localStorage.setSession(userB, tenantB);
      expect(localStorage.get('cached_tasks')).toBeNull();
      expect(localStorage.get('auth_token')).toBeNull();
    });
  });

  describe('Offline Queue Session Binding Security', () => {
    it('prevents offline mutations from being processed under a different user or tenant session', () => {
      interface ScopedOfflineMutation extends OfflineMutation {
        readonly authorUserId: UserId;
        readonly authorTenantId: TenantId;
      }

      const pendingQueue: ScopedOfflineMutation[] = [];

      // Worker A creates an offline mutation
      const mutationA: ScopedOfflineMutation = {
        mutationId: 'mut-1' as UUID,
        authorUserId: userA,
        authorTenantId: tenantA,
        entityType: 'VISIT',
        entityId: 'v-1' as any,
        action: 'CHECK_IN',
        payload: { notes: 'Site arrived' },
        clientTimestamp: '2026-09-28T08:00:00Z' as IsoDateTime,
        retryCount: 0,
      };
      pendingQueue.push(mutationA);

      // Evaluator checking sync authorization
      const syncMutation = (
        mutation: ScopedOfflineMutation,
        currentUserId: UserId,
        currentTenantId: TenantId
      ): { allowed: boolean; error?: string } => {
        if (mutation.authorUserId !== currentUserId || mutation.authorTenantId !== currentTenantId) {
          return {
            allowed: false,
            error: 'SESSION_MISMATCH: Queued mutation belongs to a different user session and cannot be synced.',
          };
        }
        return { allowed: true };
      };

      // If Worker B attempts to flush Worker A's pending mutation:
      const syncResult = syncMutation(pendingQueue[0], userB, tenantB);
      expect(syncResult.allowed).toBe(false);
      expect(syncResult.error).toContain('SESSION_MISMATCH');
    });
  });

  describe('Sync Conflict & Safety Invariance', () => {
    it('flags sync conflicts when server state conflicts with offline mutations', () => {
      const evaluateSyncConflict = (
        serverStatus: TaskStatus,
        attemptedTransition: TaskStatus
      ): { hasConflict: boolean; resolution: string } => {
        // If task was canceled on server while worker was offline, do not silently overwrite
        if (serverStatus === TaskStatus.CANCELED) {
          return {
            hasConflict: true,
            resolution: 'PRESERVE_SERVER_TERMINAL: Server state CANCELED takes precedence. Local edits quarantined for review.',
          };
        }
        return { hasConflict: false, resolution: 'APPLY' };
      };

      const result = evaluateSyncConflict(TaskStatus.CANCELED, TaskStatus.IN_PROGRESS);
      expect(result.hasConflict).toBe(true);
      expect(result.resolution).toContain('PRESERVE_SERVER_TERMINAL');
    });
  });
});
