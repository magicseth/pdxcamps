'use client';

import { use, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function InviteConnectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const family = useQuery(api.families.queries.getCurrentFamily);
  const connectFromShareToken = useMutation(api.social.mutations.connectFromShareToken);
  const connectCalledRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in — send to sign-up (cookie already set by the route handler)
      router.replace('/sign-up');
      return;
    }

    // Logged in but family query still loading
    if (family === undefined) return;

    if (!family) {
      // Has account but no family yet — send to onboarding (cookie handles friendship)
      router.replace('/onboarding/family');
      return;
    }

    // Has account and family — create friendship directly
    if (!connectCalledRef.current) {
      connectCalledRef.current = true;
      connectFromShareToken({ shareToken: token, tokenType: 'invite' })
        .catch(() => {})
        .finally(() => {
          router.replace('/');
        });
    }
  }, [authLoading, user, family, token, connectFromShareToken, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-primary/30 rounded-full" />
        <div className="text-slate-600 text-sm">Connecting you with your friend...</div>
      </div>
    </div>
  );
}
