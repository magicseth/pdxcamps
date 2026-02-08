import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Friend invite link handler.
 * Sets an invite_token cookie and redirects to sign-up.
 * When the invited user creates their family, the token is used to
 * match them to the pending invitation and auto-create a friend request,
 * even if they sign up with a different email.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Validate token format (24 hex chars)
  if (!token || !/^[a-f0-9]{24}$/i.test(token)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Set the invite token cookie (30 days)
  const cookieStore = await cookies();
  cookieStore.set('invite_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  // Redirect to sign-up page
  return NextResponse.redirect(new URL('/sign-up', request.url));
}
