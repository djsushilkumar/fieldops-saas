import { FieldOpsApiClient } from '@fieldops/api';
import { loadClientConfig } from '@fieldops/config';

let clientInstance: FieldOpsApiClient | null = null;

export function getApiClient(): FieldOpsApiClient {
  if (!clientInstance) {
    const config = loadClientConfig({
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
    });

    clientInstance = new FieldOpsApiClient({
      baseUrl: config.apiUrl,
      getAccessToken: async () => {
        // Will integrate with Supabase session in Phase 03
        return null;
      },
    });
  }

  return clientInstance;
}
