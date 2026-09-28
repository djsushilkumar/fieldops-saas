import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, Next.js internal routes, and direct public files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('fieldops_access_token')?.value;
  const activeOrgId = request.cookies.get('fieldops_active_org_id')?.value;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // 1. Authenticated user attempting to visit public auth screens
  if (token && isPublicPath) {
    const destination = activeOrgId ? '/dashboard' : '/org/select';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // 2. Unauthenticated user attempting to visit protected routes
  if (!token && !isPublicPath && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated user on dashboard/org-dependent routes without active tenant
  if (token && !activeOrgId && (pathname.startsWith('/dashboard') || pathname.startsWith('/organization'))) {
    return NextResponse.redirect(new URL('/org/select', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
