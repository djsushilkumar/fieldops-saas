import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateProductionConfig,
  assertProductionConfig,
  isTestMockAllowed,
  verifySupabaseToken,
  isSupabaseConfigured,
} from '../../src/lib/supabase-server';
import { POST as syncMutationsPost } from '../../src/app/api/v1/sync/mutations/route';

describe('Phase 2 & 4: Production Fail-Fast & Fail-Closed Security Boundary', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateProductionConfig()', () => {
    it('detects and reports missing SUPABASE_URL', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_URL;
      process.env.SUPABASE_ANON_KEY = 'valid-anon-key-12345';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-67890';

      const res = validateProductionConfig();
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('SUPABASE_URL is missing'))).toBe(true);
    });

    it('rejects placeholder or example domains in SUPABASE_URL', () => {
      process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'valid-anon-key-12345';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-67890';

      const res = validateProductionConfig();
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('placeholder or example domain'))).toBe(true);
    });

    it('rejects missing or placeholder SUPABASE_ANON_KEY', () => {
      process.env.SUPABASE_URL = 'https://xyzprodproject.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-67890';

      const res = validateProductionConfig();
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('ANON_KEY is missing'))).toBe(true);
    });

    it('rejects missing or placeholder SUPABASE_SERVICE_ROLE_KEY', () => {
      process.env.SUPABASE_URL = 'https://xyzprodproject.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'valid-anon-key-12345';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const res = validateProductionConfig();
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('SUPABASE_SERVICE_ROLE_KEY is missing'))).toBe(true);
    });

    it('rejects service role key being identical to anonymous key', () => {
      process.env.SUPABASE_URL = 'https://xyzprodproject.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'same-token-value';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'same-token-value';

      const res = validateProductionConfig();
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('must not be identical'))).toBe(true);
    });

    it('approves a valid, production-grade configuration', () => {
      process.env.SUPABASE_URL = 'https://xyzprodproject.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role';

      const res = validateProductionConfig();
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });
  });

  function setNodeEnv(val: string) {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  }

  describe('assertProductionConfig()', () => {
    it('throws descriptive configuration error when NODE_ENV is production and variables are missing', () => {
      setNodeEnv('production');
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => assertProductionConfig()).toThrowError(
        /\[CRITICAL CONFIGURATION ERROR\] Production startup\/runtime validation failed/
      );
    });

    it('does not throw when configuration is valid in production', () => {
      setNodeEnv('production');
      process.env.SUPABASE_URL = 'https://xyzprodproject.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role';

      expect(() => assertProductionConfig()).not.toThrow();
    });
  });

  describe('isTestMockAllowed() Boundary', () => {
    it('returns false in production even if ENABLE_TEST_MOCKS is set to true', () => {
      setNodeEnv('production');
      process.env.ENABLE_TEST_MOCKS = 'true';
      expect(isTestMockAllowed()).toBe(false);

      setNodeEnv('development');
      process.env.APP_ENV = 'production';
      expect(isTestMockAllowed()).toBe(false);
    });

    it('returns false in non-production when ENABLE_TEST_MOCKS is not true', () => {
      setNodeEnv('development');
      delete process.env.APP_ENV;
      delete process.env.ENABLE_TEST_MOCKS;
      expect(isTestMockAllowed()).toBe(false);
    });

    it('returns true only in non-production when ENABLE_TEST_MOCKS is explicitly true', () => {
      setNodeEnv('test');
      delete process.env.APP_ENV;
      process.env.ENABLE_TEST_MOCKS = 'true';
      expect(isTestMockAllowed()).toBe(true);
    });
  });

  describe('verifySupabaseToken() Mock Token Rejection', () => {
    it('rejects unsigned fo_jwt_ mock token when test mocks are disabled', async () => {
      delete process.env.ENABLE_TEST_MOCKS;
      const fakeToken = 'fo_jwt_eyJzdWIiOiJ1c3JfdGVzdCIsImVtYWlsIjoidGVzdEBmaWVsZG9wcy5jb20ifQ';
      const result = await verifySupabaseToken(fakeToken);

      expect(result.user).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain('Unsigned mock token rejected');
    });

    it('returns error when Supabase backend is not configured', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.ENABLE_TEST_MOCKS;

      const result = await verifySupabaseToken('real_supabase_access_token_123');
      expect(result.user).toBeNull();
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain('unavailable');
    });
  });

  describe('Phase 3: Sync Mutations Route Fail-Closed on Unconfigured/Offline DB', () => {
    it('returns 503 SERVICE_UNAVAILABLE and never returns false APPLIED when DB is unconfigured', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.ENABLE_TEST_MOCKS;

      const req = new NextRequest(new URL('https://app.fieldops.test/api/v1/sync/mutations'), {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid_token',
          'x-tenant-id': 'org_123',
        },
        body: JSON.stringify({
          mutations: [
            {
              mutationId: 'mut_001',
              idempotencyKey: 'idem_001',
              entityType: 'task',
              entityId: 'tsk_001',
              action: 'transition',
              payload: { status: 'COMPLETED' },
            },
          ],
        }),
      });

      const response = await syncMutationsPost(req);
      // Because Supabase is unconfigured, requireTenantContext fails closed with 503
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('SERVICE_UNAVAILABLE');
      // Must not contain any APPLIED status
      expect(JSON.stringify(data)).not.toContain('"status":"APPLIED"');
    });
  });
});
