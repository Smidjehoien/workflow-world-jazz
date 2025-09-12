import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkTeamMembership } from './lib/check-membership';

// Add teams we want to allow here
const ALLOWED_TEAM_IDS = [
  'team_nLlpyC6REAqxydlFKbrMDlud', // Vercel
  'team_nO2mCG4W8IxPIeKoSsqwAxxB', // Vercel Labs
  'team_xiRKInFi7lBd1gTqyAGuzmkC', // Garden Computer (jazz tools, for workflow)
  'team_rS1hfVQpiVcXq9ZTnAUAh6ym', // Interfere
  'team_HNGfD0SVayaivBJpSGH6VqAM', // Midpage AI
  'team_druD8aGMg4cYS4zzJ2Pb6c3r', // Comfy Deploy
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Skip auth for auth routes and coming-soon page
  if (
    request.nextUrl.pathname.startsWith('/api/auth/') ||
    request.nextUrl.pathname.startsWith('/coming-soon') ||
    request.nextUrl.pathname.startsWith('/auth/error')
  ) {
    return response;
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token');

  if (!accessToken) {
    return NextResponse.redirect(new URL('/api/auth/authorize', request.url));
  }

  try {
    const teamIds = await checkTeamMembership(accessToken.value);

    const isAllowed = ALLOWED_TEAM_IDS.some((teamId) =>
      teamIds.includes(teamId)
    );

    if (!isAllowed) {
      return NextResponse.redirect(new URL('/coming-soon', request.url));
    }

    response.headers.set(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate'
    );
  } catch (error) {
    console.error('Error checking team membership:', error);
    return NextResponse.redirect(new URL('/coming-soon', request.url));
  }

  return response;
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
     * - *.tgz (tgz files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.tgz$).*)',
  ],
};
