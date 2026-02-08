'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useConvexAuth } from 'convex/react';
import { api } from '../convex/_generated/api';

/**
 * Invisible component that touches lastLoginAt when authenticated.
 * Renders nothing. Mount once near the app root.
 */
export function LoginTracker() {
  const { isAuthenticated } = useConvexAuth();
  const touchLastLogin = useMutation(api.families.mutations.touchLastLogin);
  const hasTouched = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasTouched.current) {
      hasTouched.current = true;
      touchLastLogin().catch(() => {
        // Silently ignore - user may not have a family yet (still onboarding)
      });
    }
  }, [isAuthenticated, touchLastLogin]);

  return null;
}
