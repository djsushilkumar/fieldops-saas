import { describe, it, expect } from 'vitest';
import {
  FieldOpsApiClient,
  normalizeHttpError,
  executeWithRetry,
} from '../src/index';
import { ErrorCode } from '@fieldops/types';

describe('API Client Foundation', () => {
  it('normalizes HTTP status 401 to AUTHENTICATION_ERROR', () => {
    const error = normalizeHttpError(401, null, 'req_test_401');
    expect(error.code).toBe(ErrorCode.AUTHENTICATION_ERROR);
    expect(error.request_id).toBe('req_test_401');
  });

  it('normalizes HTTP status 403 to AUTHORIZATION_ERROR', () => {
    const error = normalizeHttpError(403, null, 'req_test_403');
    expect(error.code).toBe(ErrorCode.AUTHORIZATION_ERROR);
    expect(error.request_id).toBe('req_test_403');
  });

  it('normalizes HTTP status 404 to NOT_FOUND', () => {
    const error = normalizeHttpError(404, null, 'req_test_404');
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('normalizes HTTP status 409 to CONFLICT', () => {
    const error = normalizeHttpError(409, null, 'req_test_409');
    expect(error.code).toBe(ErrorCode.CONFLICT);
  });

  it('preserves structured server error envelopes with custom ErrorCode', () => {
    const serverBody = {
      error: {
        code: ErrorCode.CROSS_TENANT_FORBIDDEN,
        message: 'Access to foreign tenant data is forbidden.',
        request_id: 'req_server_999',
      },
    };
    const error = normalizeHttpError(403, serverBody, 'req_fallback');
    expect(error.code).toBe(ErrorCode.CROSS_TENANT_FORBIDDEN);
    expect(error.message).toBe('Access to foreign tenant data is forbidden.');
    expect(error.request_id).toBe('req_server_999');
  });

  it('executes retries up to maxRetries on failure', async () => {
    let callCount = 0;
    const failingCall = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Temporary network glitch');
      }
      return 'success_payload';
    };

    const result = await executeWithRetry(failingCall, 3, 10);
    expect(result).toBe('success_payload');
    expect(callCount).toBe(3);
  });

  it('injects x-request-id and authorization headers', async () => {
    let capturedHeaders: Record<string, string> = {};
    const mockFetch = async (_url: string, init?: RequestInit): Promise<Response> => {
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { status: 'healthy' } }),
      } as unknown as Response;
    };

    const client = new FieldOpsApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      getAccessToken: async () => 'test_jwt_token',
      getTenantId: () => 'tenant_12345',
      customFetch: mockFetch as typeof fetch,
    });

    const res = await client.get<{ status: string }>('/health');
    expect(res.status).toBe('healthy');
    expect(capturedHeaders['Authorization']).toBe('Bearer test_jwt_token');
    expect(capturedHeaders['x-tenant-id']).toBe('tenant_12345');
    expect(capturedHeaders['x-request-id']).toMatch(/^req_/);
  });
});
