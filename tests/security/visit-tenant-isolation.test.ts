import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  LocationService,
  VisitService,
} from '@fieldops/api';
import {
  TenantId,
  LocationId,
  VisitId,
  ErrorCode,
  LocationStatus,
  ProofType,
  IsoDateTime,
} from '@fieldops/types';

describe('Security Suite: Field Operations Tenant Isolation & Cross-Tenant Protection', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('rejects reading a visit belonging to Tenant B when authenticated as Tenant A', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      // Simulated RLS enforcement: visit-tenant-b-1 belongs to Tenant B
      if (url.includes('/api/v1/visits/visit-tenant-b-1') && requestTenant === tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cross-tenant visit access strictly prohibited.',
              request_id: 'req_sec_visit_iso_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const visitService = new VisitService(client);

    await expect(visitService.getVisit('visit-tenant-b-1' as VisitId)).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects recording check-in on a Tenant B visit when authenticated as Tenant A', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      if (url.includes('/api/v1/visits/visit-tenant-b-1/checkin') && requestTenant === tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cannot record check-in on a visit owned by another organization.',
              request_id: 'req_sec_checkin_iso_002',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const visitService = new VisitService(client);

    await expect(
      visitService.recordCheckin('visit-tenant-b-1' as VisitId, {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracyMeters: 10,
        clientCapturedAt: '2026-09-28T16:00:00.000Z' as IsoDateTime,
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects archiving a location belonging to Tenant B when authenticated as Tenant A', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      if (url.includes('/api/v1/locations/loc-tenant-b-1') && requestTenant === tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Location does not belong to the active organization.',
              request_id: 'req_sec_loc_iso_003',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const locationService = new LocationService(client);

    await expect(
      locationService.archiveLocation('loc-tenant-b-1' as LocationId)
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('rejects creating proof on a Tenant B visit when authenticated as Tenant A', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      if (url.includes('/api/v1/visits/visit-tenant-b-1/proofs') && requestTenant === tenantA) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cannot attach proof evidence to a cross-tenant visit.',
              request_id: 'req_sec_proof_iso_004',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_user',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const visitService = new VisitService(client);

    await expect(
      visitService.createProof('visit-tenant-b-1' as VisitId, {
        proofType: ProofType.PHOTO,
        storagePath: 'tenants/tb/photo.jpg',
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });
});
