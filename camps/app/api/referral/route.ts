import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * API route to set the referral cookie.
 * Called by share pages to attribute signups to the sharer.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, shareToken, shareType } = body;

    // Validate code format (16 hex chars)
    if (!code || !/^[a-f0-9]{16}$/i.test(code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const cookieStore = await cookies();

    // Don't overwrite if user already has a referral cookie
    const existingCode = cookieStore.get('referral_code')?.value;
    if (!existingCode) {
      // Set the referral cookie (30 days)
      cookieStore.set('referral_code', code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
        path: '/',
      });
    }

    // Set share token cookies for friendship creation during onboarding
    if (shareToken && typeof shareToken === 'string' && (shareType === 'child' || shareType === 'family')) {
      cookieStore.set('share_token', shareToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
      cookieStore.set('share_type', shareType, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
    }

    return NextResponse.json({ success: true, existing: !!existingCode });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
