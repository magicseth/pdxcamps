import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

const UNAUTHENTICATED_PATHS = [
  '/',
  '/sign-in',
  '/sign-up',
  '/share/:path*',
  '/discover/:path*',
  '/invite/:path*',
  '/terms',
  '/privacy',
  '/blog/:path*',
  '/:citySlug/:pageSlug',
  '/:citySlug/neighborhoods',
  '/:citySlug/neighborhoods/:neighborhoodSlug',
];

/**
 * Dynamic middleware that computes the redirectUri per-request based on the
 * actual hostname. This is critical for multi-market deployments where a single
 * Netlify site serves multiple domains (pdxcamps.com, seacamps.com, etc.).
 *
 * Without this, Netlify's process.env.URL (the primary domain) would be used
 * for ALL auth redirects, sending users to the wrong site after sign-in.
 */
export default async function middleware(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/callback`;

  const handler = authkitMiddleware({
    eagerAuth: true,
    middlewareAuth: {
      enabled: true,
      unauthenticatedPaths: UNAUTHENTICATED_PATHS,
    },
    redirectUri,
  });

  return handler(request, {} as never);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
