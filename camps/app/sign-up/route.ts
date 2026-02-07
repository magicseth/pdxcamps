import { redirect } from 'next/navigation';
import { getSignUpUrl } from '@workos-inc/authkit-nextjs';
import { headers } from 'next/headers';

// Map of allowed production domains
const PRODUCTION_DOMAINS = ['pdxcamps.com', 'boscamps.com', 'campweeks.netlify.app'];

function getProductionHost(host: string): string {
  // If it's localhost, keep it
  if (host.includes('localhost')) return host;

  // If it's already a production domain, use it
  if (PRODUCTION_DOMAINS.some((d) => host === d || host === `www.${d}`)) {
    return host;
  }

  // Netlify deploy previews look like: 6982e07be6a5630008d14d04--campweeks.netlify.app
  // Use the main netlify domain instead
  if (host.includes('--campweeks.netlify.app') || host.includes('.netlify.app')) {
    return 'campweeks.netlify.app';
  }

  // Default to pdxcamps.com for unknown hosts
  return 'pdxcamps.com';
}

export async function GET() {
  const headersList = await headers();
  // Netlify uses x-forwarded-host for custom domains
  const rawHost = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const host = getProductionHost(rawHost);

  // Determine protocol - assume https in production
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/callback`;

  const authorizationUrl = await getSignUpUrl({ redirectUri });

  return redirect(authorizationUrl);
}
