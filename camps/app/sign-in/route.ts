import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { headers } from 'next/headers';
import { fetchQuery } from 'convex/nextjs';
import { api } from '../../convex/_generated/api';

async function getProductionHost(host: string): Promise<string> {
  // If it's localhost, keep it
  if (host.includes('localhost')) return host;

  // Netlify deploy previews look like: 6982e07be6a5630008d14d04--campweeks.netlify.app
  // Use the main netlify domain instead
  if (host.includes('--campweeks.netlify.app') || host.includes('.netlify.app')) {
    return 'campweeks.netlify.app';
  }

  // Strip www. prefix for lookup
  const bareHost = host.replace(/^www\./, '');

  // Check if this is a known city domain from the database
  try {
    const city = await fetchQuery(api.cities.queries.getCityByDomain, { domain: bareHost });
    if (city) {
      return bareHost;
    }
  } catch {
    // If the query fails, fall back to default
  }

  // Default to pdxcamps.com for unknown hosts
  return 'pdxcamps.com';
}

export async function GET() {
  const headersList = await headers();
  // Netlify uses x-forwarded-host for custom domains
  const rawHost = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const host = await getProductionHost(rawHost);

  // Determine protocol - assume https in production
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/callback`;

  const authorizationUrl = await getSignInUrl({ redirectUri });

  return redirect(authorizationUrl);
}
