import { z } from 'zod';
import { AppEnvironment } from '@fieldops/types';

// =============================================================================
// 1. SCHEMAS
// =============================================================================

export const appEnvironmentSchema = z.enum(['development', 'staging', 'production', 'test']);

/**
 * Public configuration safe for Web Browser and Mobile Clients.
 * ONLY NEXT_PUBLIC_* variables belong here.
 */
export const clientConfigSchema = z.object({
  appEnv: appEnvironmentSchema.default('development'),
  supabaseUrl: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  supabaseAnonKey: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty'),
  appUrl: z.string().url().default('http://localhost:3000'),
  apiUrl: z.string().url().default('http://localhost:3000/api/v1'),
  enableAnalytics: z.boolean().default(false),
});

export type ClientConfig = z.infer<typeof clientConfigSchema>;

/**
 * Privileged server configuration.
 * MUST NEVER BE EXPOSED TO CLIENT CODE.
 */
export const serverConfigSchema = clientConfigSchema.extend({
  supabaseServiceRoleKey: z
    .string()
    .min(10, 'SUPABASE_SERVICE_ROLE_KEY is required on the server'),
  masterEncryptionKey: z
    .string()
    .min(32, 'SERVER_SECRET_MASTER_ENCRYPTION_KEY must be at least 32 characters'),
  databaseUrl: z.string().min(1).optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

// =============================================================================
// 2. RUNTIME LOADERS
// =============================================================================

/**
 * Detects whether the current execution context is a browser.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Loads client-safe configuration from environment variables.
 */
export function loadClientConfig(env: Record<string, string | undefined> = process.env): ClientConfig {
  const parsed = clientConfigSchema.safeParse({
    appEnv: (env.APP_ENV || env.NEXT_PUBLIC_APP_ENV || 'development') as AppEnvironment,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    apiUrl: env.NEXT_PUBLIC_API_URL,
    enableAnalytics: env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  });

  if (!parsed.success) {
    throw new Error(
      `[FieldOps Config] Invalid client configuration:\n${parsed.error.issues
        .map((i) => ` - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    );
  }

  return parsed.data;
}

/**
 * Loads privileged server configuration.
 * Throws immediately if called within a browser context.
 */
export function loadServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  if (isBrowser()) {
    throw new Error(
      '[FieldOps Security Violation] Attempted to load server secrets within browser environment.'
    );
  }

  const clientConfig = loadClientConfig(env);

  const parsed = serverConfigSchema.safeParse({
    ...clientConfig,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    masterEncryptionKey: env.SERVER_SECRET_MASTER_ENCRYPTION_KEY,
    databaseUrl: env.DATABASE_URL,
    logLevel: env.LOG_LEVEL || 'info',
  });

  if (!parsed.success) {
    throw new Error(
      `[FieldOps Config] Invalid server configuration:\n${parsed.error.issues
        .map((i) => ` - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`
    );
  }

  return parsed.data;
}
