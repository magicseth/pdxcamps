'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';

type CalendarSharingDefault = 'private' | 'friends_only' | 'public';

export default function FamilySetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const cities = useQuery(api.cities.queries.listActiveCities);
  const existingFamily = useQuery(api.families.queries.getCurrentFamily);
  const createFamily = useMutation(api.families.mutations.createFamily);

  const [displayName, setDisplayName] = useState('');
  const [primaryCityId, setPrimaryCityId] = useState<Id<'cities'> | ''>('');
  const [calendarSharingDefault, setCalendarSharingDefault] = useState<CalendarSharingDefault>('friends_only');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        calendarSharingDefault,
      });
      router.push('/onboarding/children');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create family');
      setIsSubmitting(false);
    }
  };

  if (cities === undefined || existingFamily === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome to PDX Camps</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Let&apos;s set up your family profile
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-semibold">1</span>
              <span>Family Profile</span>
              <span className="mx-2">-</span>
              <span className="flex items-center justify-center w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full text-xs font-semibold">2</span>
              <span>Add Children</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Family Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="The Smith Family"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                This is how other families will see you
              </p>
            </div>

            <div>
              <label htmlFor="primaryCity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Primary City
              </label>
              <select
                id="primaryCity"
                value={primaryCityId}
                onChange={(e) => setPrimaryCityId(e.target.value as Id<'cities'>)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="">Select a city</option>
                {cities.map((city) => (
                  <option key={city._id} value={city._id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                We&apos;ll show you camps in this area first
              </p>
            </div>

            <div>
              <label htmlFor="calendarSharing" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Calendar Sharing Default
              </label>
              <select
                id="calendarSharing"
                value={calendarSharingDefault}
                onChange={(e) => setCalendarSharingDefault(e.target.value as CalendarSharingDefault)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                disabled={isSubmitting}
              >
                <option value="private">Private - Only visible to you</option>
                <option value="friends_only">Friends Only - Visible to connected families</option>
                <option value="public">Public - Visible to everyone</option>
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Control who can see your camp schedule
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
