import {
  FieldOpsApiClient,
  AuthService,
  OrganizationService,
  MembershipService,
  ProfileService,
} from '@fieldops/api';
import { loadClientConfig } from '@fieldops/config';

let clientInstance: FieldOpsApiClient | null = null;
let currentAccessToken: string | null = null;
let currentTenantId: string | null = null;

export function setApiAuthToken(token: string | null): void {
  currentAccessToken = token;
}

export function setApiTenantId(tenantId: string | null): void {
  currentTenantId = tenantId;
}

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
      getAccessToken: async () => currentAccessToken,
      getTenantId: () => currentTenantId,
    });
  }

  return clientInstance;
}

export function getAuthService(): AuthService {
  return new AuthService(getApiClient());
}

export function getOrganizationService(): OrganizationService {
  return new OrganizationService(getApiClient());
}

export function getMembershipService(): MembershipService {
  return new MembershipService(getApiClient());
}

export function getProfileService(): ProfileService {
  return new ProfileService(getApiClient());
}
