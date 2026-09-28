import { describe, it, expect, vi } from 'vitest';
import {
  FieldOpsApiClient,
  LocationService,
  VisitService,
} from '../src/index';
import {
  LocationId,
  VisitId,
  UserId,
  TenantId,
  LocationStatus,
  VisitStatus,
  LocationVerificationResult,
  ProofType,
  IsoDateTime,
} from '@fieldops/types';

describe('Phase 05 LocationService & VisitService', () => {
  const mockLocation = {
    id: 'loc_sf_01' as LocationId,
    organizationId: 'ten_01' as TenantId,
    name: 'SF Substation North',
    address: '500 Howard St, San Francisco, CA',
    latitude: 37.7892,
    longitude: -122.3981,
    allowedRadiusMeters: 150,
    status: LocationStatus.ACTIVE,
    createdBy: 'usr_owner' as UserId,
    createdAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
  };

  const mockVisit = {
    id: 'vis_101' as VisitId,
    organizationId: 'ten_01' as TenantId,
    locationId: 'loc_sf_01' as LocationId,
    assignedTo: 'usr_worker' as UserId,
    scheduledStart: '2026-09-28T14:00:00.000Z' as IsoDateTime,
    scheduledEnd: '2026-09-28T16:00:00.000Z' as IsoDateTime,
    status: VisitStatus.SCHEDULED,
    version: 1,
    createdBy: 'usr_owner' as UserId,
    createdAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-28T10:00:00.000Z' as IsoDateTime,
  };

  describe('LocationService', () => {
    it('listLocations formats query parameters properly', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [mockLocation],
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
      });
      const locationService = new LocationService(client);

      const result = await locationService.listLocations({
        status: LocationStatus.ACTIVE,
        search: 'Substation',
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('SF Substation North');

      const calledUrl = new URL(customFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/api/v1/locations');
      expect(calledUrl.searchParams.get('status')).toBe(LocationStatus.ACTIVE);
      expect(calledUrl.searchParams.get('search')).toBe('Substation');
    });

    it('createLocation issues POST with correct payload', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockLocation,
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
      });
      const locationService = new LocationService(client);

      const payload = {
        name: 'SF Substation North',
        address: '500 Howard St, San Francisco, CA',
        latitude: 37.7892,
        longitude: -122.3981,
        allowedRadiusMeters: 150,
      };

      const result = await locationService.createLocation(payload);
      expect(result.id).toBe('loc_sf_01');

      const calledOptions = customFetch.mock.calls[0][1];
      expect(calledOptions.method).toBe('POST');
      expect(JSON.parse(calledOptions.body)).toEqual(payload);
    });

    it('archiveLocation issues PATCH with status ARCHIVED', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { ...mockLocation, status: LocationStatus.ARCHIVED },
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
      });
      const locationService = new LocationService(client);

      const result = await locationService.archiveLocation('loc_sf_01' as LocationId);
      expect(result.status).toBe(LocationStatus.ARCHIVED);

      const calledOptions = customFetch.mock.calls[0][1];
      expect(calledOptions.method).toBe('PATCH');
      expect(JSON.parse(calledOptions.body)).toEqual({ status: LocationStatus.ARCHIVED });
    });
  });

  describe('VisitService', () => {
    it('listVisits formats query, pagination, and sorting', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            items: [mockVisit],
            pagination: {
              total: 1,
              page: 1,
              pageSize: 20,
              hasMore: false,
            },
          },
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
      });
      const visitService = new VisitService(client);

      const result = await visitService.listVisits(
        { status: VisitStatus.SCHEDULED, assignedTo: 'usr_worker' as UserId },
        { page: 1, pageSize: 20 },
        { field: 'scheduledStart', order: 'asc' }
      );

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);

      const calledUrl = new URL(customFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/api/v1/visits');
      expect(calledUrl.searchParams.get('status')).toBe(VisitStatus.SCHEDULED);
      expect(calledUrl.searchParams.get('assignedTo')).toBe('usr_worker');
      expect(calledUrl.searchParams.get('sortField')).toBe('scheduledStart');
      expect(calledUrl.searchParams.get('sortOrder')).toBe('asc');
    });

    it('recordCheckin posts to /api/v1/visits/:id/checkin', async () => {
      const mockCheckin = {
        id: 'chk_101',
        visitId: 'vis_101' as VisitId,
        organizationId: 'ten_01' as TenantId,
        workerId: 'usr_worker' as UserId,
        latitude: 37.7892,
        longitude: -122.3981,
        accuracyMeters: 10,
        distanceMeters: 0,
        verificationResult: LocationVerificationResult.VALID,
        isException: false,
        clientCapturedAt: '2026-09-28T14:02:00.000Z' as IsoDateTime,
        serverReceivedAt: '2026-09-28T14:02:01.000Z' as IsoDateTime,
        createdAt: '2026-09-28T14:02:01.000Z' as IsoDateTime,
      };

      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockCheckin,
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
      });
      const visitService = new VisitService(client);

      const payload = {
        latitude: 37.7892,
        longitude: -122.3981,
        accuracyMeters: 10,
        clientCapturedAt: '2026-09-28T14:02:00.000Z' as IsoDateTime,
      };

      const result = await visitService.recordCheckin('vis_101' as VisitId, payload);
      expect(result.verificationResult).toBe(LocationVerificationResult.VALID);

      const calledUrl = new URL(customFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/api/v1/visits/vis_101/checkin');
    });

    it('createProof posts to /api/v1/visits/:id/proofs', async () => {
      const mockProof = {
        id: 'prf_101',
        visitId: 'vis_101' as VisitId,
        organizationId: 'ten_01' as TenantId,
        proofType: ProofType.PHOTO,
        storagePath: 'tenants/t1/visits/v1/photo.jpg',
        createdBy: 'usr_worker' as UserId,
        createdAt: '2026-09-28T14:30:00.000Z' as IsoDateTime,
      };

      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockProof,
        }),
      });

      const client = new FieldOpsApiClient({
        baseUrl: 'https://api.fieldops.test',
        customFetch: customFetch as unknown as typeof fetch,
      });
      const visitService = new VisitService(client);

      const payload = {
        proofType: ProofType.PHOTO,
        storagePath: 'tenants/t1/visits/v1/photo.jpg',
      };

      const result = await visitService.createProof('vis_101' as VisitId, payload);
      expect(result.proofType).toBe(ProofType.PHOTO);

      const calledUrl = new URL(customFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/api/v1/visits/vis_101/proofs');
    });
  });
});
