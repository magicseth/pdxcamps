import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

function replaceRedirectUriBasedOnHostname(request: NextRequest) {
  const hostname = request.headers.get('host');
  if (hostname === 'localhost:3000') {
    return 'http://localhost:3000/callback';
  }
  return `https://${hostname}/callback`;
}
function handleAuthWithAfterPatchingProcessEnv(request: NextRequest) {
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = replaceRedirectUriBasedOnHostname(request);
  process.env.WORKOS_REDIRECT_URI = replaceRedirectUriBasedOnHostname(request);
  return handleAuth();
}

export const GET = handleAuthWithAfterPatchingProcessEnv;
