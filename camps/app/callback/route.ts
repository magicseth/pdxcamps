import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

function replaceRedirectUriBasedOnHostname(request: NextRequest) {
  const hostname = request.headers.get('host');
  if (hostname === 'localhost:3000') {
    return 'http://localhost:3000/callback';
  }
  return `https://${hostname}/callback`;
}
export function handleAuthWithAfterPatchingProcessEnv(request: NextRequest) {
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = replaceRedirectUriBasedOnHostname(request);
  process.env.WORKOS_REDIRECT_URI = replaceRedirectUriBasedOnHostname(request);
  return handleAuth({ baseURL: replaceRedirectUriBasedOnHostname(request) })(request);
}
export const GET = handleAuthWithAfterPatchingProcessEnv;
