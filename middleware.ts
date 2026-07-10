import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, createSessionToken, getAdminCredentials } from './lib/auth';

function isBasicAuthValid(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) return false;

  try {
    const authValue = authHeader.split(' ')[1];
    const credentials = atob(authValue);
    const [user, pwd] = credentials.split(':');
    const { username, password } = getAdminCredentials();
    return user === username && pwd === password;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/login' || pathname === '/api/auth/login') {
    if (pathname === '/login') {
      const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
      const expectedToken = await createSessionToken();
      if (sessionCookie === expectedToken) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expectedToken = await createSessionToken();

  if (sessionCookie === expectedToken || isBasicAuthValid(req)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('redirect', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/procurement/:path*',
    '/maker/:path*',
    '/sales/:path*',
    '/api/:path*',
  ],
};
