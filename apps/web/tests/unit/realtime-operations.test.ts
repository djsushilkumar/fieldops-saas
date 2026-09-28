import { describe, it, expect, vi } from 'vitest';
import {
  getTenantChannelName,
  realtimeRegistry,
  RealtimePayload,
} from '../../src/lib/realtime';
import { TenantId } from '@fieldops/types';

describe('Realtime Operations Client & Tenant Isolation Tests', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('generates strictly isolated tenant channel names', () => {
    expect(getTenantChannelName(tenantA)).toBe(`tenant:${tenantA}`);
    expect(getTenantChannelName(tenantB)).toBe(`tenant:${tenantB}`);
    expect(getTenantChannelName(tenantA)).not.toBe(getTenantChannelName(tenantB));
  });

  it('dispatches events strictly to the subscribed tenant channel', () => {
    const callbackA = vi.fn();
    const callbackB = vi.fn();

    const unsubA = realtimeRegistry.subscribe(tenantA, callbackA);
    const unsubB = realtimeRegistry.subscribe(tenantB, callbackB);

    const payloadA: RealtimePayload = {
      eventType: 'INSERT',
      table: 'tasks',
      schema: 'public',
      new: { id: 'task-1', title: 'Task in Org A' },
      old: null,
    };

    // Emit event in tenant A
    realtimeRegistry.emit(tenantA, payloadA);

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackA).toHaveBeenCalledWith(payloadA);
    // Tenant B must never receive events from Tenant A
    expect(callbackB).not.toHaveBeenCalled();

    // Clean up
    unsubA();
    unsubB();
  });

  it('cleans up subscription handlers upon unmount/unsubscribe', () => {
    const callback = vi.fn();
    const unsubscribe = realtimeRegistry.subscribe(tenantA, callback);

    expect(realtimeRegistry.getSubscriberCount(tenantA)).toBeGreaterThanOrEqual(1);

    unsubscribe();
    expect(realtimeRegistry.getSubscriberCount(tenantA)).toBe(0);

    // Emitting after unsubscribe must not trigger callback
    realtimeRegistry.emit(tenantA, {
      eventType: 'UPDATE',
      table: 'visits',
      schema: 'public',
      new: { id: 'vis-1' },
      old: null,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('clears all tenant subscriptions upon tenant context switch', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    realtimeRegistry.subscribe(tenantA, cb1);
    realtimeRegistry.subscribe(tenantA, cb2);

    expect(realtimeRegistry.getSubscriberCount(tenantA)).toBe(2);

    realtimeRegistry.clearTenant(tenantA);
    expect(realtimeRegistry.getSubscriberCount(tenantA)).toBe(0);
  });
});
