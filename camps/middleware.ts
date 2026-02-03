import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

const workosMiddleware = authkitMiddleware({
  eagerAuth: true,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/sign-in', '/sign-up', '/share/:path*', '/discover/:path*', '/terms', '/privacy'],
  },
});

// Wrapper to dynamically set redirect URI based on request host
export default async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/callback`;

  // Clone request with x-redirect-uri header for WorkOS
  const requestWithRedirect = new NextRequest(request, {
    headers: new Headers(request.headers),
  });
  requestWithRedirect.headers.set('x-redirect-uri', redirectUri);

  return workosMiddleware(requestWithRedirect);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
