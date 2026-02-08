'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPrice(price: number | null | undefined) {
  if (!price) return null;
  return `$${(price / 100).toFixed(0)}`;
}

interface SavedCamp {
  _id: Id<'registrations'>;
  status: string;
  notes?: string;
  externalConfirmationCode?: string;
  child: {
    _id: Id<'children'>;
    firstName: string;
  } | null;
  session: {
    _id: Id<'sessions'>;
    startDate: string;
    endDate: string;
    price: number | null;
    externalRegistrationUrl?: string;
    camp: {
      _id: Id<'camps'>;
      name: string;
    } | null;
    organization: {
      _id: Id<'organizations'>;
      name: string;
    } | null;
    location: {
      _id: Id<'locations'>;
      name: string;
      neighborhood?: string;
    } | null;
  } | null;
}

function TodoCampCard({
  camp,
  onMarkRegistered,
  onRemove,
  isProcessing,
}: {
  camp: SavedCamp;
  onMarkRegistered: () => void;
  onRemove: () => void;
  isProcessing: boolean;
}) {
  const session = camp.session;
  const campInfo = session?.camp;
  const org = session?.organization;
  const location = session?.location;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-amber-400 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-3">
        {/* Checkbox visual */}
        <div className="flex-shrink-0 pt-0.5">
          <div className="w-5 h-5 rounded-full border-2 border-amber-400 dark:border-amber-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Link
                href={`/session/${session?._id}`}
                className="font-medium text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary-light block truncate"
              >
                {campInfo?.name ?? 'Unknown Camp'}
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{org?.name}</p>
            </div>
            {camp.child && (
              <span className="text-xs font-medium text-primary dark:text-primary-light bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full flex-shrink-0">
                {camp.child.firstName}
              </span>
            )}
          </div>

          {/* Details row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
            {session && (
              <span>
                {formatDate(session.startDate)} - {formatDate(session.endDate)}
              </span>
            )}
            {session?.price && (
              <span className="font-medium text-slate-900 dark:text-white">{formatPrice(session.price)}</span>
            )}
            {location?.neighborhood && <span>{location.neighborhood}</span>}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {session?.externalRegistrationUrl && (
              <a
                href={session.externalRegistrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
              >
                Register
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
            <button
              onClick={onMarkRegistered}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Mark Done
            </button>
            <button
              onClick={onRemove}
              disabled={isProcessing}
              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 text-sm hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisteredCampCard({
  camp,
  onRemove,
  isProcessing,
}: {
  camp: SavedCamp;
  onRemove: () => void;
  isProcessing: boolean;
}) {
  const session = camp.session;
  const campInfo = session?.camp;
  const org = session?.organization;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-green-500 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-3">
        {/* Checkmark */}
        <div className="flex-shrink-0 pt-0.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Link
                href={`/session/${session?._id}`}
                className="font-medium text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary-light block truncate"
              >
                {campInfo?.name ?? 'Unknown Camp'}
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{org?.name}</p>
            </div>
            {camp.child && (
              <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                {camp.child.firstName}
              </span>
            )}
          </div>

          {/* Details row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
            {session && (
              <span>
                {formatDate(session.startDate)} - {formatDate(session.endDate)}
              </span>
            )}
            {session?.price && (
              <span className="font-medium text-slate-900 dark:text-white">{formatPrice(session.price)}</span>
            )}
          </div>

          {/* Confirmation code */}
          {camp.externalConfirmationCode && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Confirmation: {camp.externalConfirmationCode}
            </div>
          )}

          {/* Remove button */}
          <div className="mt-3">
            <button
              onClick={onRemove}
              disabled={isProcessing}
              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 text-sm hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressHeader({
  registeredCount,
  todoCount,
  waitlistCount,
}: {
  registeredCount: number;
  todoCount: number;
  waitlistCount: number;
}) {
  const totalCamps = registeredCount + todoCount + waitlistCount;
  const progressPercent = totalCamps > 0 ? Math.round((registeredCount / totalCamps) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">My Summer Camps</h1>

        {totalCamps > 0 && (
          <>
            {/* Progress bar */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {registeredCount}/{totalCamps} done
              </span>
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {registeredCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {registeredCount} Registered
                </span>
              )}
              {todoCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {todoCount} To Do
                </span>
              )}
              {waitlistCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
                  <span className="text-xs">⏳</span>
                  {waitlistCount} Waitlist
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: 'amber' | 'green' | 'yellow' | 'slate';
}) {
  const colors = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${colors[color]}`}>{count}</span>
    </div>
  );
}

export default function SavedCampsPage() {
  const savedCamps = useQuery(api.registrations.queries.getSavedCamps);
  const subscription = useQuery(api.subscriptions.getSubscription);
  const register = useMutation(api.registrations.mutations.register);
  const cancelRegistration = useMutation(api.registrations.mutations.cancelRegistration);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const isPremium = subscription?.isPremium ?? false;
  const savedCount = savedCamps ? savedCamps.interested.length + savedCamps.waitlisted.length : 0;
  const FREE_LIMIT = 5;

  const registrationStats = useMemo(() => {
    if (!savedCamps) return { registered: 0, todo: 0, waitlist: 0 };
    return {
      registered: savedCamps.registered.length,
      todo: savedCamps.interested.length,
      waitlist: savedCamps.waitlisted.length,
    };
  }, [savedCamps]);

  const fireConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.25),
      spread: 26,
      startVelocity: 55,
    });
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.2),
      spread: 60,
    });
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.35),
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.1),
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.1),
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleMarkRegistered = async (registrationId: Id<'registrations'>) => {
    setProcessingId(registrationId);
    try {
      const registration = savedCamps?.interested.find((r) => r._id === registrationId);
      if (registration && registration.child && registration.session) {
        await register({
          childId: registration.child._id,
          sessionId: registration.session._id,
        });
        fireConfetti();
      }
    } catch (error) {
      console.error('Failed to mark as registered:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (registrationId: Id<'registrations'>) => {
    setProcessingId(registrationId);
    try {
      await cancelRegistration({ registrationId });
    } catch (error) {
      console.error('Failed to remove:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!savedCamps) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasAnySaved =
    savedCamps.interested.length > 0 || savedCamps.registered.length > 0 || savedCamps.waitlisted.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Progress Header */}
      <ProgressHeader
        registeredCount={registrationStats.registered}
        todoCount={registrationStats.todo}
        waitlistCount={registrationStats.waitlist}
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8 pb-24">
        {/* Upgrade Banner for Free Users */}
        {!isPremium && subscription !== undefined && savedCount >= FREE_LIMIT - 1 && (
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 dark:from-accent/20 dark:to-accent/10 border border-accent/30 dark:border-accent/40 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl">💾</div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {savedCount >= FREE_LIMIT
                      ? `You've hit the free limit (${FREE_LIMIT} camps)`
                      : `${savedCount}/${FREE_LIMIT} camps saved`}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Upgrade to save unlimited camps and never lose track of your favorites
                  </p>
                </div>
              </div>
              <Link
                href="/upgrade"
                className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-accent to-accent-dark text-white font-medium rounded-lg hover:from-accent-dark hover:to-primary transition-all shadow-sm"
              >
                Upgrade
              </Link>
            </div>
          </div>
        )}

        {!hasAnySaved ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4" aria-hidden="true">💭</div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No camps saved yet</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Browse camps and tap the heart to save them for later
            </p>
            <Link
              href="/discover/portland"
              className="inline-flex items-center px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              Browse Camps
            </Link>
          </div>
        ) : (
          <>
            {/* Need to Register - Action Items */}
            {savedCamps.interested.length > 0 && (
              <section>
                <SectionHeader title="Need to Register" count={savedCamps.interested.length} color="amber" />
                <div className="space-y-3">
                  {savedCamps.interested.map((camp) => (
                    <TodoCampCard
                      key={camp._id}
                      camp={camp as SavedCamp}
                      onMarkRegistered={() => handleMarkRegistered(camp._id)}
                      onRemove={() => handleRemove(camp._id)}
                      isProcessing={processingId === camp._id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Waitlisted */}
            {savedCamps.waitlisted.length > 0 && (
              <section>
                <SectionHeader title="On Waitlist" count={savedCamps.waitlisted.length} color="yellow" />
                <div className="space-y-3">
                  {savedCamps.waitlisted.map((camp) => (
                    <TodoCampCard
                      key={camp._id}
                      camp={camp as SavedCamp}
                      onMarkRegistered={() => handleMarkRegistered(camp._id)}
                      onRemove={() => handleRemove(camp._id)}
                      isProcessing={processingId === camp._id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Registered */}
            {savedCamps.registered.length > 0 && (
              <section>
                <SectionHeader title="Registered" count={savedCamps.registered.length} color="green" />
                <div className="space-y-3">
                  {savedCamps.registered.map((camp) => (
                    <RegisteredCampCard
                      key={camp._id}
                      camp={camp as SavedCamp}
                      onRemove={() => handleRemove(camp._id)}
                      isProcessing={processingId === camp._id}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Bottom nav link */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-3xl mx-auto flex justify-around">
          <Link
            href="/"
            className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light text-sm font-medium"
          >
            Home
          </Link>
          <Link
            href="/discover/portland"
            className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light text-sm font-medium"
          >
            Discover
          </Link>
          <Link href="/saved" className="text-primary dark:text-primary-light text-sm font-medium">
            My Camps
          </Link>
          <Link
            href="/planner"
            className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light text-sm font-medium"
          >
            Planner
          </Link>
        </div>
      </div>
    </div>
  );
}
