import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  // If we have a production URL configured and the current hostname matches it,
  // redirect to the coming soon page
  if (productionUrl && hostname === productionUrl) {
    // Don't redirect if already on the coming-soon page
    if (!request.nextUrl.pathname.startsWith('/coming-soon')) {
      return NextResponse.redirect(new URL('/coming-soon', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
