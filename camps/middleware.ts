import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// For multi-domain support, set WORKOS_REDIRECT_URI env var per deployment
// or add all callback URLs to WorkOS dashboard
export default authkitMiddleware({
  eagerAuth: true,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/sign-in', '/sign-up', '/share/:path*', '/discover/:path*', '/terms', '/privacy'],
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
