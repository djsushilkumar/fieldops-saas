'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  AuthState,
  UserProfile,
  Membership,
  UserRole,
  AuthSession,
  TenantId,
} from '@fieldops/types';
import {
  getAuthService,
  setApiAuthToken,
  setApiTenantId,
} from './api';

export interface AuthContextType {
  readonly authState: AuthState;
  readonly user: UserProfile | null;
  readonly token: string | null;
  readonly memberships: readonly Membership[];
  readonly activeMembership: Membership | null;
  readonly activeRole: UserRole | null;
  readonly error: string | null;
  readonly signIn: (credentials: { email: string; password: string }) => Promise<void>;
  readonly signUp: (payload: {
    email: string;
    password: string;
    fullName: string;
    organizationName?: string;
    organizationSlug?: string;
  }) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly setActiveMembership: (membership: Membership | null) => void;
  readonly clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setCookie(name: string, value: string, days: number = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(AuthState.UNKNOWN);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<readonly Membership[]>([]);
  const [activeMembership, setActiveMembershipState] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authService = useMemo(() => getAuthService(), []);

  const setActiveMembership = useCallback((membership: Membership | null) => {
    setActiveMembershipState(membership);
    if (membership) {
      setApiTenantId(membership.organizationId);
      setCookie('fieldops_active_org_id', membership.organizationId);
    } else {
      setApiTenantId(null);
      removeCookie('fieldops_active_org_id');
    }
  }, []);

  const applySession = useCallback((session: AuthSession) => {
    setUser(session.user);
    setToken(session.tokens.accessToken);
    setApiAuthToken(session.tokens.accessToken);
    setCookie('fieldops_access_token', session.tokens.accessToken);

    setMemberships(session.availableMemberships || []);

    const savedOrgId = getCookie('fieldops_active_org_id');
    const matched = session.availableMemberships?.find(
      (m) => m.organizationId === (savedOrgId as TenantId)
    );

    const active = matched || session.activeMembership || session.availableMemberships?.[0] || null;
    setActiveMembership(active);
    setAuthState(AuthState.AUTHENTICATED);
    setError(null);
  }, [setActiveMembership]);

  // Restore session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const storedToken = getCookie('fieldops_access_token');
        if (!storedToken) {
          if (isMounted) {
            setAuthState(AuthState.UNAUTHENTICATED);
          }
          return;
        }

        setApiAuthToken(storedToken);
        setToken(storedToken);
        setAuthState(AuthState.AUTHENTICATING);

        const session = await authService.getSession();
        if (!isMounted) return;

        if (session) {
          applySession(session);
        } else {
          setAuthState(AuthState.UNAUTHENTICATED);
          removeCookie('fieldops_access_token');
          removeCookie('fieldops_active_org_id');
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setAuthState(AuthState.AUTH_ERROR);
        setError(err instanceof Error ? err.message : 'Session initialization failed');
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [authService, applySession]);

  const signIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      try {
        setAuthState(AuthState.AUTHENTICATING);
        setError(null);
        const session = await authService.signIn(credentials);
        applySession(session);
      } catch (err: unknown) {
        setAuthState(AuthState.AUTH_ERROR);
        const msg = err instanceof Error ? err.message : 'Sign in failed';
        setError(msg);
        throw err;
      }
    },
    [authService, applySession]
  );

  const signUp = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      organizationName?: string;
      organizationSlug?: string;
    }) => {
      try {
        setAuthState(AuthState.AUTHENTICATING);
        setError(null);
        const session = await authService.signUp(payload);
        applySession(session);
      } catch (err: unknown) {
        setAuthState(AuthState.AUTH_ERROR);
        const msg = err instanceof Error ? err.message : 'Sign up failed';
        setError(msg);
        throw err;
      }
    },
    [authService, applySession]
  );

  const signOut = useCallback(async () => {
    try {
      await authService.signOut().catch(() => {});
    } finally {
      setUser(null);
      setToken(null);
      setMemberships([]);
      setActiveMembership(null);
      setApiAuthToken(null);
      removeCookie('fieldops_access_token');
      removeCookie('fieldops_active_org_id');
      setAuthState(AuthState.UNAUTHENTICATED);
      setError(null);
    }
  }, [authService, setActiveMembership]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextType>(
    () => ({
      authState,
      user,
      token,
      memberships,
      activeMembership,
      activeRole: activeMembership?.role || null,
      error,
      signIn,
      signUp,
      signOut,
      setActiveMembership,
      clearError,
    }),
    [
      authState,
      user,
      token,
      memberships,
      activeMembership,
      error,
      signIn,
      signUp,
      signOut,
      setActiveMembership,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
