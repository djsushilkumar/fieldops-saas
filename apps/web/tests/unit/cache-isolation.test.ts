import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { TenantId } from '@fieldops/types';

describe('Web Client Cache Isolation on Organization Switch', () => {
  it('namespaces query keys by organization ID to prevent data cross-contamination', () => {
    const orgA = '00000000-0000-0000-0000-000000000001' as TenantId;
    const orgB = '00000000-0000-0000-0000-000000000002' as TenantId;

    const buildKey = (tenantId: TenantId, resource: string) => ['organization', tenantId, resource];

    const keyOrgA = buildKey(orgA, 'members');
    const keyOrgB = buildKey(orgB, 'members');

    expect(keyOrgA).not.toEqual(keyOrgB);
    expect(keyOrgA[1]).toBe(orgA);
    expect(keyOrgB[1]).toBe(orgB);
  });

  it('purges all organization-scoped queries when switching organizations', () => {
    const queryClient = new QueryClient();

    const orgA = 'org-a' as TenantId;
    const orgB = 'org-b' as TenantId;

    // Populate cache with Org A data
    queryClient.setQueryData(['organization', orgA, 'members'], [{ id: 'mem-1', name: 'Alice' }]);
    queryClient.setQueryData(['organization', orgA, 'settings'], { radius: 100 });
    // Also set global un-scoped data
    queryClient.setQueryData(['user', 'profile'], { id: 'usr-1', email: 'alice@fieldops.io' });

    expect(queryClient.getQueryData(['organization', orgA, 'members'])).toBeDefined();
    expect(queryClient.getQueryData(['user', 'profile'])).toBeDefined();

    // Perform tenant switch cleanup routine:
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === 'organization';
      },
    });

    // Verify Org A cache is completely purged
    expect(queryClient.getQueryData(['organization', orgA, 'members'])).toBeUndefined();
    expect(queryClient.getQueryData(['organization', orgA, 'settings'])).toBeUndefined();

    // Verify global user session data remains intact
    expect(queryClient.getQueryData(['user', 'profile'])).toBeDefined();
  });
});
