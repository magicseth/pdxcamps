import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * API route to set the referral cookie.
 * Called by share pages to attribute signups to the sharer.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    // Validate code format (16 hex chars)
    if (!code || !/^[a-f0-9]{16}$/i.test(code)) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Don't overwrite if user already has a referral cookie
    const cookieStore = await cookies();
    const existingCode = cookieStore.get('referral_code')?.value;
    if (existingCode) {
      return NextResponse.json({ success: true, existing: true });
    }

    // Set the referral cookie (30 days)
    cookieStore.set('referral_code', code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
