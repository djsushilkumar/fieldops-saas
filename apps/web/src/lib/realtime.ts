import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TenantId } from '@fieldops/types';

export type RealtimeTable = 'tasks' | 'visits' | 'attendance_records' | 'worker_activities';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimePayload<T = unknown> {
  eventType: RealtimeEventType;
  table: RealtimeTable;
  schema: string;
  new: T | null;
  old: T | null;
  errors?: unknown;
}

export type RealtimeCallback<T = unknown> = (payload: RealtimePayload<T>) => void;

/**
 * Generates the standardized tenant channel identifier adhering to tenant isolation rules.
 */
export function getTenantChannelName(tenantId: TenantId): string {
  return `tenant:${tenantId}`;
}

/**
 * In-memory registry of active tenant channels for the web application session.
 */
class TenantRealtimeRegistry {
  private activeSubscriptions = new Map<string, Set<RealtimeCallback>>();

  public subscribe(tenantId: TenantId, callback: RealtimeCallback): () => void {
    const channel = getTenantChannelName(tenantId);
    if (!this.activeSubscriptions.has(channel)) {
      this.activeSubscriptions.set(channel, new Set());
    }
    const listeners = this.activeSubscriptions.get(channel)!;
    listeners.add(callback);

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.activeSubscriptions.delete(channel);
      }
    };
  }

  public getSubscriberCount(tenantId: TenantId): number {
    const channel = getTenantChannelName(tenantId);
    return this.activeSubscriptions.get(channel)?.size ?? 0;
  }

  public emit(tenantId: TenantId, payload: RealtimePayload): void {
    const channel = getTenantChannelName(tenantId);
    const listeners = this.activeSubscriptions.get(channel);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error('[RealtimeRegistry] Error invoking callback:', e);
        }
      });
    }
  }

  public clearTenant(tenantId: TenantId): void {
    const channel = getTenantChannelName(tenantId);
    this.activeSubscriptions.delete(channel);
  }
}

export const realtimeRegistry = new TenantRealtimeRegistry();

/**
 * React hook to subscribe to tenant operational events and automatically invalidate
 * relevant TanStack Query caches.
 */
export function useTenantRealtime(tenantId?: TenantId | null, onEvent?: RealtimeCallback) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = realtimeRegistry.subscribe(tenantId, (payload) => {
      // Invalidate queries namespaced under this organization
      if (payload.table === 'tasks') {
        queryClient.invalidateQueries({ queryKey: ['organization', tenantId, 'tasks'] });
      } else if (payload.table === 'visits') {
        queryClient.invalidateQueries({ queryKey: ['organization', tenantId, 'visits'] });
      } else if (payload.table === 'attendance_records') {
        queryClient.invalidateQueries({ queryKey: ['organization', tenantId, 'attendance'] });
      } else if (payload.table === 'worker_activities') {
        queryClient.invalidateQueries({ queryKey: ['organization', tenantId, 'activities'] });
      }

      // Also trigger consumer callback if provided
      if (onEvent) {
        onEvent(payload);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [tenantId, queryClient, onEvent]);
}
