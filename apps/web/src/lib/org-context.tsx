'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Organization, TenantId, Membership } from '@fieldops/types';
import { useAuth } from './auth-context';
import { getOrganizationService } from './api';

export interface OrganizationContextType {
  readonly activeOrganization: Organization | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly switchOrganization: (organizationId: TenantId) => Promise<void>;
  readonly buildOrgQueryKey: (subKey: (string | number)[]) => readonly (string | number)[];
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { activeMembership, memberships, setActiveMembership } = useAuth();
  const queryClient = useQueryClient();

  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const orgService = useMemo(() => getOrganizationService(), []);

  // Sync active organization data when activeMembership changes
  useEffect(() => {
    let isCurrent = true;

    async function fetchOrgDetails() {
      if (!activeMembership) {
        setActiveOrganization(null);
        return;
      }

      setIsLoading(true);
      try {
        const org = await orgService.getOrganization(activeMembership.organizationId);
        if (isCurrent) {
          setActiveOrganization(org);
          setError(null);
        }
      } catch (err: unknown) {
        if (isCurrent) {
          // If detailed fetch fails, fall back to embedded organization from membership
          if (activeMembership.organization) {
            setActiveOrganization(activeMembership.organization);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load organization');
          }
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    fetchOrgDetails();

    return () => {
      isCurrent = false;
    };
  }, [activeMembership, orgService]);

  /**
   * Switches active organization context and rigorously clears cached queries
   * to guarantee zero cross-tenant cache pollution.
   */
  const switchOrganization = useCallback(
    async (organizationId: TenantId) => {
      const targetMembership = memberships.find((m) => m.organizationId === organizationId);
      if (!targetMembership) {
        throw new Error(`User does not have an active membership in organization ${organizationId}`);
      }

      // 1. Purge all organization-scoped queries from TanStack Query cache
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'organization';
        },
      });

      // 2. Set active membership
      setActiveMembership(targetMembership);
    },
    [memberships, queryClient, setActiveMembership]
  );

  /**
   * Helper that namespaces query keys by active organization ID.
   */
  const buildOrgQueryKey = useCallback(
    (subKey: (string | number)[]): readonly (string | number)[] => {
      const orgId = activeMembership?.organizationId || 'unscoped';
      return ['organization', orgId, ...subKey];
    },
    [activeMembership]
  );

  const value = useMemo<OrganizationContextType>(
    () => ({
      activeOrganization,
      isLoading,
      error,
      switchOrganization,
      buildOrgQueryKey,
    }),
    [activeOrganization, isLoading, error, switchOrganization, buildOrgQueryKey]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
