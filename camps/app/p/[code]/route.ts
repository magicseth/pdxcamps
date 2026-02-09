import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Partner referral link handler.
 * Sets a partner_code cookie and redirects to sign-up.
 *
 * Example: /p/abc123def4567890 -> sets partner_code cookie, redirects to /sign-up
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Validate code format (16 hex chars)
  if (!code || !/^[a-f0-9]{16}$/i.test(code)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Set the partner code cookie (30 days)
  const cookieStore = await cookies();
  cookieStore.set('partner_code', code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });

  return NextResponse.redirect(new URL('/sign-up', request.url));
}
