'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CURRENT_TOS_VERSION } from '../../lib/legalVersions';

export default function OnboardingPage() {
  const router = useRouter();
  const family = useQuery(api.families.queries.getCurrentFamily);
  const children = useQuery(api.children.queries.listChildren);

  useEffect(() => {
    // Wait for queries to load
    if (family === undefined || children === undefined) {
      return;
    }

    // No family exists - redirect to family setup
    if (family === null) {
      router.replace('/onboarding/family');
      return;
    }

    // Family exists but hasn't accepted current TOS - redirect to legal acceptance
    if (!family.tosVersion || family.tosVersion !== CURRENT_TOS_VERSION) {
      router.replace('/onboarding/legal');
      return;
    }

    // Family exists but no children - redirect to children setup
    if (children.length === 0) {
      router.replace('/onboarding/children');
      return;
    }

    // Check if onboarding is complete
    if (family.onboardingCompletedAt) {
      router.replace('/');
      return;
    }

    // Family and children exist but onboarding not marked complete - go to children page to complete
    router.replace('/onboarding/children');
  }, [family, children, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div role="status" aria-live="polite" className="text-center">
        <div
          className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"
          aria-hidden="true"
        ></div>
        <p className="text-slate-600">Setting up your profile...</p>
      </div>
    </div>
  );
}
