import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Short URL handler for referral links.
 * Sets a cookie and redirects to sign-up.
 *
 * Example: /r/abc123def456 -> sets pdx_ref cookie, redirects to /sign-up
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Validate code format (16 hex chars)
  if (!code || !/^[a-f0-9]{16}$/i.test(code)) {
    // Invalid code - redirect to home
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Set the referral cookie (30 days)
  const cookieStore = await cookies();
  cookieStore.set('referral_code', code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    path: '/',
  });

  // Redirect to sign-up page
  return NextResponse.redirect(new URL('/sign-up', request.url));
}
