import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const pin = process.env.SITE_PIN;
  const token = process.env.SITE_AUTH_TOKEN;
  // No PIN configured => site is open (won't lock you out on a fresh setup).
  if (!pin || !token) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith('/lock') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get('site_auth')?.value;
  if (cookie === token) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/lock';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
