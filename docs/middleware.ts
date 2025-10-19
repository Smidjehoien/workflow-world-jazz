import { get } from '@vercel/edge-config';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkTeamMembership } from './lib/check-membership';

const { rewrite: rewriteLLM } = rewritePath('/docs/*path', '/llms.mdx/*path');

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

    const allowedTeams = (await get('allowedTeams')) as { id: string }[] | null;
    const allowedTeamIds = allowedTeams?.map((team) => team.id) ?? [];

    const isAllowed = allowedTeamIds.some((teamId) => teamIds.includes(teamId));

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

  if (isMarkdownPreferred(request)) {
    const result = rewriteLLM(request.nextUrl.pathname);
    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl));
    }
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
