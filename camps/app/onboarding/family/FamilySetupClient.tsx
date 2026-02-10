'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Id } from '../../../convex/_generated/dataModel';
import { useMarket } from '../../../hooks/useMarket';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../../../lib/legalVersions';
import posthog from 'posthog-js';

interface FamilySetupClientProps {
  referralCode: string | null;
  inviteToken: string | null;
  partnerCode: string | null;
  shareToken: string | null;
  shareType: 'child' | 'family' | null;
}

export default function FamilySetupClient({ referralCode, inviteToken, partnerCode, shareToken, shareType }: FamilySetupClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const market = useMarket();
  const cities = useQuery(api.cities.queries.listActiveCities);
  const existingFamily = useQuery(api.families.queries.getCurrentFamily);
  const createFamily = useMutation(api.families.mutations.createFamily);

  const [displayName, setDisplayName] = useState('');
  const [primaryCityId, setPrimaryCityId] = useState<Id<'cities'> | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    posthog.capture('onboarding_started', {
      has_referral_code: !!referralCode,
      has_invite_token: !!inviteToken,
      has_partner_code: !!partnerCode,
      market: market.slug,
    });
  }, []);

  // Auto-select city based on the domain the user is on
  useEffect(() => {
    if (!cities || primaryCityId) return;
    const hostname = typeof window !== 'undefined'
      ? window.location.hostname.split(':')[0].toLowerCase().replace(/^www\./, '')
      : '';
    if (!hostname) return;
    const matched = cities.find((c) => c.domain === hostname || c.domain === `www.${hostname}`);
    if (matched) {
      setPrimaryCityId(matched._id);
    }
  }, [cities, primaryCityId]);

  // Redirect if user already has a family
  if (existingFamily !== undefined && existingFamily !== null) {
    router.replace('/onboarding/children');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (!primaryCityId) {
      setError('Please select a city');
      return;
    }

    if (!tosAccepted) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (!user?.email) {
      setError('Unable to get user email. Please try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createFamily({
        displayName: displayName.trim(),
        email: user.email,
        primaryCityId: primaryCityId as Id<'cities'>,
        calendarSharingDefault: 'friends_only',
        referralCode: referralCode || undefined,
        inviteToken: inviteToken || undefined,
        partnerCode: partnerCode || undefined,
        shareToken: shareToken || undefined,
        shareType: shareType || undefined,
        tosVersion: CURRENT_TOS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      });

      // Identify user in PostHog using their email
      posthog.identify(user.email, {
        email: user.email,
      });

      // Track family creation event
      posthog.capture('family_created', {
        has_referral_code: !!referralCode,
        has_partner_code: !!partnerCode,
        market: market.slug,
      });

      router.push('/onboarding/children');
    } catch (err) {
      posthog.captureException(err);
      setError(err instanceof Error ? err.message : 'Failed to create family');
      setIsSubmitting(false);
    }
  };

  if (cities === undefined || existingFamily === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div role="status" aria-live="polite" className="text-center">
          <div
            className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-primary"
            aria-hidden="true"
          ></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <main id="main-content" className="max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full text-xs font-semibold">
                1
              </span>
              <span>Family Profile</span>
              <span className="mx-2">-</span>
              <span className="flex items-center justify-center w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full text-xs font-semibold">
                2
              </span>
              <span>Add Children</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Family Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="The Smith Family"
                autoCapitalize="words"
                enterKeyHint="done"
                aria-describedby="displayName-help"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
                autoFocus
              />
              <p id="displayName-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                This is how other families will see you
              </p>
            </div>

            <div>
              <label
                htmlFor="primaryCity"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Primary City
              </label>
              <select
                id="primaryCity"
                value={primaryCityId}
                onChange={(e) => setPrimaryCityId(e.target.value as Id<'cities'>)}
                aria-describedby="primaryCity-help"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-primary focus:border-primary dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="">Select a city</option>
                {cities.map((city) => (
                  <option key={city._id} value={city._id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
              <p id="primaryCity-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                We&apos;ll show you camps in this area first
              </p>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="tosAccepted"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary rounded"
                disabled={isSubmitting}
              />
              <label htmlFor="tosAccepted" className="text-sm text-slate-600 dark:text-slate-400">
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
              >
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !tosAccepted}
              aria-busy={isSubmitting}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark disabled:bg-primary-light text-white font-medium rounded-md transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Continue'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
