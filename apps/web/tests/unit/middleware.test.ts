import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

describe('Web Route Guard Middleware', () => {
  function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
    const url = new URL(`https://app.fieldops.test${pathname}`);
    const req = new NextRequest(url);
    for (const [name, value] of Object.entries(cookies)) {
      req.cookies.set(name, value);
    }
    return req;
  }

  it('allows unauthenticated requests to public auth routes', () => {
    const req = createMockRequest('/login');
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated requests from protected routes to /login', () => {
    const req = createMockRequest('/dashboard');
    const res = middleware(req);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('redirect=%2Fdashboard');
  });

  it('redirects authenticated requests from /login to /dashboard when tenant is selected', () => {
    const req = createMockRequest('/login', {
      fieldops_access_token: 'valid_token_xyz',
      fieldops_active_org_id: 'org_123',
    });
    const res = middleware(req);
    const location = res.headers.get('location');
    expect(location).toContain('/dashboard');
  });

  it('redirects authenticated requests from /login to /org/select when no tenant is selected', () => {
    const req = createMockRequest('/login', {
      fieldops_access_token: 'valid_token_xyz',
    });
    const res = middleware(req);
    const location = res.headers.get('location');
    expect(location).toContain('/org/select');
  });

  it('redirects authenticated requests on /dashboard to /org/select if no active tenant is selected', () => {
    const req = createMockRequest('/dashboard', {
      fieldops_access_token: 'valid_token_xyz',
    });
    const res = middleware(req);
    const location = res.headers.get('location');
    expect(location).toContain('/org/select');
  });

  it('allows authenticated requests on /dashboard when tenant is active', () => {
    const req = createMockRequest('/dashboard', {
      fieldops_access_token: 'valid_token_xyz',
      fieldops_active_org_id: 'org_123',
    });
    const res = middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});
