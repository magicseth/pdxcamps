'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { OrgLogo } from '../../../components/shared/OrgLogo';
import { BottomNav } from '../../../components/shared/BottomNav';

// Grade mapping for display
const GRADE_LABELS: Record<number, string> = {
  [-2]: 'Preschool',
  [-1]: 'Pre-K',
  [0]: 'Kindergarten',
  [1]: '1st Grade',
  [2]: '2nd Grade',
  [3]: '3rd Grade',
  [4]: '4th Grade',
  [5]: '5th Grade',
  [6]: '6th Grade',
  [7]: '7th Grade',
  [8]: '8th Grade',
  [9]: '9th Grade',
  [10]: '10th Grade',
  [11]: '11th Grade',
  [12]: '12th Grade',
};

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch session data with related entities
  const session = useQuery(
    api.sessions.queries.getSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip'
  );

  // Fetch children for the current family
  const children = useQuery(api.children.queries.listChildren);

  // Fetch friends attending this session
  const friendsAtSession = useQuery(
    api.social.queries.getFriendsAtSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip'
  );

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
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Session Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            We couldn&apos;t find this camp session. It may have been removed or the link is incorrect.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
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

  const formatAgeRange = (requirements: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  }) => {
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
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <span className="font-bold">PDX Camps</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-center gap-2">
            <CheckCircleIcon />
            Session saved for later!
          </div>
        )}
        {saveError && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
            {saveError}
          </div>
        )}

        {/* Camp Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden mb-6">
          {/* Camp Image */}
          {camp?.resolvedImageUrl && (
            <div className="relative h-48 md:h-64 bg-slate-200 dark:bg-slate-700">
              <img
                src={camp.resolvedImageUrl}
                alt={camp.name}
                className="w-full h-full object-cover"
              />
              {organization?.resolvedLogoUrl && (
                <div className="absolute bottom-4 left-4 w-16 h-16 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 flex items-center justify-center">
                  <OrgLogo url={organization.resolvedLogoUrl} name={organization.name} size="lg" className="w-full h-full" />
                </div>
              )}
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {!camp?.resolvedImageUrl && organization?.resolvedLogoUrl && (
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg p-1.5 flex items-center justify-center flex-shrink-0">
                      <OrgLogo url={organization.resolvedLogoUrl} name={organization.name} size="lg" className="w-full h-full" />
                    </div>
                  )}
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    {camp?.name ?? 'Camp Session'}
                  </h1>
                </div>
                {organization && (
                  <p className="text-lg text-slate-600 dark:text-slate-400 mt-2">
                    by{' '}
                    <Link
                      href={`/organization/${organization.slug}`}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {organization.name}
                    </Link>
                  </p>
                )}
                <div className="mt-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${sessionStatus.className}`}>
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
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  About This Camp
                </h2>
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
                  {camp.description}
                </p>
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Schedule
              </h2>
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
                      <div className="font-medium text-slate-900 dark:text-white">
                        Extended Care Available
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {session.extendedCareDetails.earlyDropOffTime && (
                          <>Early drop-off: {formatTime(session.extendedCareDetails.earlyDropOffTime)}<br /></>
                        )}
                        {session.extendedCareDetails.latePickUpTime && (
                          <>Late pick-up: {formatTime(session.extendedCareDetails.latePickUpTime)}<br /></>
                        )}
                        {session.extendedCareDetails.additionalCost !== undefined && (
                          <>Additional cost: {formatPrice(session.extendedCareDetails.additionalCost, session.currency)}</>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Age Requirements */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Age Requirements
              </h2>
              <div className="flex items-center gap-3">
                <UsersIcon className="w-5 h-5 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  {formatAgeRange(session.ageRequirements)}
                </span>
              </div>
            </div>

            {/* Location */}
            {location && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Location
                </h2>
                <div className="flex items-start gap-3">
                  <LocationIcon className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {location.name}
                    </div>
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
                        className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:text-blue-700"
                      >
                        <MapIcon className="w-4 h-4" />
                        View on Map
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
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Friends Attending
                </h2>
                <div className="space-y-4">
                  {friendsAtSession.map((friend) => (
                    <div key={friend.family._id} className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                        {friend.family.displayName[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {friend.family.displayName}
                        </div>
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Availability
              </h3>
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
                  className="block w-full px-4 py-3 bg-blue-600 text-white text-center font-medium rounded-md hover:bg-blue-700"
                >
                  Register on Provider Site
                </a>
              ) : sessionStatus.available ? (
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="w-full px-4 py-3 bg-blue-600 text-white text-center font-medium rounded-md hover:bg-blue-700"
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
            </div>

            {/* Organization Info */}
            {organization && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  About the Organization
                </h3>
                <div className="space-y-3">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {organization.name}
                  </div>
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
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Visit Website
                    </a>
                  )}
                  {organization.phone && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Phone: {organization.phone}
                    </div>
                  )}
                  {organization.email && (
                    <a
                      href={`mailto:${organization.email}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {organization.email}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Register for {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <CloseIcon />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium text-slate-900 dark:text-white">Registered!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your child has been registered for this session.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {error}
              </div>
            )}

            {children === undefined ? (
              <div className="py-8 text-center text-slate-500">Loading children...</div>
            ) : children.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  You need to add a child to your family first.
                </p>
                <Link
                  href="/onboarding/children"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
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
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
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
                            {!eligibility.eligible && (
                              <p className="text-xs text-red-500 mt-1">{eligibility.reason}</p>
                            )}
                          </div>
                          {eligibility.eligible && (
                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                          )}
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Join Waitlist for {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <CloseIcon />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium text-slate-900 dark:text-white">Added to Waitlist!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You&apos;ll be notified if a spot opens up.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
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
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  You need to add a child to your family first.
                </p>
                <Link
                  href="/onboarding/children"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
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
                            {!eligibility.eligible && (
                              <p className="text-xs text-red-500 mt-1">{eligibility.reason}</p>
                            )}
                          </div>
                          {eligibility.eligible && (
                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                          )}
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

// Icons
function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PlusCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
      />
    </svg>
  );
}

function LocationIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function MapIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

function HeartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
