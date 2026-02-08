'use client';

import { useCallback } from 'react';
import { Authenticated, Unauthenticated, useQuery } from 'convex/react';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import type { User } from '@workos-inc/node';
import { api } from '../convex/_generated/api';
import { LandingPage } from '../components/landing/LandingPage';
import { PlannerHub } from '../components/planner/PlannerHub';
import { AppHeader } from '../components/shared/AppHeader';

export default function Home() {
  const { user, signOut } = useAuth();

  // Custom signOut that returns to the current domain
  const handleSignOut = useCallback(() => {
    signOut({ returnTo: window.location.origin });
  }, [signOut]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Authenticated>
        <AuthenticatedHub user={user} onSignOut={handleSignOut} />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </div>
  );
}

function AuthenticatedHub({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const family = useQuery(api.families.queries.getCurrentFamily);
  const children = useQuery(api.children.queries.listChildren);
  const cities = useQuery(api.cities.queries.listActiveCities);

  // Prefetch planner queries NOW so they fire in parallel with family/children.
  // Without this, there's a waterfall: family+children resolve → PlannerHub mounts → coverage query starts.
  // These queries authenticate independently via getFamily() on the backend.
  const now = new Date();
  const currentYear = now.getFullYear();
  useQuery(api.planner.queries.getSummerCoverage, { year: currentYear });
  useQuery(api.planner.aggregates.getWeeklyAvailability, { year: currentYear });
  useQuery(api.subscriptions.getSubscription);
  useQuery(api.planner.queries.getFamilyEvents, { year: currentYear });

  if (family === undefined || children === undefined) {
    return <LoadingState />;
  }

  if (!family || children.length === 0) {
    return <OnboardingPrompt user={user} onSignOut={onSignOut} hasFamily={!!family} />;
  }

  return <PlannerHub user={user} onSignOut={onSignOut} children={children} cities={cities || []} />;
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="animate-pulse motion-reduce:animate-none flex flex-col items-center gap-4"
      >
        <div className="w-12 h-12 bg-primary/30 dark:bg-primary-dark rounded-full" aria-hidden="true"></div>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

function OnboardingPrompt({
  user,
  onSignOut,
  hasFamily,
}: {
  user: User | null;
  onSignOut: () => void;
  hasFamily: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={user} onSignOut={onSignOut} />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6" aria-hidden="true">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            {hasFamily ? 'Add your children' : "Welcome! Let's get started"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {hasFamily
              ? 'Add your children to start planning their summer camps.'
              : 'Set up your family profile to discover and plan summer camps.'}
          </p>
          <Link
            href={hasFamily ? '/onboarding/children' : '/onboarding'}
            className="inline-block px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark"
          >
            {hasFamily ? 'Add Children' : 'Complete Setup'}
          </Link>
        </div>
      </main>
    </div>
  );
}
