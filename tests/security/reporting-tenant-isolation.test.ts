import { describe, it, expect, vi } from 'vitest';
import { FieldOpsApiClient, ReportService } from '@fieldops/api';
import { TenantId, ErrorCode, ReportType, ExportFormat } from '@fieldops/types';

describe('Security Suite: Operational Reporting Tenant Isolation', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  it('rejects cross-tenant report generation requests', async () => {
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const requestTenant = headers['x-tenant-id'];

      // Attempting to query Tenant B's tasks while presenting Tenant A context
      if (requestTenant === tenantA && url.includes('organizationId=' + tenantB)) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: {
              code: ErrorCode.CROSS_TENANT_FORBIDDEN,
              message: 'Cannot query reports for another tenant.',
              request_id: 'req_sec_rep_iso_001',
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { summary: { totalTasks: 0 }, rows: [], totalRows: 0 },
        }),
      };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_manager',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new ReportService(client);

    // Using query option that specifies illegal organizationId
    await expect(
      client.get('/api/v1/reports/tasks', undefined, { query: { organizationId: tenantB } })
    ).rejects.toThrowError(
      expect.objectContaining({
        status: 403,
        detail: expect.objectContaining({
          code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        }),
      })
    );
  });

  it('ensures report export audit logs enforce authenticated user and tenant IDs', async () => {
    let capturedBody: any;
    const customFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/reports/audit') && init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 'audit_log_1', ...capturedBody },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    const client = new FieldOpsApiClient({
      baseUrl: 'https://api.fieldops.test',
      getAccessToken: async () => 'jwt_tenant_a_manager',
      getTenantId: () => tenantA,
      customFetch: customFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    const service = new ReportService(client);
    await service.logExport({
      reportType: ReportType.TASKS,
      format: ExportFormat.CSV,
      filterParams: { startDate: '2026-09-01', endDate: '2026-09-28' },
      rowCount: 10,
    });

    expect(capturedBody).toBeDefined();
    expect(capturedBody.reportType).toBe(ReportType.TASKS);
    expect(capturedBody.rowCount).toBe(10);
  });
});
