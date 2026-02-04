import { redirect } from 'next/navigation';
import { getSignUpUrl } from '@workos-inc/authkit-nextjs';
import { headers } from 'next/headers';

export async function GET() {
  const headersList = await headers();
  // Netlify uses x-forwarded-host for custom domains
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';

  // Determine protocol - assume https in production
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/callback`;

  const authorizationUrl = await getSignUpUrl({ redirectUri });

  return redirect(authorizationUrl);
}
