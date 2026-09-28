import { describe, it, expect } from 'vitest';
import {
  loadClientConfig,
  loadServerConfig,
  clientConfigSchema,
  serverConfigSchema,
} from '../src/index';

describe('Configuration Architecture', () => {
  const validClientEnv = {
    NEXT_PUBLIC_APP_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
  };

  const validServerEnv = {
    ...validClientEnv,
    SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-role-key',
    SERVER_SECRET_MASTER_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
    LOG_LEVEL: 'info',
  };

  it('successfully loads valid client configuration', () => {
    const config = loadClientConfig(validClientEnv);
    expect(config.supabaseUrl).toBe('https://example.supabase.co');
    expect(config.supabaseAnonKey).toBe('test-anon-key');
    expect(config.appEnv).toBe('development');
  });

  it('fails fast when required client configuration is missing', () => {
    expect(() =>
      loadClientConfig({
        ...validClientEnv,
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-valid-url',
      })
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL must be a valid URL/);
  });

  it('fails fast when NEXT_PUBLIC_SUPABASE_ANON_KEY is empty', () => {
    expect(() =>
      loadClientConfig({
        ...validClientEnv,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      })
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty/);
  });

  it('successfully loads server configuration in server environment', () => {
    const config = loadServerConfig(validServerEnv);
    expect(config.supabaseServiceRoleKey).toBe('super-secret-service-role-key');
    expect(config.masterEncryptionKey).toBe('0123456789abcdef0123456789abcdef');
  });

  it('fails fast when server secret master encryption key is too short', () => {
    expect(() =>
      loadServerConfig({
        ...validServerEnv,
        SERVER_SECRET_MASTER_ENCRYPTION_KEY: 'short-key',
      })
    ).toThrowError(/SERVER_SECRET_MASTER_ENCRYPTION_KEY must be at least 32 characters/);
  });

  it('fails fast when SUPABASE_SERVICE_ROLE_KEY is missing on server', () => {
    const invalidEnv = { ...validServerEnv };
    delete (invalidEnv as Record<string, string | undefined>).SUPABASE_SERVICE_ROLE_KEY;

    expect(() => loadServerConfig(invalidEnv)).toThrowError(/supabaseServiceRoleKey/i);
  });
});
