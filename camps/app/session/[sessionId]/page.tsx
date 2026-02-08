'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { OrgLogo } from '../../../components/shared/OrgLogo';
import { BottomNav } from '../../../components/shared/BottomNav';
import { useMarket } from '../../../hooks/useMarket';

import { GRADE_LABELS } from '../../../lib/constants';
import posthog from 'posthog-js';
import {
  CalendarIcon,
  CalendarPlusIcon,
  ClockIcon,
  ChevronRightIcon,
  PlusCircleIcon,
  UsersIcon,
  LocationIcon,
  MapIcon,
  HeartIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  CloseIcon,
  SettingsIcon,
  ShareIcon,
} from '../../../components/shared/icons';

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const market = useMarket();

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch session data with related entities
  const session = useQuery(
    api.sessions.queries.getSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip',
  );

  // Fetch children for the current family
  const children = useQuery(api.children.queries.listChildren);

  // Fetch friends attending this session
  const friendsAtSession = useQuery(
    api.social.queries.getFriendsAtSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip',
  );

  // Fetch other sessions from the same camp
  const otherSessions = useQuery(
    api.sessions.queries.listSessionsByCamp,
    session?.camp ? { campId: session.camp._id } : 'skip',
  );

  // Filter to only active sessions that aren't the current one
  const otherAvailableSessions = useMemo(() => {
    if (!otherSessions || !sessionId) return [];
    return otherSessions
      .filter((s) => s._id !== sessionId && s.status === 'active' && s.enrolledCount < s.capacity)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3);
  }, [otherSessions, sessionId]);

  // Track session view
  useEffect(() => {
    if (session?.camp?.name) {
      posthog.capture('session_viewed', {
        session_id: sessionId,
        camp_name: session.camp.name,
        organization: session.organization?.name,
        market: market.slug,
      });
    }
  }, [session?.camp?.name]);

  // Update document title with camp name
  useEffect(() => {
    if (session?.camp?.name) {
      document.title = `${session.camp.name} | ${market.tagline}`;
    } else {
      document.title = `Camp Session | ${market.tagline}`;
    }
    return () => {
      document.title = market.tagline;
    };
  }, [session?.camp?.name, market.tagline]);

  // Mutations
  const markInterested = useMutation(api.registrations.mutations.markInterested);

  // Handle save for later
  const handleSaveForLater = async (childId: Id<'children'>) => {
    try {
      setSaveError(null);
      await markInterested({
        childId,
        sessionId: sessionId as Id<'sessions'>,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save session');
    }
  };

  // Loading state
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4" aria-hidden="true"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8" aria-hidden="true"></div>
            <div className="space-y-4">
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
              <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
            </div>
            <span className="sr-only">Loading session details...</span>
          </div>
        </div>
      </div>
    );
  }

  // Session not found
  if (session === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Session Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            We couldn&apos;t find this camp session. It may have been removed or the link is incorrect.
          </p>
          <Link href="/" className="inline-block bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { camp, location, organization } = session;

  // Format helpers
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };

    if (start === end) {
      return startDate.toLocaleDateString('en-US', options);
    }

    const shortOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    if (startYear === endYear) {
      return `${startDate.toLocaleDateString('en-US', shortOptions)} - ${endDate.toLocaleDateString('en-US', { ...shortOptions, year: 'numeric' })}`;
    }

    return `${startDate.toLocaleDateString('en-US', { ...shortOptions, year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { ...shortOptions, year: 'numeric' })}`;
  };

  const formatTime = (time: { hour: number; minute: number }) => {
    const date = new Date();
    date.setHours(time.hour, time.minute, 0);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatPrice = (cents: number, currency: string) => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatAgeRange = (requirements: { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number }) => {
    const parts: string[] = [];

    if (requirements.minAge !== undefined || requirements.maxAge !== undefined) {
      if (requirements.minAge !== undefined && requirements.maxAge !== undefined) {
        parts.push(`Ages ${requirements.minAge}-${requirements.maxAge}`);
      } else if (requirements.minAge !== undefined) {
        parts.push(`Ages ${requirements.minAge}+`);
      } else if (requirements.maxAge !== undefined) {
        parts.push(`Ages up to ${requirements.maxAge}`);
      }
    }

    if (requirements.minGrade !== undefined || requirements.maxGrade !== undefined) {
      const gradeLabel = (grade: number) => GRADE_LABELS[grade] ?? `Grade ${grade}`;

      if (requirements.minGrade !== undefined && requirements.maxGrade !== undefined) {
        parts.push(`${gradeLabel(requirements.minGrade)} - ${gradeLabel(requirements.maxGrade)}`);
      } else if (requirements.minGrade !== undefined) {
        parts.push(`${gradeLabel(requirements.minGrade)} and up`);
      } else if (requirements.maxGrade !== undefined) {
        parts.push(`Up to ${gradeLabel(requirements.maxGrade)}`);
      }
    }

    return parts.length > 0 ? parts.join(' / ') : 'All ages welcome';
  };

  // Get status info
  const getSessionStatus = () => {
    if (session.status === 'cancelled') {
      return {
        label: 'Cancelled',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        available: false,
        waitlist: false,
      };
    }

    if (session.status === 'completed') {
      return {
        label: 'Completed',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
        available: false,
        waitlist: false,
      };
    }

    if (session.status === 'sold_out' || session.enrolledCount >= session.capacity) {
      if (session.waitlistEnabled) {
        return {
          label: 'Sold Out - Waitlist Available',
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
          available: false,
          waitlist: true,
        };
      }
      return {
        label: 'Sold Out',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        available: false,
        waitlist: false,
      };
    }

    const spotsLeft = session.capacity - session.enrolledCount;
    if (spotsLeft <= 5) {
      return {
        label: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left!`,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        available: true,
        waitlist: false,
      };
    }

    return {
      label: 'Available',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      available: true,
      waitlist: false,
    };
  };

  const sessionStatus = getSessionStatus();

  // Build Google Maps URL
  const getMapUrl = () => {
    if (!location?.address) return null;
    const address = `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="flex items-center gap-3">
              <ShareButton title={camp?.name ?? 'Check out this camp!'} />
              <Link
                href="/settings"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon />
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl">☀️</span>
                <span className="font-bold">{market.tagline}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {saveSuccess && (
          <div
            role="status"
            className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-center gap-2"
          >
            <CheckCircleIcon />
            Session saved for later!
          </div>
        )}
        {saveError && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg"
          >
            {saveError}
          </div>
        )}

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
        >
          <Link
            href="/"
            className="hover:text-slate-700 dark:hover:text-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Home
          </Link>
          <ChevronRightIcon className="w-4 h-4" />
          <Link
            href={`/discover/${market.slug}`}
            className="hover:text-slate-700 dark:hover:text-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Discover
          </Link>
          <ChevronRightIcon className="w-4 h-4" />
          {organization && (
            <>
              <span className="truncate max-w-[150px]" title={organization.name}>
                {organization.name}
              </span>
              <ChevronRightIcon className="w-4 h-4" />
            </>
          )}
          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={camp?.name || 'Session'}>
            {camp?.name || 'Session'}
          </span>
        </nav>

        {/* Camp Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden mb-6">
          {/* Hero Image with Camp Name Overlay */}
          {camp?.resolvedImageUrl ? (
            <div className="relative h-64 md:h-80 bg-slate-200 dark:bg-slate-700">
              <img
                src={camp.resolvedImageUrl}
                alt={camp.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {/* Camp name and org over the image */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-end gap-4">
                  {organization?.resolvedLogoUrl && (
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 flex items-center justify-center flex-shrink-0">
                      <OrgLogo
                        url={organization.resolvedLogoUrl}
                        name={organization.name}
                        size="lg"
                        className="w-full h-full"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                      {camp?.name ?? 'Camp Session'}
                    </h1>
                    {organization && (
                      <p className="text-lg text-white/90 mt-1">
                        by{' '}
                        <Link
                          href={`/organization/${organization.slug}`}
                          className="text-white hover:text-white/80 underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          {organization.name}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback when no image - show colored header */
            <div className="relative h-32 md:h-40 bg-gradient-to-r from-primary to-primary-dark">
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-end gap-4">
                  {organization?.resolvedLogoUrl && (
                    <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 flex items-center justify-center flex-shrink-0">
                      <OrgLogo
                        url={organization.resolvedLogoUrl}
                        name={organization.name}
                        size="lg"
                        className="w-full h-full"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">{camp?.name ?? 'Camp Session'}</h1>
                    {organization && (
                      <p className="text-lg text-white/90 mt-1">
                        by{' '}
                        <Link
                          href={`/organization/${organization.slug}`}
                          className="text-white hover:text-white/80 underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          {organization.name}
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="mt-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${sessionStatus.className}`}
                  >
                    {sessionStatus.label}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                  {formatPrice(session.price, session.currency)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">per session</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {camp?.description && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">About This Camp</h2>
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">{camp.description}</p>
                {camp.categories && camp.categories.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {camp.categories.map((category) => (
                      <span
                        key={category}
                        className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-sm"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Schedule */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Schedule</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">Dates</div>
                    <div className="text-slate-600 dark:text-slate-400">
                      {formatDateRange(session.startDate, session.endDate)}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ClockIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">Daily Schedule</div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Drop-off: {formatTime(session.dropOffTime)}
                      <br />
                      Pick-up: {formatTime(session.pickUpTime)}
                    </div>
                  </div>
                </div>
                {session.extendedCareAvailable && session.extendedCareDetails && (
                  <div className="flex items-start gap-3">
                    <PlusCircleIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">Extended Care Available</div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {session.extendedCareDetails.earlyDropOffTime && (
                          <>
                            Early drop-off: {formatTime(session.extendedCareDetails.earlyDropOffTime)}
                            <br />
                          </>
                        )}
                        {session.extendedCareDetails.latePickUpTime && (
                          <>
                            Late pick-up: {formatTime(session.extendedCareDetails.latePickUpTime)}
                            <br />
                          </>
                        )}
                        {session.extendedCareDetails.additionalCost !== undefined && (
                          <>
                            Additional cost: {formatPrice(session.extendedCareDetails.additionalCost, session.currency)}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Age Requirements */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Age Requirements</h2>
              <div className="flex items-center gap-3">
                <UsersIcon className="w-5 h-5 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">{formatAgeRange(session.ageRequirements)}</span>
              </div>
            </div>

            {/* Location */}
            {location && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Location</h2>
                <div className="flex items-start gap-3">
                  <LocationIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{location.name}</div>
                    {location.address && (
                      <div className="text-slate-600 dark:text-slate-400">
                        {location.address.street}
                        <br />
                        {location.address.city}, {location.address.state} {location.address.zip}
                      </div>
                    )}
                    {getMapUrl() && (
                      <a
                        href={getMapUrl()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-primary hover:text-primary-dark group"
                        title="Opens in new tab"
                      >
                        <MapIcon className="w-4 h-4" />
                        View on Map
                        <span className="text-primary-light group-hover:text-primary">↗</span>
                      </a>
                    )}
                    {location.parkingNotes && (
                      <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-medium">Parking:</span> {location.parkingNotes}
                      </div>
                    )}
                    {location.accessibilityNotes && (
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="font-medium">Accessibility:</span> {location.accessibilityNotes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Friends Attending */}
            {friendsAtSession && friendsAtSession.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Friends Attending</h2>
                <div className="space-y-4">
                  {friendsAtSession.map((friend) => (
                    <div key={friend.family._id} className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/20 dark:bg-primary-dark rounded-full flex items-center justify-center text-primary dark:text-primary-light font-medium">
                        {friend.family.displayName[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">{friend.family.displayName}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {friend.children.map((child) => child.firstName).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Capacity Card */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Availability</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Spots Filled</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {session.enrolledCount} of {session.capacity}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      session.enrolledCount >= session.capacity
                        ? 'bg-red-500'
                        : session.enrolledCount >= session.capacity * 0.8
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min((session.enrolledCount / session.capacity) * 100, 100)}%` }}
                  ></div>
                </div>
                {session.waitlistCount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">On Waitlist</span>
                    <span className="text-slate-700 dark:text-slate-300">{session.waitlistCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 space-y-3">
              {session.externalRegistrationUrl ? (
                <a
                  href={session.externalRegistrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary-dark"
                  title="Opens provider's registration page in new tab"
                >
                  Register on Provider Site
                  <span className="text-white/70">↗</span>
                </a>
              ) : sessionStatus.available ? (
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="w-full px-4 py-3 bg-primary text-white text-center font-medium rounded-md hover:bg-primary-dark"
                >
                  Register Now
                </button>
              ) : sessionStatus.waitlist ? (
                <button
                  onClick={() => setShowWaitlistModal(true)}
                  className="w-full px-4 py-3 bg-orange-600 text-white text-center font-medium rounded-md hover:bg-orange-700"
                >
                  Join Waitlist
                </button>
              ) : null}

              {children && children.length > 0 && (
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleSaveForLater(e.target.value as Id<'children'>);
                        e.target.value = '';
                      }
                    }}
                    aria-label="Save this camp session for a child"
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 appearance-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Save for Later...
                    </option>
                    {children.map((child) => (
                      <option key={child._id} value={child._id}>
                        Save for {child.firstName}
                      </option>
                    ))}
                  </select>
                  <HeartIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              )}

              {/* Add to Calendar */}
              <button
                onClick={() => {
                  // Generate ICS file content
                  const formatICSDate = (dateStr: string, time: { hour: number; minute: number }) => {
                    const date = new Date(dateStr + 'T00:00:00');
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hour = String(time.hour).padStart(2, '0');
                    const minute = String(time.minute).padStart(2, '0');
                    return `${year}${month}${day}T${hour}${minute}00`;
                  };

                  const startDateTime = formatICSDate(session.startDate, session.dropOffTime);
                  const endDateTime = formatICSDate(session.endDate, session.pickUpTime);
                  const locationStr = location?.address
                    ? `${location.name}\\n${location.address.street}\\, ${location.address.city}\\, ${location.address.state} ${location.address.zip}`
                    : location?.name || '';

                  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//${market.tagline}//Camp Session//EN
BEGIN:VEVENT
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:${(camp?.name || 'Camp Session').replace(/[,;]/g, '\\$&')}
DESCRIPTION:Drop-off: ${formatTime(session.dropOffTime)}\\nPick-up: ${formatTime(session.pickUpTime)}\\nOrganization: ${organization?.name || ''}\\n\\nPrice: ${formatPrice(session.price, session.currency)}
LOCATION:${locationStr}
END:VEVENT
END:VCALENDAR`;

                  // Download the ICS file
                  const blob = new Blob([icsContent], { type: 'text/calendar' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${(camp?.name || 'camp-session').toLowerCase().replace(/\s+/g, '-')}.ics`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center gap-2"
              >
                <CalendarPlusIcon className="w-5 h-5" />
                Add to Calendar
              </button>

              {/* Share Button */}
              <ShareButtonLarge title={camp?.name ?? 'Check out this camp!'} />
            </div>

            {/* Organization Info */}
            {organization && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">About the Organization</h3>
                <div className="space-y-3">
                  <div className="font-medium text-slate-900 dark:text-white">{organization.name}</div>
                  {organization.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                      {organization.description}
                    </p>
                  )}
                  {organization.website && (
                    <a
                      href={organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Visit Website
                    </a>
                  )}
                  {organization.phone && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">Phone: {organization.phone}</div>
                  )}
                  {organization.email && (
                    <a href={`mailto:${organization.email}`} className="text-sm text-primary hover:text-primary-dark">
                      {organization.email}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Other Sessions from this Camp */}
            {otherAvailableSessions.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Other Available Dates</h3>
                <div className="space-y-3">
                  {otherAvailableSessions.map((otherSession) => {
                    const spotsLeft = otherSession.capacity - otherSession.enrolledCount;
                    return (
                      <Link
                        key={otherSession._id}
                        href={`/session/${otherSession._id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {new Date(otherSession.startDate + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            -{' '}
                            {new Date(otherSession.endDate + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {formatPrice(otherSession.price, otherSession.currency)} • {spotsLeft} spot
                            {spotsLeft !== 1 ? 's' : ''} left
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Register Modal */}
      {showRegisterModal && (
        <RegisterModal
          sessionId={sessionId as Id<'sessions'>}
          campName={camp?.name ?? 'Camp Session'}
          ageRequirements={session.ageRequirements}
          onClose={() => setShowRegisterModal(false)}
        />
      )}

      {/* Waitlist Modal */}
      {showWaitlistModal && (
        <WaitlistModal
          sessionId={sessionId as Id<'sessions'>}
          campName={camp?.name ?? 'Camp Session'}
          ageRequirements={session.ageRequirements}
          onClose={() => setShowWaitlistModal(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}

// Register Modal Component
function RegisterModal({
  sessionId,
  campName,
  ageRequirements,
  onClose,
}: {
  sessionId: Id<'sessions'>;
  campName: string;
  ageRequirements: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
  onClose: () => void;
}) {
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const children = useQuery(api.children.queries.listChildren);
  const register = useMutation(api.registrations.mutations.register);

  // ESC key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !success) {
        onClose();
      }
    },
    [onClose, isSubmitting, success],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Backdrop click to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isSubmitting && !success) {
        onClose();
      }
    },
    [onClose, isSubmitting, success],
  );

  // Check if child meets age requirements
  const checkAgeEligibility = (birthdate: string): { eligible: boolean; reason?: string } => {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (ageRequirements.minAge !== undefined && age < ageRequirements.minAge) {
      return { eligible: false, reason: `Child must be at least ${ageRequirements.minAge} years old` };
    }
    if (ageRequirements.maxAge !== undefined && age > ageRequirements.maxAge) {
      return { eligible: false, reason: `Child must be no more than ${ageRequirements.maxAge} years old` };
    }

    return { eligible: true };
  };

  const handleRegister = async () => {
    if (!selectedChildId) {
      setError('Please select a child');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await register({
        childId: selectedChildId,
        sessionId,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="register-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Register for {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {success ? (
          <div role="status" className="text-center py-8">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium text-slate-900 dark:text-white">Registered!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your child has been registered for this session.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm"
              >
                {error}
              </div>
            )}

            {children === undefined ? (
              <div className="py-8 text-center text-slate-500">Loading children...</div>
            ) : children.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">You need to add a child to your family first.</p>
                <Link href="/onboarding/children" className="text-primary hover:text-primary-dark font-medium">
                  Add a child
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Child
                  </label>
                  <div className="space-y-2">
                    {children.map((child) => {
                      const eligibility = checkAgeEligibility(child.birthdate);
                      return (
                        <label
                          key={child._id}
                          className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                            selectedChildId === child._id
                              ? 'border-primary bg-primary/10 dark:bg-primary-dark/30'
                              : eligibility.eligible
                                ? 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                : 'border-slate-200 dark:border-slate-600 opacity-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="child"
                            value={child._id}
                            checked={selectedChildId === child._id}
                            onChange={() => setSelectedChildId(child._id)}
                            disabled={!eligibility.eligible}
                            className="sr-only"
                          />
                          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium">
                            {child.firstName[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {child.firstName} {child.lastName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {calculateDisplayAge(child.birthdate)}
                            </p>
                            {!eligibility.eligible && <p className="text-xs text-red-500 mt-1">{eligibility.reason}</p>}
                          </div>
                          {eligibility.eligible && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegister}
                    disabled={!selectedChildId || isSubmitting}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Registering...' : 'Confirm Registration'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Waitlist Modal Component
function WaitlistModal({
  sessionId,
  campName,
  ageRequirements,
  onClose,
}: {
  sessionId: Id<'sessions'>;
  campName: string;
  ageRequirements: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
  onClose: () => void;
}) {
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const children = useQuery(api.children.queries.listChildren);
  const joinWaitlist = useMutation(api.registrations.mutations.joinWaitlist);

  // ESC key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !success) {
        onClose();
      }
    },
    [onClose, isSubmitting, success],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Backdrop click to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isSubmitting && !success) {
        onClose();
      }
    },
    [onClose, isSubmitting, success],
  );

  // Check if child meets age requirements
  const checkAgeEligibility = (birthdate: string): { eligible: boolean; reason?: string } => {
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (ageRequirements.minAge !== undefined && age < ageRequirements.minAge) {
      return { eligible: false, reason: `Child must be at least ${ageRequirements.minAge} years old` };
    }
    if (ageRequirements.maxAge !== undefined && age > ageRequirements.maxAge) {
      return { eligible: false, reason: `Child must be no more than ${ageRequirements.maxAge} years old` };
    }

    return { eligible: true };
  };

  const handleJoinWaitlist = async () => {
    if (!selectedChildId) {
      setError('Please select a child');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await joinWaitlist({
        childId: selectedChildId,
        sessionId,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join waitlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="waitlist-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Join Waitlist for {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {success ? (
          <div role="status" className="text-center py-8">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium text-slate-900 dark:text-white">Added to Waitlist!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">You&apos;ll be notified if a spot opens up.</p>
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm"
              >
                {error}
              </div>
            )}

            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 rounded-md text-sm">
              This session is currently full. Join the waitlist to be notified when a spot becomes available.
            </div>

            {children === undefined ? (
              <div className="py-8 text-center text-slate-500">Loading children...</div>
            ) : children.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">You need to add a child to your family first.</p>
                <Link href="/onboarding/children" className="text-primary hover:text-primary-dark font-medium">
                  Add a child
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Child
                  </label>
                  <div className="space-y-2">
                    {children.map((child) => {
                      const eligibility = checkAgeEligibility(child.birthdate);
                      return (
                        <label
                          key={child._id}
                          className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                            selectedChildId === child._id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                              : eligibility.eligible
                                ? 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                                : 'border-slate-200 dark:border-slate-600 opacity-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="child"
                            value={child._id}
                            checked={selectedChildId === child._id}
                            onChange={() => setSelectedChildId(child._id)}
                            disabled={!eligibility.eligible}
                            className="sr-only"
                          />
                          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium">
                            {child.firstName[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {child.firstName} {child.lastName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {calculateDisplayAge(child.birthdate)}
                            </p>
                            {!eligibility.eligible && <p className="text-xs text-red-500 mt-1">{eligibility.reason}</p>}
                          </div>
                          {eligibility.eligible && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinWaitlist}
                    disabled={!selectedChildId || isSubmitting}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Joining...' : 'Join Waitlist'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper function
function calculateDisplayAge(birthdate: string): string {
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} years old`;
}

// Share button component
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    // Try Web Share API first (mobile)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        });
        return;
      } catch (err) {
        // User cancelled or error - fall back to copy
      }
    }

    // Fall back to clipboard copy
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="relative text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
      title="Share"
    >
      <ShareIcon className="w-5 h-5" />
      {copied && (
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded whitespace-nowrap">
          Copied!
        </span>
      )}
    </button>
  );
}

// Large share button for action area
function ShareButtonLarge({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    // Try Web Share API first (mobile)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        });
        return;
      } catch (err) {
        // User cancelled or error - fall back to copy
      }
    }

    // Fall back to clipboard copy
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center gap-2"
    >
      <ShareIcon className="w-5 h-5" />
      {copied ? 'Link Copied!' : 'Share with Partner'}
    </button>
  );
}
