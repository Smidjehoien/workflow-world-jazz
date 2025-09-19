import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { decodeNonce } from '@/lib/crypto';

interface TokenData {
  access_token: string;
  token_type: string;
  id_token: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      throw new Error('Authorization code is required');
    }

    const storedState = request.cookies.get('oauth_state')?.value;
    const storedNonce = request.cookies.get('oauth_nonce')?.value;
    const codeVerifier = request.cookies.get('oauth_code_verifier')?.value;

    if (!validate(state, storedState)) {
      throw new Error('State mismatch');
    }

    const tokenData = await exchangeCodeForToken(
      code,
      codeVerifier,
      request.nextUrl.origin
    );
    const decodedNonce = decodeNonce(tokenData.id_token);

    if (!validate(decodedNonce, storedNonce)) {
      throw new Error('Nonce mismatch');
    }

    // Create response with HTML redirect to ensure cookies are set
    const response = new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0;url=/">
          <script>window.location.href = "/";</script>
        </head>
        <body>Redirecting...</body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );

    // Set auth cookies on response
    response.cookies.set('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: tokenData.expires_in,
    });

    response.cookies.set('refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Clear the state, nonce, and oauth_code_verifier cookies
    response.cookies.set('oauth_state', '', { maxAge: 0 });
    response.cookies.set('oauth_nonce', '', { maxAge: 0 });
    response.cookies.set('oauth_code_verifier', '', { maxAge: 0 });

    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.redirect(new URL('/auth/error', request.url));
  }
}

function validate(
  value: string | null,
  storedValue: string | undefined
): boolean {
  if (!value || !storedValue) {
    return false;
  }
  return value === storedValue;
}

async function exchangeCodeForToken(
  code: string,
  code_verifier: string | undefined,
  requestOrigin: string
): Promise<TokenData> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.NEXT_PUBLIC_CLIENT_ID as string,
    client_secret: process.env.CLIENT_SECRET as string,
    code: code,
    redirect_uri: `${requestOrigin}/api/auth/callback`,
  });

  // Only add code_verifier if it exists (for PKCE flow)
  if (code_verifier) {
    params.append('code_verifier', code_verifier);
  }

  const response = await fetch('https://vercel.com/api/login/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to exchange code for token: ${JSON.stringify(errorData)}`
    );
  }

  return await response.json();
}
