import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// Determine redirect URI based on environment
const getRedirectUri = () => {
  // Check for explicit env var first
  if (process.env.WORKOS_REDIRECT_URI) {
    return process.env.WORKOS_REDIRECT_URI;
  }
  // Netlify production
  if (process.env.URL) {
    return `${process.env.URL}/callback`;
  }
  // Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/callback`;
  }
  // Default for local dev
  return 'http://localhost:3000/callback';
};

export default authkitMiddleware({
  eagerAuth: true,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/sign-in', '/sign-up', '/share/:path*', '/discover/:path*', '/invite/:path*', '/terms', '/privacy'],
  },
  redirectUri: getRedirectUri(),
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
