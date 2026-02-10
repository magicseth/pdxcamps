'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../../../lib/legalVersions';

export default function LegalAcceptancePage() {
  const router = useRouter();
  const family = useQuery(api.families.queries.getCurrentFamily);
  const acceptTerms = useMutation(api.families.mutations.acceptTerms);

  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no family (shouldn't happen, but handle gracefully)
  if (family === null) {
    router.replace('/onboarding/family');
    return null;
  }

  // Already up to date — redirect home
  if (family && family.tosVersion === CURRENT_TOS_VERSION) {
    router.replace('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await acceptTerms({
        tosVersion: CURRENT_TOS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept terms');
      setIsSubmitting(false);
    }
  };

  if (family === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div role="status" aria-live="polite" className="text-center">
          <div
            className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"
            aria-hidden="true"
          ></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <main className="max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Updated Terms &amp; Privacy Policy
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            We&apos;ve updated our Terms of Service and Privacy Policy. Please review and accept them to continue.
          </p>

          <div className="space-y-3 mb-6">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-primary font-medium text-sm"
            >
              Read Terms of Service &rarr;
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-primary font-medium text-sm"
            >
              Read Privacy Policy &rarr;
            </a>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="legalAccepted"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary rounded"
                disabled={isSubmitting}
              />
              <label htmlFor="legalAccepted" className="text-sm text-slate-600 dark:text-slate-400">
                I agree to the updated{' '}
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
              disabled={isSubmitting || !accepted}
              aria-busy={isSubmitting}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark disabled:bg-primary-light text-white font-medium rounded-md transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
