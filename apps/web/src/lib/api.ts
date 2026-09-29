import {
  FieldOpsApiClient,
  AuthService,
  OrganizationService,
  MembershipService,
  ProfileService,
  TaskService,
  TeamService,
  LocationService,
  VisitService,
  AttendanceService,
  ReportService,
  BillingService,
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
    const isClient = typeof window !== 'undefined';
    const clientOrigin = isClient ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const clientApiUrl = isClient ? `${window.location.origin}/api/v1` : (process.env.NEXT_PUBLIC_API_URL || `${clientOrigin}/api/v1`);

    const config = loadClientConfig({
      NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
      NEXT_PUBLIC_APP_URL: clientOrigin,
      NEXT_PUBLIC_API_URL: clientApiUrl,
    });

    clientInstance = new FieldOpsApiClient({
      baseUrl: clientOrigin,
      getAccessToken: async () => currentAccessToken,
      getTenantId: () => currentTenantId,
      customFetch: isClient ? window.fetch.bind(window) : undefined,
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

export function getTaskService(): TaskService {
  return new TaskService(getApiClient());
}

export function getTeamService(): TeamService {
  return new TeamService(getApiClient());
}

export function getLocationService(): LocationService {
  return new LocationService(getApiClient());
}

export function getVisitService(): VisitService {
  return new VisitService(getApiClient());
}

export function getAttendanceService(): AttendanceService {
  return new AttendanceService(getApiClient());
}

export function getReportService(): ReportService {
  return new ReportService(getApiClient());
}

export function getBillingService(): BillingService {
  return new BillingService(getApiClient());
}


