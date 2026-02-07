'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { CoverageStatus } from './CoverageIndicator';
import { DEFAULT_CHILD_COLORS } from '../../lib/constants';
import type { ChildCoverage, WeekData, RegistrationClickData, EventClickData } from '../../lib/types';

export type { RegistrationClickData, EventClickData };

interface PlannerGridProps {
  coverage: WeekData[];
  children: { _id: Id<'children'>; firstName: string; birthdate?: string; currentGrade?: number; color?: string; shareToken?: string }[];
  citySlug?: string;
  sessionCounts?: Record<string, Record<string, number>> | null; // { weekStart: { childId: count } }
  onGapClick?: (weekStart: string, weekEnd: string, childId: Id<'children'>) => void;
  onRegistrationClick?: (data: RegistrationClickData) => void;
  onEventClick?: (data: EventClickData) => void;
  onAddChild?: () => void;
}

export function PlannerGrid({ coverage, children, citySlug, sessionCounts, onGapClick, onRegistrationClick, onEventClick, onAddChild }: PlannerGridProps) {
  const generateShareToken = useMutation(api.children.mutations.generateShareToken);
  const [generatingToken, setGeneratingToken] = useState<Id<'children'> | null>(null);
  const [copiedChildId, setCopiedChildId] = useState<Id<'children'> | null>(null);

  const handleShareClick = async (childId: Id<'children'>, childName: string, existingToken?: string) => {
    let token = existingToken;
    if (!token) {
      setGeneratingToken(childId);
      try {
        token = await generateShareToken({ childId }) || undefined;
      } finally {
        setGeneratingToken(null);
      }
    }
    if (!token) return;

    const shareUrl = `${window.location.origin}/share/${token}`;
    const shareData = {
      title: `${childName}'s Summer Camp Schedule`,
      text: `Check out ${childName}'s summer camp schedule!`,
      url: shareUrl,
    };

    // Try native share API first (mobile)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to copy
      }
    }

    // Fall back to copying the URL
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedChildId(childId);
      setTimeout(() => setCopiedChildId(null), 2000);
    } catch (err) {
      // Fallback for older browsers
      prompt('Copy this link to share:', shareUrl);
    }
  };

  const handleCalendarClick = async (childId: Id<'children'>, childName: string, existingToken?: string) => {
    let token = existingToken;
    if (!token) {
      setGeneratingToken(childId);
      try {
        token = await generateShareToken({ childId }) || undefined;
      } finally {
        setGeneratingToken(null);
      }
    }
    if (token) {
      const url = `${window.location.origin}/api/calendar/${token}`;
      navigator.clipboard.writeText(url);
      alert(`Calendar URL copied for ${childName}!\n\nTo add to Google Calendar:\n1. Open Google Calendar\n2. Click + next to "Other calendars"\n3. Select "From URL"\n4. Paste the copied URL`);
    }
  };

  // Group weeks by month
  const weeksByMonth = useMemo(() => {
    const groups: Map<string, WeekData[]> = new Map();
    for (const week of coverage) {
      const month = week.week.monthName;
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(week);
    }
    return Array.from(groups.entries());
  }, [coverage]);

  // Get today for highlighting current week
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isCurrentWeek = (week: WeekData) => {
    const weekStart = new Date(week.week.startDate + 'T00:00:00');
    const weekEnd = new Date(week.week.endDate + 'T23:59:59');
    return today >= weekStart && today <= weekEnd;
  };

  const isPastWeek = (week: WeekData) => {
    const weekEnd = new Date(week.week.endDate + 'T23:59:59');
    return today > weekEnd;
  };

  // Get cell status for a child in a given week
  const getCellData = (childId: Id<'children'>, week: WeekData) => {
    const childCov = week.childCoverage.find(c => c.childId === childId);
    return childCov || null;
  };

  // Track which weeks start a new month (for vertical divider in desktop view)
  const monthStartDates = useMemo(() => {
    const starts = new Set<string>();
    weeksByMonth.forEach(([, weeks], i) => {
      if (i > 0 && weeks.length > 0) starts.add(weeks[0].week.startDate);
    });
    return starts;
  }, [weeksByMonth]);

  return (
    <div className="md:bg-white md:dark:bg-slate-800 md:rounded-xl md:border md:border-slate-200 md:dark:border-slate-700 overflow-hidden md:shadow-sm">
      {/* Mobile layout: months stacked vertically */}
      <div className="md:hidden space-y-3">
        {weeksByMonth.map(([month, weeks], monthIndex) => (
          <div key={month} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {/* Month header */}
            <div className="px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900">
              {month}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[90px]">
                    </th>
                    {weeks.map((week) => {
                      const current = isCurrentWeek(week);
                      const past = isPastWeek(week);
                      return (
                        <th
                          key={week.week.startDate}
                          className={`px-1 py-1.5 text-center text-xs border-b border-l border-slate-200 dark:border-slate-700 ${
                            current
                              ? 'bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 font-bold'
                              : past
                              ? 'text-slate-400 dark:text-slate-500'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                          title={`${week.week.startDate} - ${week.week.endDate}`}
                        >
                          <div className="font-medium">{week.week.label.split(' ')[0]}</div>
                          <div className="text-[10px] opacity-70">{week.week.label.split(' ').slice(1).join(' ')}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {children.map((child, childIndex) => {
                    const childColor = child.color || DEFAULT_CHILD_COLORS[childIndex % DEFAULT_CHILD_COLORS.length];
                    return (
                      <tr
                        key={child._id}
                        className={childIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}
                      >
                        <td className="sticky left-0 z-10 px-3 py-2 text-sm font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700/50 bg-inherit">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: childColor }}
                            >
                              {child.firstName[0]}
                            </span>
                            <span className="truncate text-xs">{child.firstName}</span>
                            <button
                              onClick={() => handleShareClick(child._id, child.firstName, child.shareToken)}
                              disabled={generatingToken === child._id}
                              className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50 flex-shrink-0"
                              title={`Share ${child.firstName}'s schedule`}
                            >
                              {copiedChildId === child._id ? (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Copied!</span>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                        {weeks.map((week) => {
                          const cellData = getCellData(child._id, week);
                          const current = isCurrentWeek(week);
                          const past = isPastWeek(week);
                          return (
                            <CoverageCell
                              key={`${child._id}-${week.week.startDate}`}
                              data={cellData}
                              week={week}
                              childId={child._id}
                              childName={child.firstName}
                              childGrade={child.currentGrade}
                              availableSessionCount={sessionCounts?.[week.week.startDate]?.[child._id]}
                              isCurrentWeek={current}
                              isPastWeek={past}
                              citySlug={citySlug}
                              onGapClick={onGapClick}
                              onRegistrationClick={onRegistrationClick}
                              onEventClick={onEventClick}
                            />
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Add Kid row - only in the last month */}
                  {onAddChild && monthIndex === weeksByMonth.length - 1 && (
                    <tr className="bg-white dark:bg-slate-800">
                      <td className="sticky left-0 z-10 px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50">
                        <button
                          onClick={onAddChild}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-primary dark:hover:text-primary-light transition-colors"
                        >
                          <span className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </span>
                          Add Kid
                        </button>
                      </td>
                      {weeks.map((week) => (
                        <td
                          key={`add-${week.week.startDate}`}
                          className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0"
                        >
                          <div className="w-full min-h-[48px]" />
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop layout: all months side-by-side */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Month headers */}
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-900">
              <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 min-w-[120px]">

              </th>
              {weeksByMonth.map(([month, weeks]) => (
                <th
                  key={month}
                  colSpan={weeks.length}
                  className="px-2 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-l border-slate-200 dark:border-slate-700"
                >
                  {month}
                </th>
              ))}
            </tr>
            {/* Week number headers */}
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">

              </th>
              {coverage.map((week) => {
                const current = isCurrentWeek(week);
                const past = isPastWeek(week);
                const isMonthStart = monthStartDates.has(week.week.startDate);
                return (
                  <th
                    key={week.week.startDate}
                    className={`px-1 py-1.5 text-center text-xs border-b border-slate-200 dark:border-slate-700 ${
                      isMonthStart ? 'border-l border-l-slate-300 dark:border-l-slate-600' : 'border-l border-l-slate-200 dark:border-l-slate-700'
                    } ${
                      current
                        ? 'bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 font-bold'
                        : past
                        ? 'text-slate-400 dark:text-slate-500'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    title={`${week.week.startDate} - ${week.week.endDate}`}
                  >
                    <div className="font-medium">{week.week.label.split(' ')[0]}</div>
                    <div className="text-[10px] opacity-70">{week.week.label.split(' ').slice(1).join(' ')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {children.map((child, childIndex) => {
              const childColor = child.color || DEFAULT_CHILD_COLORS[childIndex % DEFAULT_CHILD_COLORS.length];
              return (
              <tr
                key={child._id}
                className={childIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}
              >
                {/* Child name - sticky left column */}
                <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700/50 bg-inherit">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: childColor }}
                    >
                      {child.firstName[0]}
                    </span>
                    <span>{child.firstName}</span>
                    <button
                      onClick={() => handleShareClick(child._id, child.firstName, child.shareToken)}
                      disabled={generatingToken === child._id}
                      className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                      title={`Share ${child.firstName}'s schedule`}
                    >
                      {copiedChildId === child._id ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Copied!</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleCalendarClick(child._id, child.firstName, child.shareToken)}
                      disabled={generatingToken === child._id}
                      className="hidden md:inline-flex text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                      title={`Copy calendar URL for ${child.firstName}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </td>
                {/* Week cells */}
                {coverage.map((week) => {
                  const cellData = getCellData(child._id, week);
                  const current = isCurrentWeek(week);
                  const past = isPastWeek(week);

                  return (
                    <CoverageCell
                      key={`${child._id}-${week.week.startDate}`}
                      data={cellData}
                      week={week}
                      childId={child._id}
                      childName={child.firstName}
                      childGrade={child.currentGrade}
                      availableSessionCount={sessionCounts?.[week.week.startDate]?.[child._id]}
                      isCurrentWeek={current}
                      isPastWeek={past}
                      isMonthStart={monthStartDates.has(week.week.startDate)}
                      citySlug={citySlug}
                      onGapClick={onGapClick}
                      onRegistrationClick={onRegistrationClick}
                      onEventClick={onEventClick}
                    />
                  );
                })}
              </tr>
            );
            })}
            {/* Add Kid row */}
            {onAddChild && (
              <tr className="bg-white dark:bg-slate-800">
                <td className="sticky left-0 z-10 px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50">
                  <button
                    onClick={onAddChild}
                    className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-primary dark:hover:text-primary-light transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                    Add Kid
                  </button>
                </td>
                {coverage.map((week) => (
                  <td
                    key={`add-${week.week.startDate}`}
                    className={`border-b border-slate-100 dark:border-slate-700/50 p-0 ${
                      monthStartDates.has(week.week.startDate) ? 'border-l border-l-slate-300 dark:border-l-slate-600' : 'border-l border-l-slate-100 dark:border-l-slate-700/50'
                    }`}
                  >
                    <div className="w-full min-h-[48px]" />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CoverageCellProps {
  data: ChildCoverage | null;
  week: WeekData;
  childId: Id<'children'>;
  childName: string;
  childGrade?: number;
  availableSessionCount?: number;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isMonthStart?: boolean;
  citySlug?: string;
  onGapClick?: (weekStart: string, weekEnd: string, childId: Id<'children'>) => void;
  onRegistrationClick?: (data: RegistrationClickData) => void;
  onEventClick?: (data: EventClickData) => void;
}

function CoverageCell({ data, week, childId, childName, childGrade, availableSessionCount, isCurrentWeek, isPastWeek, isMonthStart, citySlug, onGapClick, onRegistrationClick, onEventClick }: CoverageCellProps) {
  const status = data?.status || 'gap';
  const hasEvent = data?.events && data.events.length > 0;
  const hasRegistration = data?.registrations && data.registrations.length > 0;
  const campName = data?.registrations?.[0]?.campName;
  const eventTitle = data?.events?.[0]?.title;
  const logoUrl = data?.registrations?.[0]?.organizationLogoUrl;
  const registrationStatus = data?.registrations?.[0]?.status;
  const availableCount = availableSessionCount;

  // Determine registration-specific styling
  const isRegistered = registrationStatus === 'registered';
  const isWishlist = registrationStatus === 'interested';
  const isWaitlisted = registrationStatus === 'waitlisted';

  const tdClass = `border-b border-slate-100 dark:border-slate-700/50 p-0 ${
    isMonthStart ? 'border-l border-l-slate-300 dark:border-l-slate-600' : 'border-l border-l-slate-100 dark:border-l-slate-700/50'
  }`;

  // Determine cell appearance based on registration status
  let bgColor = '';
  let icon = '';
  let tooltip = '';
  let borderStyle = '';

  if (hasEvent) {
    bgColor = 'bg-surface/30 dark:bg-surface-dark/40';
    icon = '✈️';
    tooltip = eventTitle || 'Family Event';
  } else if (status === 'school') {
    bgColor = 'bg-slate-100 dark:bg-slate-800';
    icon = '📚';
    tooltip = 'Still in school';
  } else if (status === 'full' || status === 'partial') {
    // Determine styling based on registration status
    if (isRegistered) {
      bgColor = 'bg-green-100 dark:bg-green-900/40';
      tooltip = campName ? `${campName} (Registered)` : 'Registered';
    } else if (isWaitlisted) {
      bgColor = 'bg-yellow-100 dark:bg-yellow-900/40';
      tooltip = campName ? `${campName} (Waitlisted)` : 'Waitlisted';
    } else if (isWishlist) {
      bgColor = 'bg-amber-50 dark:bg-amber-900/30';
      borderStyle = 'border-l-2 border-l-amber-400 dark:border-l-amber-500';
      tooltip = campName ? `${campName} (Need to register)` : 'Need to register';
    } else {
      bgColor = 'bg-green-100 dark:bg-green-900/40';
      tooltip = campName || 'Covered';
    }
    if (status === 'partial') {
      tooltip = `Partial: ${tooltip}`;
    }
  } else {
    bgColor = 'bg-accent/10 dark:bg-accent/20';
    icon = '';
    tooltip = availableCount !== undefined
      ? `${availableCount} camp${availableCount === 1 ? '' : 's'} available`
      : 'Gap - needs camp';
  }

  // Status badge component for org logo overlay
  const StatusBadge = () => {
    if (!hasRegistration || hasEvent || status === 'school' || status === 'gap') return null;

    if (isRegistered) {
      return (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center border border-white dark:border-slate-800">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    }
    if (isWaitlisted) {
      return (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-yellow-500 rounded-full flex items-center justify-center border border-white dark:border-slate-800 text-[8px]">
          ⏳
        </span>
      );
    }
    if (isWishlist) {
      return (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white dark:border-slate-800" />
      );
    }
    return null;
  };

  const cellContent = (
    <div
      className={`w-full h-full min-h-[48px] flex flex-col items-center justify-center ${bgColor} ${borderStyle} ${
        isPastWeek ? 'opacity-50' : ''
      } ${isCurrentWeek ? 'ring-2 ring-primary ring-inset' : ''}`}
      title={tooltip}
    >
      {logoUrl ? (
        <div className="relative">
          <img
            src={logoUrl}
            alt={campName || ''}
            title={campName || 'Camp'}
            className="w-6 h-6 rounded object-contain"
          />
          <StatusBadge />
        </div>
      ) : hasEvent ? (
        <span className="text-base">{icon}</span>
      ) : status === 'school' ? (
        <span className="text-slate-400 dark:text-slate-500 text-sm">{icon}</span>
      ) : status === 'full' || status === 'partial' ? (
        <div className="relative">
          {isRegistered ? (
            <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
          ) : isWaitlisted ? (
            <span className="text-yellow-600 dark:text-yellow-400 text-sm">⏳</span>
          ) : isWishlist ? (
            <span className="text-amber-500 dark:text-amber-400 text-lg">○</span>
          ) : (
            <span className="text-green-600 dark:text-green-400 font-bold text-sm">✓</span>
          )}
        </div>
      ) : (
        <>
          {availableCount !== undefined && availableCount > 0 ? (
            <span className="text-accent-dark dark:text-accent text-sm font-semibold">{availableCount}</span>
          ) : (
            <span className="text-accent/50 dark:text-accent/60 text-lg">•</span>
          )}
        </>
      )}
    </div>
  );

  // Make gap cells clickable to find camps
  if (status === 'gap' && !isPastWeek) {
    const handleClick = () => {
      if (onGapClick) {
        onGapClick(week.week.startDate, week.week.endDate, childId);
      }
    };

    // If we have an onGapClick handler, use a button; otherwise use a Link
    if (onGapClick) {
      return (
        <td className={tdClass}>
          <button
            onClick={handleClick}
            className="block w-full h-full hover:bg-accent/20 dark:hover:bg-accent/30 transition-colors cursor-pointer"
          >
            {cellContent}
          </button>
        </td>
      );
    }

    return (
      <td className={tdClass}>
        <Link
          href={citySlug ? `/discover/${citySlug}?from=${week.week.startDate}&to=${week.week.endDate}&childId=${childId}${childGrade !== undefined ? `&grade=${childGrade}` : ''}` : `/planner/week/${week.week.startDate}`}
          className="block w-full h-full hover:bg-accent/20 dark:hover:bg-accent/30 transition-colors"
        >
          {cellContent}
        </Link>
      </td>
    );
  }

  // Make cells with registrations clickable
  if (hasRegistration && onRegistrationClick && data?.registrations?.[0]) {
    const reg = data.registrations[0];
    const handleRegistrationClick = () => {
      onRegistrationClick({
        registrationId: reg.registrationId,
        sessionId: reg.sessionId,
        childId,
        childName,
        campName: reg.campName,
        organizationName: reg.organizationName,
        organizationLogoUrl: reg.organizationLogoUrl,
        status: reg.status,
        weekLabel: `${week.week.monthName} ${week.week.label}`,
        registrationUrl: reg.registrationUrl,
      });
    };

    return (
      <td className={tdClass}>
        <button
          onClick={handleRegistrationClick}
          className="block w-full h-full hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors cursor-pointer"
        >
          {cellContent}
        </button>
      </td>
    );
  }

  // Make cells with events clickable
  if (hasEvent && onEventClick && data?.events?.[0]) {
    const evt = data.events[0];
    const handleEventClick = () => {
      onEventClick({
        eventId: evt.eventId,
        title: evt.title,
        childId,
        childName,
        weekLabel: `${week.week.monthName} ${week.week.label}`,
      });
    };

    return (
      <td className={tdClass}>
        <button
          onClick={handleEventClick}
          className="block w-full h-full hover:bg-surface/50 dark:hover:bg-surface-dark/50 transition-colors cursor-pointer"
        >
          {cellContent}
        </button>
      </td>
    );
  }

  return (
    <td className={tdClass}>
      {cellContent}
    </td>
  );
}
