'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import { useState } from 'react';

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPrice(price: number | null | undefined) {
  if (!price) return null;
  return `$${price}`;
}

interface SavedCamp {
  _id: Id<"registrations">;
  status: string;
  notes?: string;
  externalConfirmationCode?: string;
  child: {
    _id: Id<"children">;
    firstName: string;
  } | null;
  session: {
    _id: Id<"sessions">;
    startDate: string;
    endDate: string;
    price: number | null;
    externalRegistrationUrl?: string;
    camp: {
      _id: Id<"camps">;
      name: string;
    } | null;
    organization: {
      _id: Id<"organizations">;
      name: string;
    } | null;
    location: {
      _id: Id<"locations">;
      name: string;
      neighborhood?: string;
    } | null;
  } | null;
}

function CampCard({
  camp,
  showActions = false,
  onMarkRegistered,
  onRemove,
}: {
  camp: SavedCamp;
  showActions?: boolean;
  onMarkRegistered?: (id: Id<"registrations">) => void;
  onRemove?: (id: Id<"registrations">) => void;
}) {
  const session = camp.session;
  const campInfo = session?.camp;
  const org = session?.organization;
  const location = session?.location;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Camp name */}
          <Link
            href={`/session/${session?._id}`}
            className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block truncate"
          >
            {campInfo?.name ?? 'Unknown Camp'}
          </Link>

          {/* Organization */}
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {org?.name}
          </p>

          {/* Child */}
          {camp.child && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              for {camp.child.firstName}
            </p>
          )}

          {/* Details row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
            {session && (
              <span>
                {formatDate(session.startDate)} - {formatDate(session.endDate)}
              </span>
            )}
            {session?.price && (
              <span className="font-medium text-slate-900 dark:text-white">
                {formatPrice(session.price)}
              </span>
            )}
            {location?.neighborhood && (
              <span>{location.neighborhood}</span>
            )}
          </div>

          {/* Notes */}
          {camp.notes && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">
              Note: {camp.notes}
            </p>
          )}

          {/* Confirmation code */}
          {camp.externalConfirmationCode && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              Confirmation: {camp.externalConfirmationCode}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {showActions && session?.externalRegistrationUrl && (
            <a
              href={session.externalRegistrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              Register
            </a>
          )}
          {showActions && onMarkRegistered && (
            <button
              onClick={() => onMarkRegistered(camp._id)}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              Mark Done
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(camp._id)}
              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 text-sm hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  color
}: {
  title: string;
  count: number;
  color: 'yellow' | 'green' | 'orange' | 'slate';
}) {
  const colors = {
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${colors[color]}`}>
        {count}
      </span>
    </div>
  );
}

export default function SavedCampsPage() {
  const savedCamps = useQuery(api.registrations.queries.getSavedCamps);
  const register = useMutation(api.registrations.mutations.register);
  const cancelRegistration = useMutation(api.registrations.mutations.cancelRegistration);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleMarkRegistered = async (registrationId: Id<"registrations">) => {
    setProcessingId(registrationId);
    try {
      // Find the registration to get childId and sessionId
      const registration = savedCamps?.interested.find(r => r._id === registrationId);
      if (registration && registration.child && registration.session) {
        await register({
          childId: registration.child._id,
          sessionId: registration.session._id,
        });
      }
    } catch (error) {
      console.error('Failed to mark as registered:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (registrationId: Id<"registrations">) => {
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
    savedCamps.interested.length > 0 ||
    savedCamps.registered.length > 0 ||
    savedCamps.waitlisted.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            My Camps
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your saved camps and registrations
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {!hasAnySaved ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💭</div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No camps saved yet
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Browse camps and tap the heart to save them for later
            </p>
            <Link
              href="/discover/portland"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Camps
            </Link>
          </div>
        ) : (
          <>
            {/* Need to Register - Action Items */}
            {savedCamps.interested.length > 0 && (
              <section>
                <SectionHeader
                  title="Need to Register"
                  count={savedCamps.interested.length}
                  color="yellow"
                />
                <div className="space-y-3">
                  {savedCamps.interested.map((camp) => (
                    <CampCard
                      key={camp._id}
                      camp={camp as SavedCamp}
                      showActions
                      onMarkRegistered={handleMarkRegistered}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Waitlisted */}
            {savedCamps.waitlisted.length > 0 && (
              <section>
                <SectionHeader
                  title="On Waitlist"
                  count={savedCamps.waitlisted.length}
                  color="orange"
                />
                <div className="space-y-3">
                  {savedCamps.waitlisted.map((camp) => (
                    <CampCard
                      key={camp._id}
                      camp={camp as SavedCamp}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Registered */}
            {savedCamps.registered.length > 0 && (
              <section>
                <SectionHeader
                  title="Registered"
                  count={savedCamps.registered.length}
                  color="green"
                />
                <div className="space-y-3">
                  {savedCamps.registered.map((camp) => (
                    <CampCard
                      key={camp._id}
                      camp={camp as SavedCamp}
                      onRemove={handleRemove}
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
          <Link href="/" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium">
            Home
          </Link>
          <Link href="/discover/portland" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium">
            Discover
          </Link>
          <Link href="/saved" className="text-blue-600 dark:text-blue-400 text-sm font-medium">
            My Camps
          </Link>
          <Link href="/planner" className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium">
            Planner
          </Link>
        </div>
      </div>
    </div>
  );
}
