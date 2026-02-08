'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { OrgLogo } from '../shared/OrgLogo';
import { UpgradeModal } from '../shared/UpgradeModal';
import { SaveSessionModal } from './SaveSessionModal';
import { SessionCardSession } from './SessionCard';
import {
  CalendarIcon,
  ClockIcon,
  DollarIcon,
  UsersIcon,
  LocationIcon,
  MapPinIcon,
  HeartIcon,
  ExternalLinkIcon,
  InfoIcon,
  ChevronDownIcon,
} from '../shared/icons';

export interface SessionGroup {
  primary: SessionCardSession;
  allSessions: SessionCardSession[];
}

export function GroupedSessionCard({
  group,
  cityId,
  isAdmin,
  distanceFromHome,
  preSelectedChildId,
}: {
  group: SessionGroup;
  cityId: Id<'cities'>;
  isAdmin?: boolean;
  distanceFromHome?: number;
  preSelectedChildId?: Id<'children'> | null;
}) {
  const { primary, allSessions } = group;
  const [expanded, setExpanded] = useState(false);
  const [savingSessionId, setSavingSessionId] = useState<Id<'sessions'> | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // If only one session, no grouping needed — just show it directly
  const isGrouped = allSessions.length > 1;

  // Fetch shared data once using the primary session's IDs
  const camp = useQuery(api.camps.queries.getCamp, { campId: primary.campId });
  const organization = useQuery(api.organizations.queries.getOrganization, {
    organizationId: primary.organizationId,
  });
  const location = useQuery(api.locations.queries.getLocation, {
    locationId: primary.locationId,
  });

  // Merged age range across all sessions
  const mergedAgeRange = useMemo(() => {
    let minAge: number | undefined;
    let maxAge: number | undefined;
    let minGrade: number | undefined;
    let maxGrade: number | undefined;

    for (const s of allSessions) {
      const req = s.ageRequirements;
      if (req.minAge !== undefined) {
        minAge = minAge === undefined ? req.minAge : Math.min(minAge, req.minAge);
      }
      if (req.maxAge !== undefined) {
        maxAge = maxAge === undefined ? req.maxAge : Math.max(maxAge, req.maxAge);
      }
      if (req.minGrade !== undefined) {
        minGrade = minGrade === undefined ? req.minGrade : Math.min(minGrade, req.minGrade);
      }
      if (req.maxGrade !== undefined) {
        maxGrade = maxGrade === undefined ? req.maxGrade : Math.max(maxGrade, req.maxGrade);
      }
    }

    return { minAge, maxAge, minGrade, maxGrade };
  }, [allSessions]);

  // Price range
  const priceRange = useMemo(() => {
    const prices = allSessions.map((s) => s.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [allSessions]);

  // Date summary
  const dateSummary = useMemo(() => {
    const sorted = [...allSessions].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    return { earliest, latest, count: sorted.length };
  }, [allSessions]);

  // Availability summary
  const availabilitySummary = useMemo(() => {
    let totalAvailable = 0;
    let soldOutCount = 0;
    for (const s of allSessions) {
      const spots = s.capacity - s.enrolledCount;
      if (s.status === 'sold_out' || spots <= 0) {
        soldOutCount++;
      } else {
        totalAvailable += spots;
      }
    }
    return { totalAvailable, soldOutCount, allSoldOut: soldOutCount === allSessions.length };
  }, [allSessions]);

  // Format helpers
  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startDay = dayNames[startDate.getDay()];
    const endDay = dayNames[endDate.getDay()];
    if (start === end) {
      return `${startDay}, ${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    }
    return `${startDay} ${startDate.toLocaleDateString('en-US', options)} - ${endDay} ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  const formatPrice = (cents: number, currency: string) => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (time: { hour: number; minute: number }): string => {
    const hour12 = time.hour % 12 || 12;
    const ampm = time.hour < 12 ? 'am' : 'pm';
    if (time.minute === 0) return `${hour12}${ampm}`;
    return `${hour12}:${time.minute.toString().padStart(2, '0')}${ampm}`;
  };

  const formatAgeRange = (req: { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number }) => {
    const parts: string[] = [];
    if (req.minAge !== undefined || req.maxAge !== undefined) {
      if (req.minAge !== undefined && req.maxAge !== undefined) {
        parts.push(`Ages ${req.minAge}-${req.maxAge}`);
      } else if (req.minAge !== undefined) {
        parts.push(`Ages ${req.minAge}+`);
      } else if (req.maxAge !== undefined) {
        parts.push(`Ages up to ${req.maxAge}`);
      }
    }
    if (req.minGrade !== undefined || req.maxGrade !== undefined) {
      const gradeLabel = (grade: number) => {
        if (grade === -1) return 'Pre-K';
        if (grade === 0) return 'K';
        return `${grade}`;
      };
      if (req.minGrade !== undefined && req.maxGrade !== undefined) {
        parts.push(`Grades ${gradeLabel(req.minGrade)}-${gradeLabel(req.maxGrade)}`);
      } else if (req.minGrade !== undefined) {
        parts.push(`Grades ${gradeLabel(req.minGrade)}+`);
      } else if (req.maxGrade !== undefined) {
        parts.push(`Grades up to ${gradeLabel(req.maxGrade)}`);
      }
    }
    return parts.join(' / ') || 'All ages';
  };

  const getCampDays = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const formatDuration = (days: number): string => {
    if (days === 1) return '1 day';
    if (days <= 5) return `${days} days`;
    const weeks = Math.round(days / 5);
    if (weeks === 1) return '1 week';
    return `${weeks} weeks`;
  };

  // Category-based colors for placeholder
  const getCategoryStyle = (categories: string[] | undefined) => {
    const category = categories?.[0]?.toLowerCase() || '';
    const styles: Record<string, { bg: string; icon: string }> = {
      sports: { bg: 'from-green-500 to-emerald-600', icon: '⚽' },
      arts: { bg: 'from-purple-500 to-pink-600', icon: '🎨' },
      stem: { bg: 'from-primary/100 to-cyan-600', icon: '🔬' },
      technology: { bg: 'from-primary/100 to-indigo-600', icon: '💻' },
      nature: { bg: 'from-green-600 to-teal-600', icon: '🌲' },
      music: { bg: 'from-pink-500 to-rose-600', icon: '🎵' },
      academic: { bg: 'from-amber-500 to-orange-600', icon: '📚' },
      drama: { bg: 'from-red-500 to-pink-600', icon: '🎭' },
      adventure: { bg: 'from-orange-500 to-red-600', icon: '🏕️' },
      cooking: { bg: 'from-yellow-500 to-orange-500', icon: '👨‍🍳' },
      dance: { bg: 'from-fuchsia-500 to-purple-600', icon: '💃' },
    };
    return styles[category] || { bg: 'from-slate-500 to-slate-600', icon: '🏕️' };
  };

  const categoryStyle = getCategoryStyle(camp?.categories);
  const campImageUrl = camp?.resolvedImageUrls?.[0] || null;
  const isSoldOut = availabilitySummary.allSoldOut;

  return (
    <>
      <div
        className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${
          isSoldOut ? 'opacity-60 grayscale-[30%]' : 'hover:shadow-lg hover:-translate-y-0.5'
        }`}
      >
        {/* Camp Image or Category Placeholder */}
        <div className="relative h-48 overflow-hidden group">
          {campImageUrl ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse motion-reduce:animate-none" />
              <img
                src={campImageUrl}
                alt={camp?.name || 'Camp'}
                className="relative w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${categoryStyle.bg} flex items-center justify-center`}>
              <span className="text-4xl opacity-50">{categoryStyle.icon}</span>
            </div>
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          {/* Status badges */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {isGrouped && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/90 text-white">
                {allSessions.length} sessions
              </span>
            )}
            {isSoldOut && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                Sold Out
              </span>
            )}
            {!isSoldOut && availabilitySummary.soldOutCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Some sold out
              </span>
            )}
          </div>
          {/* Bottom gradient overlay for camp name */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
          {/* Camp name and org logo overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-end gap-2">
              {organization?.logoUrl && (
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
                  <OrgLogo url={organization.logoUrl} name={organization.name} size="md" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/session/${primary._id}`}
                  className="text-base font-semibold text-white hover:text-white/70 hover:underline line-clamp-1 drop-shadow-md"
                >
                  {camp?.name ?? 'Loading...'}
                </Link>
                <p className="text-xs text-white/80 line-clamp-1 drop-shadow-sm">
                  {organization?.name ?? 'Loading...'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Categories and description */}
          <div className="mb-3">
            {camp?.categories && camp.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {camp.categories.slice(0, 3).map((cat) => {
                  const icons: Record<string, string> = {
                    sports: '⚽',
                    arts: '🎨',
                    stem: '🔬',
                    nature: '🌲',
                    music: '🎵',
                    academic: '📚',
                    drama: '🎭',
                    adventure: '🏔️',
                    cooking: '🍳',
                    dance: '💃',
                  };
                  const icon = icons[cat.toLowerCase()] || '';
                  return (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    >
                      {icon && <span className="text-[10px]">{icon}</span>}
                      {cat}
                    </span>
                  );
                })}
              </div>
            )}
            {camp?.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2">{camp.description}</p>
            )}
          </div>

          {/* Summary info */}
          <div className="space-y-2 mb-4">
            {/* Dates */}
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <CalendarIcon />
              <span>
                {isGrouped ? (
                  <>
                    {dateSummary.count} sessions: {formatDateShort(dateSummary.earliest.startDate)} -{' '}
                    {formatDateShort(dateSummary.latest.endDate)}
                  </>
                ) : (
                  <>
                    {formatDateRange(primary.startDate, primary.endDate)}
                    <span className="text-slate-500 dark:text-slate-500 ml-1">
                      ({formatDuration(getCampDays(primary.startDate, primary.endDate))})
                    </span>
                  </>
                )}
              </span>
            </div>

            {/* Time (from primary session) */}
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <ClockIcon />
              <span>
                {primary.isOvernight ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                    Overnight
                  </span>
                ) : (
                  <>
                    {formatTime(primary.dropOffTime)} - {formatTime(primary.pickUpTime)}
                    {primary.extendedCareAvailable && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        +Extended care
                      </span>
                    )}
                  </>
                )}
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <DollarIcon />
              <span>
                {isGrouped && priceRange.min !== priceRange.max ? (
                  <>
                    {formatPrice(priceRange.min, primary.currency)} - {formatPrice(priceRange.max, primary.currency)}
                  </>
                ) : (
                  formatPrice(primary.price, primary.currency)
                )}
              </span>
            </div>

            {/* Age range */}
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <UsersIcon />
              <span>{isGrouped ? formatAgeRange(mergedAgeRange) : formatAgeRange(primary.ageRequirements)}</span>
            </div>

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <LocationIcon />
                <span className="line-clamp-1 flex-1">
                  {location.name}
                  {location.address?.city && ` - ${location.address.city}`}
                </span>
                {distanceFromHome !== undefined && (
                  <span className="flex-shrink-0 text-primary dark:text-primary-light font-medium">
                    {distanceFromHome} mi
                  </span>
                )}
                {location.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-white/60"
                    title="View on map"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MapPinIcon />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Action buttons for single session */}
          {!isGrouped && (
            <div className="flex items-center gap-2">
              {primary.externalRegistrationUrl ? (
                <>
                  <a
                    href={primary.externalRegistrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-green-600 text-white text-center text-sm font-medium rounded-md hover:bg-green-700 flex items-center justify-center gap-1"
                  >
                    Register
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                  <Link
                    href={`/session/${primary._id}`}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                    title="View details"
                  >
                    <InfoIcon />
                  </Link>
                </>
              ) : (
                <Link
                  href={`/session/${primary._id}`}
                  className="flex-1 px-4 py-2 bg-primary text-white text-center text-sm font-medium rounded-md hover:bg-primary-dark"
                >
                  View Details
                </Link>
              )}
              <button
                onClick={() => setSavingSessionId(primary._id)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                title="Save for later"
                aria-label="Save for later"
              >
                <HeartIcon />
              </button>
            </div>
          )}

          {/* Expandable session list for grouped cards */}
          {isGrouped && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-md text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span>
                  {expanded ? 'Hide' : 'Show'} {allSessions.length} sessions
                </span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="mt-2 space-y-2">
                  {allSessions.map((session) => {
                    const spots = session.capacity - session.enrolledCount;
                    const sessionSoldOut = session.status === 'sold_out' || spots <= 0;
                    return (
                      <div
                        key={session._id}
                        className={`flex items-center gap-3 p-2 rounded-md border border-slate-200 dark:border-slate-600 ${
                          sessionSoldOut ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {formatDateRange(session.startDate, session.endDate)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatPrice(session.price, session.currency)}
                            {' · '}
                            {formatAgeRange(session.ageRequirements)}
                            {sessionSoldOut ? (
                              <span className="ml-1 text-red-500">· Sold out</span>
                            ) : spots <= 5 && !(session.capacity === 20 && session.enrolledCount === 0) ? (
                              <span className="ml-1 text-orange-500">· {spots} spots left</span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Link
                            href={`/session/${session._id}`}
                            className="px-2.5 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary-dark"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => setSavingSessionId(session._id)}
                            className="p-1.5 text-slate-400 hover:text-primary dark:hover:text-primary-light"
                            title="Save for later"
                            aria-label="Save session for later"
                          >
                            <HeartIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {savingSessionId && (
        <SaveSessionModal
          sessionId={savingSessionId}
          campName={camp?.name ?? 'Camp'}
          onClose={() => setSavingSessionId(null)}
          onPaywallHit={() => setShowUpgradeModal(true)}
          preSelectedChildId={preSelectedChildId}
          ageRequirements={
            allSessions.find((s) => s._id === savingSessionId)?.ageRequirements ?? primary.ageRequirements
          }
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}
