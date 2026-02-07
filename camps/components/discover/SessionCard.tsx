'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { OrgLogo } from '../shared/OrgLogo';
import { UpgradeModal } from '../shared/UpgradeModal';
import { SaveSessionModal } from './SaveSessionModal';
import { CalendarIcon, ClockIcon, DollarIcon, UsersIcon, LocationIcon, MapPinIcon, HeartIcon, CloseIcon, ExternalLinkIcon, InfoIcon, SparklesIcon, SpinnerIcon, PencilIcon } from '../shared/icons';

export interface SessionCardSession {
  _id: Id<'sessions'>;
  campId: Id<'camps'>;
  locationId: Id<'locations'>;
  organizationId: Id<'organizations'>;
  startDate: string;
  endDate: string;
  dropOffTime: { hour: number; minute: number };
  pickUpTime: { hour: number; minute: number };
  isOvernight?: boolean;
  extendedCareAvailable: boolean;
  price: number;
  currency: string;
  capacity: number;
  enrolledCount: number;
  waitlistEnabled: boolean;
  waitlistCount: number;
  status: 'draft' | 'active' | 'sold_out' | 'cancelled' | 'completed';
  externalRegistrationUrl?: string;
  ageRequirements: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
}

export function SessionCard({
  session,
  cityId,
  isAdmin,
  distanceFromHome,
  preSelectedChildId,
}: {
  session: SessionCardSession;
  cityId: Id<'cities'>;
  isAdmin?: boolean;
  distanceFromHome?: number;
  preSelectedChildId?: Id<'children'> | null;
}) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showStyleEditor, setShowStyleEditor] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generateImage = useAction(api.scraping.generateImages.generateCampImage);
  const updateCampStyle = useMutation(api.camps.mutations.updateCampImageStyle);

  // Fetch related data
  const camp = useQuery(api.camps.queries.getCamp, { campId: session.campId });
  const organization = useQuery(api.organizations.queries.getOrganization, {
    organizationId: session.organizationId,
  });
  const location = useQuery(api.locations.queries.getLocation, {
    locationId: session.locationId,
  });

  // Format dates with day of week
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = dayNames[startDate.getDay()];
    const endDay = dayNames[endDate.getDay()];

    if (start === end) {
      return `${startDay}, ${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    }

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    if (startYear === endYear) {
      // Show days only if they're weekdays (Mon-Fri typical camp week)
      return `${startDay} ${startDate.toLocaleDateString('en-US', options)} - ${endDay} ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
    }

    return `${startDay} ${startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${endDay} ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  // Format price
  const formatPrice = (cents: number, currency: string) => {
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate camp days (weekdays only)
  const getCampDays = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Count weekdays only (Mon-Fri)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  // Format duration nicely
  const formatDuration = (days: number): string => {
    if (days === 1) return '1 day';
    if (days <= 5) return `${days} days`;
    const weeks = Math.round(days / 5);
    if (weeks === 1) return '1 week';
    return `${weeks} weeks`;
  };

  // Get summer week number(s) for a session
  const getSummerWeeks = (startDateStr: string, endDateStr: string): string | null => {
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    const year = startDate.getFullYear();

    // Find first Monday of June
    const june1 = new Date(year, 5, 1);
    const dayOfWeek = june1.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const summerStart = new Date(year, 5, 1 + daysUntilMonday);

    // Check if dates are within summer (June-August)
    if (startDate.getMonth() < 5 || startDate.getMonth() > 7) return null;

    // Calculate week numbers
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const startWeek = Math.floor((startDate.getTime() - summerStart.getTime()) / msPerWeek) + 1;
    const endWeek = Math.floor((endDate.getTime() - summerStart.getTime()) / msPerWeek) + 1;

    if (startWeek < 1 || startWeek > 13) return null;

    if (startWeek === endWeek) {
      return `Week ${startWeek}`;
    }
    return `Weeks ${startWeek}-${Math.min(endWeek, 13)}`;
  };

  // Format time (12-hour format)
  const formatTime = (time: { hour: number; minute: number }): string => {
    const hour12 = time.hour % 12 || 12;
    const ampm = time.hour < 12 ? 'am' : 'pm';
    if (time.minute === 0) {
      return `${hour12}${ampm}`;
    }
    return `${hour12}:${time.minute.toString().padStart(2, '0')}${ampm}`;
  };

  // Calculate session duration and return half-day/full-day label
  const getDayTypeLabel = (
    dropOff: { hour: number; minute: number },
    pickUp: { hour: number; minute: number }
  ): { label: string; isHalfDay: boolean } => {
    const dropOffMinutes = dropOff.hour * 60 + dropOff.minute;
    const pickUpMinutes = pickUp.hour * 60 + pickUp.minute;
    const durationHours = (pickUpMinutes - dropOffMinutes) / 60;
    const hours = Math.round(durationHours);
    // Half-day is typically less than 5 hours
    if (durationHours < 5) {
      return { label: `${hours}h`, isHalfDay: true };
    }
    return { label: `${hours}h`, isHalfDay: false };
  };

  // Format age range
  const formatAgeRange = (requirements: typeof session.ageRequirements) => {
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
      const gradeLabel = (grade: number) => {
        if (grade === -1) return 'Pre-K';
        if (grade === 0) return 'K';
        return `${grade}`;
      };

      if (requirements.minGrade !== undefined && requirements.maxGrade !== undefined) {
        parts.push(`Grades ${gradeLabel(requirements.minGrade)}-${gradeLabel(requirements.maxGrade)}`);
      } else if (requirements.minGrade !== undefined) {
        parts.push(`Grades ${gradeLabel(requirements.minGrade)}+`);
      } else if (requirements.maxGrade !== undefined) {
        parts.push(`Grades up to ${gradeLabel(requirements.maxGrade)}`);
      }
    }

    return parts.join(' / ') || 'All ages';
  };

  // Get status info
  const getStatusBadge = () => {
    // No real availability data (default capacity=20, enrolled=0)
    if (session.capacity === 20 && session.enrolledCount === 0 && session.status !== 'sold_out') {
      return null;
    }

    if (session.status === 'sold_out' || session.enrolledCount >= session.capacity) {
      if (session.waitlistEnabled) {
        return {
          label: `Waitlist (${session.waitlistCount})`,
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
          urgent: false,
        };
      }
      return {
        label: 'Sold Out',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        urgent: false,
      };
    }

    const spotsLeft = session.capacity - session.enrolledCount;

    // Very low availability (1-2 spots)
    if (spotsLeft <= 2) {
      return {
        label: `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left!`,
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        urgent: true,
      };
    }

    // Low availability (3-5 spots)
    if (spotsLeft <= 5) {
      return {
        label: `${spotsLeft} spots left`,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        urgent: false,
      };
    }

    // Good availability (6-10 spots)
    if (spotsLeft <= 10) {
      return {
        label: `${spotsLeft} spots`,
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        urgent: false,
      };
    }

    // Plenty available
    return {
      label: 'Available',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      urgent: false,
    };
  };

  const statusBadge = getStatusBadge();

  // Get timing badge for sessions starting soon
  const getTimingBadge = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(session.startDate + 'T00:00:00');
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilStart < 0) return null; // Already started
    if (daysUntilStart === 0) {
      return { label: 'Starts today!', className: 'bg-surface/30 text-purple-800 dark:bg-purple-900 dark:text-purple-200', urgent: true };
    }
    if (daysUntilStart <= 3) {
      return { label: `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`, className: 'bg-surface/30 text-purple-800 dark:bg-purple-900 dark:text-purple-200', urgent: true };
    }
    if (daysUntilStart <= 14) {
      return { label: 'Starting soon', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200', urgent: false };
    }
    return null;
  };

  const timingBadge = getTimingBadge();

  // Calculate spots left
  const spotsLeft = session.capacity - session.enrolledCount;
  const hasAvailabilityData = !(session.capacity === 20 && session.enrolledCount === 0);
  const isSoldOut = session.status === 'sold_out' || spotsLeft <= 0;

  // Check if popular (75%+ enrolled but not sold out)
  const enrollmentPercent = session.enrolledCount / session.capacity;
  const isPopular = !isSoldOut && enrollmentPercent >= 0.75 && spotsLeft > 2;

  // Check if budget-friendly (under $200)
  const isBudgetFriendly = session.price < 20000; // 200 dollars in cents

  // Get camp image URL (from Convex storage or fallback)
  const campImageUrl = camp?.resolvedImageUrls?.[0] || null;

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

  // Urgency indicator class based on spots left
  const getUrgencyClass = () => {
    if (isSoldOut) return '';
    if (spotsLeft <= 2) return 'ring-2 ring-red-400 dark:ring-red-500';
    if (spotsLeft <= 5) return 'ring-2 ring-orange-400 dark:ring-orange-500';
    return '';
  };

  return (
    <>
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${
        isSoldOut
          ? 'opacity-60 grayscale-[30%]'
          : 'hover:shadow-lg hover:-translate-y-0.5'
      } ${getUrgencyClass()}`}>
        {/* Camp Image or Category Placeholder */}
        <div className="relative h-48 overflow-hidden group">
          {campImageUrl ? (
            <>
              {/* Shimmer background shows through while image loads */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 animate-pulse motion-reduce:animate-none" />
              <img
                src={campImageUrl}
                alt={camp?.name || 'Camp'}
                className="relative w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  // On error, hide image and show placeholder
                  e.currentTarget.style.display = 'none';
                }}
              />
              {/* Admin: Regenerate and Edit Style Buttons (shows on hover) */}
              {isAdmin && camp && (
                <div className="absolute bottom-14 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowStyleEditor(true);
                    }}
                    className="px-2 py-1 bg-black/70 text-white text-xs font-medium rounded shadow hover:bg-black/90 flex items-center gap-1"
                    title="Edit image style"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsGenerating(true);
                      setGenerateError(null);
                      try {
                        const result = await generateImage({ campId: camp._id });
                        if (!result.success) {
                          setGenerateError(result.error || 'Failed to generate image');
                        }
                      } catch (err) {
                        setGenerateError(err instanceof Error ? err.message : 'Unknown error');
                      } finally {
                        setIsGenerating(false);
                      }
                    }}
                    disabled={isGenerating}
                    className="px-2 py-1 bg-black/70 text-white text-xs font-medium rounded shadow hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Regenerate AI image"
                  >
                    {isGenerating ? (
                      <>
                        <SpinnerIcon />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SparklesIcon />
                        Regenerate
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${categoryStyle.bg} flex items-center justify-center`}>
              <span className="text-4xl opacity-50">{categoryStyle.icon}</span>
              {/* Admin: Generate Image Button */}
              {isAdmin && camp && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsGenerating(true);
                    setGenerateError(null);
                    try {
                      const result = await generateImage({ campId: camp._id });
                      if (!result.success) {
                        setGenerateError(result.error || 'Failed to generate image');
                      }
                    } catch (err) {
                      setGenerateError(err instanceof Error ? err.message : 'Unknown error');
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={isGenerating}
                  className="absolute bottom-14 right-2 z-10 px-2 py-1 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-xs font-medium rounded shadow hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Generate AI image for this camp"
                >
                  {isGenerating ? (
                    <>
                      <SpinnerIcon />
                      Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      Generate
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          {generateError && (
            <div className="absolute bottom-2 left-2 right-14 px-2 py-1 bg-red-500/90 text-white text-xs rounded truncate">
              {generateError}
            </div>
          )}
          {/* Gradient overlay for badge readability */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          {/* Status badges overlay */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {statusBadge && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className} ${statusBadge.urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
              >
                {statusBadge.label}
              </span>
            )}
            {timingBadge && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${timingBadge.className} ${timingBadge.urgent ? 'animate-pulse motion-reduce:animate-none' : ''}`}
              >
                {timingBadge.label}
              </span>
            )}
            {isPopular && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                🔥 Popular
              </span>
            )}
            {isBudgetFriendly && !isSoldOut && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                💰 Budget-friendly
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
                  href={`/session/${session._id}`}
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
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2">
                {camp.description}
              </p>
            )}
          </div>

        {/* Spots Left Indicator */}
        {!isSoldOut && hasAvailabilityData && (
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                spotsLeft <= 3
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : spotsLeft <= 5
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                spotsLeft <= 3 ? 'bg-red-500' : spotsLeft <= 5 ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
            </span>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <CalendarIcon />
            <span>
              {formatDateRange(session.startDate, session.endDate)}
              <span className="text-slate-500 dark:text-slate-500 ml-1">
                ({formatDuration(getCampDays(session.startDate, session.endDate))})
              </span>
              {(() => {
                const weekLabel = getSummerWeeks(session.startDate, session.endDate);
                if (!weekLabel) return null;
                return (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {weekLabel}
                  </span>
                );
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <ClockIcon />
            <span>
              {session.isOvernight ? (
                <>
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                    Overnight
                  </span>
                </>
              ) : (
                <>
                  {formatTime(session.dropOffTime)} - {formatTime(session.pickUpTime)}
                  {(() => {
                    const dayType = getDayTypeLabel(session.dropOffTime, session.pickUpTime);
                    return (
                      <span
                        className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          dayType.isHalfDay
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-primary/20 text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light'
                        }`}
                      >
                        {dayType.label}
                      </span>
                    );
                  })()}
                  {session.extendedCareAvailable && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      +Extended care
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <DollarIcon />
            <span>
              {formatPrice(session.price, session.currency)}
              {(() => {
                const days = getCampDays(session.startDate, session.endDate);
                if (days > 1) {
                  const perDay = Math.round(session.price / days);
                  return (
                    <span className="text-slate-500 dark:text-slate-500 ml-1">
                      ({formatPrice(perDay, session.currency)}/day)
                    </span>
                  );
                }
                return null;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <UsersIcon />
            <span>{formatAgeRange(session.ageRequirements)}</span>
          </div>
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
                    `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`
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

        <div className="flex items-center gap-2">
          {session.externalRegistrationUrl ? (
            <>
              <a
                href={session.externalRegistrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 bg-green-600 text-white text-center text-sm font-medium rounded-md hover:bg-green-700 flex items-center justify-center gap-1"
              >
                Register
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
              <Link
                href={`/session/${session._id}`}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                title="View details"
              >
                <InfoIcon />
              </Link>
            </>
          ) : (
            <Link
              href={`/session/${session._id}`}
              className="flex-1 px-4 py-2 bg-primary text-white text-center text-sm font-medium rounded-md hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              View Details
            </Link>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Save for later"
            aria-label="Save for later"
          >
            <HeartIcon />
          </button>
        </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <SaveSessionModal
          sessionId={session._id}
          campName={camp?.name ?? 'Camp'}
          onClose={() => setShowSaveModal(false)}
          onPaywallHit={() => setShowUpgradeModal(true)}
          preSelectedChildId={preSelectedChildId}
          ageRequirements={session.ageRequirements}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

      {/* Style Editor Modal */}
      {showStyleEditor && camp && (
        <StyleEditorModal
          campId={camp._id}
          campName={camp.name}
          currentStyle={camp.imageStylePrompt}
          onClose={() => setShowStyleEditor(false)}
          onSave={async (style) => {
            await updateCampStyle({ campId: camp._id, imageStylePrompt: style || undefined });
            setShowStyleEditor(false);
          }}
        />
      )}
    </>
  );
}

// Style Editor Modal for admins
function StyleEditorModal({
  campId,
  campName,
  currentStyle,
  onClose,
  onSave,
}: {
  campId: Id<'camps'>;
  campName: string;
  currentStyle?: string;
  onClose: () => void;
  onSave: (style: string | undefined) => Promise<void>;
}) {
  const [style, setStyle] = useState(currentStyle || '');
  const [isSaving, setIsSaving] = useState(false);

  const presetStyles = [
    'Vibrant watercolor with wet-on-wet technique. Dramatic low angle looking up. Golden hour sunlight streaming through. Frozen mid-action, peak moment captured.',
    'Polished digital painting like Pixar concept art. Wide cinematic shot with rule of thirds. Bright overcast day, soft even lighting. Genuine laughter and joy visible.',
    'Rich oil painting with visible impasto brushstrokes. Over-the-shoulder perspective, intimate. Dappled light filtering through trees. Curious discovery moment.',
    'Studio Ghibli inspired animation style. Bird\'s eye view showing the whole activity. Magic hour glow, long shadows. Playful chaos and movement.',
    'Editorial illustration style for New York Times. Dynamic diagonal composition. Dramatic rim lighting from behind. Intense concentration and focus.',
    'Nostalgic Norman Rockwell style illustration. Symmetrical framing with central focus. Warm indoor lighting with soft shadows. Collaborative teamwork moment.',
    'Crisp digital art, trending on artstation. Dutch angle adding energy. High key bright and airy. Triumphant achievement expression.',
    'Dreamy soft pastel artwork with chalky texture. Close-up on hands and activity, shallow depth of field. Natural window light, cozy. Peaceful flow state.',
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(style.trim() || undefined);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Edit Image Style: {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Custom Style Prompt
          </label>
          <textarea
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="e.g., Style: watercolor painting, soft colors, impressionistic..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Leave empty to use auto-generated style based on camp ID
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Preset Styles
          </label>
          <div className="flex flex-wrap gap-2">
            {presetStyles.map((preset, i) => (
              <button
                key={i}
                onClick={() => setStyle(preset)}
                className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {preset.replace('Style: ', '').split(',')[0]}
              </button>
            ))}
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
            onClick={() => {
              setStyle('');
            }}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

