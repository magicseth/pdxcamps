'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { CoverageStatus } from './CoverageIndicator';
import { DEFAULT_CHILD_COLORS } from '../../lib/constants';
import type { ChildCoverage, WeekData, RegistrationClickData, EventClickData, FriendCalendarData } from '../../lib/types';

export type { RegistrationClickData, EventClickData };

interface PlannerGridProps {
  coverage: WeekData[];
  children: {
    _id: Id<'children'>;
    firstName: string;
    birthdate?: string;
    currentGrade?: number;
    color?: string;
    shareToken?: string;
  }[];
  citySlug?: string;
  sessionCounts?: Record<string, Record<string, number>> | null; // { weekStart: { childId: count } }
  onGapClick?: (weekStart: string, weekEnd: string, childId: Id<'children'>) => void;
  onRegistrationClick?: (data: RegistrationClickData) => void;
  onEventClick?: (data: EventClickData) => void;
  onAddChild?: () => void;
  friendCalendars?: FriendCalendarData[];
  hiddenFriends?: Set<string>;
  onToggleFriend?: (familyId: string) => void;
}

type ViewMode = 'kids-rows' | 'weeks-rows';

const VIEW_MODE_KEY = 'planner-view-mode';

function RotateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      title="Rotate grid"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );
}

export function PlannerGrid({
  coverage,
  children,
  citySlug,
  sessionCounts,
  onGapClick,
  onRegistrationClick,
  onEventClick,
  onAddChild,
  friendCalendars,
  hiddenFriends,
  onToggleFriend,
}: PlannerGridProps) {
  const generateShareToken = useMutation(api.children.mutations.generateShareToken);
  const [generatingToken, setGeneratingToken] = useState<Id<'children'> | null>(null);
  const [copiedChildId, setCopiedChildId] = useState<Id<'children'> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kids-rows');

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'kids-rows' || stored === 'weeks-rows') {
      setViewMode(stored);
    }
  }, []);

  const toggleViewMode = () => {
    const next: ViewMode = viewMode === 'kids-rows' ? 'weeks-rows' : 'kids-rows';
    setViewMode(next);
    localStorage.setItem(VIEW_MODE_KEY, next);
  };

  const handleShareClick = async (childId: Id<'children'>, childName: string, existingToken?: string) => {
    let token = existingToken;
    if (!token) {
      setGeneratingToken(childId);
      try {
        token = (await generateShareToken({ childId })) || undefined;
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
        token = (await generateShareToken({ childId })) || undefined;
      } finally {
        setGeneratingToken(null);
      }
    }
    if (token) {
      const url = `${window.location.origin}/api/calendar/${token}`;
      navigator.clipboard.writeText(url);
      alert(
        `Calendar URL copied for ${childName}!\n\nTo add to Google Calendar:\n1. Open Google Calendar\n2. Click + next to "Other calendars"\n3. Select "From URL"\n4. Paste the copied URL`,
      );
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
    const childCov = week.childCoverage.find((c) => c.childId === childId);
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

  // Helper to render a child column header (used in weeks-rows view)
  const renderChildColumnHeader = (child: (typeof children)[number], childIndex: number, isMobile: boolean) => {
    const childColor = child.color || DEFAULT_CHILD_COLORS[childIndex % DEFAULT_CHILD_COLORS.length];
    const size = isMobile ? 'w-6 h-6' : 'w-7 h-7';
    const iconSize = isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4';
    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className={`${size} rounded-full flex items-center justify-center text-white text-xs font-bold`}
          style={{ backgroundColor: childColor }}
        >
          {child.firstName[0]}
        </span>
        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium text-slate-900 dark:text-white truncate max-w-[60px]`}>
          {child.firstName}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleShareClick(child._id, child.firstName, child.shareToken)}
            disabled={generatingToken === child._id}
            className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
            title={`Share ${child.firstName}'s schedule`}
          >
            {copiedChildId === child._id ? (
              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Copied!</span>
            ) : (
              <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            )}
          </button>
          {!isMobile && (
            <button
              onClick={() => handleCalendarClick(child._id, child.firstName, child.shareToken)}
              disabled={generatingToken === child._id}
              className="text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
              title={`Copy calendar URL for ${child.firstName}`}
            >
              <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  if (viewMode === 'weeks-rows') {
    return (
    <>
      <div className="md:bg-white md:dark:bg-slate-800 md:rounded-xl md:border md:border-slate-200 md:dark:border-slate-700 overflow-hidden md:shadow-sm">
        {/* Mobile weeks-rows layout */}
        <div className="md:hidden space-y-3">
          {weeksByMonth.map(([month, weeks], monthIndex) => (
            <div
              key={month}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
            >
              {/* Month header with toggle on first month */}
              <div className="px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900">
                {month}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[90px]"></th>
                      {children.map((child, childIndex) => (
                        <th
                          key={child._id}
                          className="px-2 py-2 text-center border-b border-l border-slate-200 dark:border-slate-700"
                        >
                          {renderChildColumnHeader(child, childIndex, true)}
                        </th>
                      ))}
                      {onAddChild && monthIndex === weeksByMonth.length - 1 && (
                        <th className="px-2 py-2 text-center border-b border-l border-slate-200 dark:border-slate-700">
                          <button
                            onClick={onAddChild}
                            className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary dark:hover:text-primary-light transition-colors mx-auto"
                          >
                            <span className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </span>
                            <span className="text-[10px] font-medium">Add</span>
                          </button>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week) => {
                      const current = isCurrentWeek(week);
                      const past = isPastWeek(week);
                      return (
                        <tr key={week.week.startDate} className={past ? 'opacity-50' : ''}>
                          <td
                            className={`sticky left-0 z-10 px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-700/50 ${
                              current
                                ? 'bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 font-bold'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            <div className="font-medium">{week.week.label.split(' ')[0]}</div>
                            <div className="text-[10px] opacity-70">{week.week.label.split(' ').slice(1).join(' ')}</div>
                          </td>
                          {children.map((child) => {
                            const cellData = getCellData(child._id, week);
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
                                isPastWeek={false}
                                citySlug={citySlug}
                                onGapClick={onGapClick}
                                onRegistrationClick={onRegistrationClick}
                                onEventClick={onEventClick}
                              />
                            );
                          })}
                          {onAddChild && monthIndex === weeksByMonth.length - 1 && (
                            <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
                              <div className="w-full min-h-[48px]" />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop weeks-rows layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900">
                <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700 min-w-[120px]"></th>
                {children.map((child, childIndex) => (
                  <th
                    key={child._id}
                    className="px-3 py-2 text-center border-b border-l border-slate-200 dark:border-slate-700 min-w-[80px]"
                  >
                    {renderChildColumnHeader(child, childIndex, false)}
                  </th>
                ))}
                {onAddChild && (
                  <th className="px-3 py-2 text-center border-b border-l border-slate-200 dark:border-slate-700">
                    <button
                      onClick={onAddChild}
                      className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary dark:hover:text-primary-light transition-colors mx-auto"
                    >
                      <span className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </span>
                      <span className="text-xs font-medium">Add Kid</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {weeksByMonth.map(([month, weeks]) => (
                <>
                  {/* Month separator row */}
                  <tr key={`month-${month}`} className="bg-slate-50 dark:bg-slate-800/50">
                    <td
                      colSpan={children.length + 1 + (onAddChild ? 1 : 0)}
                      className="sticky left-0 z-10 px-4 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
                    >
                      {month}
                    </td>
                  </tr>
                  {/* Week rows */}
                  {weeks.map((week) => {
                    const current = isCurrentWeek(week);
                    const past = isPastWeek(week);
                    return (
                      <tr
                        key={week.week.startDate}
                        className={`${past ? 'opacity-50' : ''} ${
                          current ? 'bg-primary/5 dark:bg-primary-dark/10' : 'bg-white dark:bg-slate-800'
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-10 px-4 py-2 text-xs border-b border-slate-100 dark:border-slate-700/50 ${
                            current
                              ? 'bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60 font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                          title={`${week.week.startDate} - ${week.week.endDate}`}
                        >
                          <div className="font-medium">{week.week.label.split(' ')[0]}</div>
                          <div className="text-[10px] opacity-70">{week.week.label.split(' ').slice(1).join(' ')}</div>
                        </td>
                        {children.map((child) => {
                          const cellData = getCellData(child._id, week);
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
                              isPastWeek={false}
                              citySlug={citySlug}
                              onGapClick={onGapClick}
                              onRegistrationClick={onRegistrationClick}
                              onEventClick={onEventClick}
                            />
                          );
                        })}
                        {onAddChild && (
                          <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
                            <div className="w-full min-h-[48px]" />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {friendCalendars && friendCalendars.length > 0 && hiddenFriends && onToggleFriend && (
        <FriendCalendarSection
          friendCalendars={friendCalendars}
          hiddenFriends={hiddenFriends}
          onToggleFriend={onToggleFriend}
          coverage={coverage}
          monthStartDates={monthStartDates}
          weeksByMonth={weeksByMonth}
          isCurrentWeek={isCurrentWeek}
          isPastWeek={isPastWeek}
          myChildren={children}
        />
      )}
    </>
    );
  }

  return (
    <>
    <div className="md:bg-white md:dark:bg-slate-800 md:rounded-xl md:border md:border-slate-200 md:dark:border-slate-700 overflow-hidden md:shadow-sm">
      {/* Mobile layout: months stacked vertically */}
      <div className="md:hidden space-y-3">
        {weeksByMonth.map(([month, weeks], monthIndex) => (
          <div
            key={month}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm"
          >
            {/* Month header */}
            <div className="px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900">
              {month}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[90px]"></th>
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
                        className={
                          childIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'
                        }
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
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                  />
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
              <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 min-w-[120px]"></th>
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
              <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"></th>
              {coverage.map((week) => {
                const current = isCurrentWeek(week);
                const past = isPastWeek(week);
                const isMonthStart = monthStartDates.has(week.week.startDate);
                return (
                  <th
                    key={week.week.startDate}
                    className={`px-1 py-1.5 text-center text-xs border-b border-slate-200 dark:border-slate-700 ${
                      isMonthStart
                        ? 'border-l border-l-slate-300 dark:border-l-slate-600'
                        : 'border-l border-l-slate-200 dark:border-l-slate-700'
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
                  className={
                    childIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'
                  }
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
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                            />
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
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
                      monthStartDates.has(week.week.startDate)
                        ? 'border-l border-l-slate-300 dark:border-l-slate-600'
                        : 'border-l border-l-slate-100 dark:border-l-slate-700/50'
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
    {friendCalendars && friendCalendars.length > 0 && hiddenFriends && onToggleFriend && (
      <FriendCalendarSection
        friendCalendars={friendCalendars}
        hiddenFriends={hiddenFriends}
        onToggleFriend={onToggleFriend}
        coverage={coverage}
        monthStartDates={monthStartDates}
        weeksByMonth={weeksByMonth}
        isCurrentWeek={isCurrentWeek}
        isPastWeek={isPastWeek}
        myChildren={children}
      />
    )}
    </>
  );
}

// Eye icon for show/hide toggle
function EyeIcon({ isHidden }: { isHidden: boolean }) {
  if (isHidden) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// Friend calendar section rendered below the main grid
function FriendCalendarSection({
  friendCalendars,
  hiddenFriends,
  onToggleFriend,
  coverage,
  monthStartDates,
  weeksByMonth,
  isCurrentWeek,
  isPastWeek,
  myChildren,
}: {
  friendCalendars: FriendCalendarData[];
  hiddenFriends: Set<string>;
  onToggleFriend: (familyId: string) => void;
  coverage: WeekData[];
  monthStartDates: Set<string>;
  weeksByMonth: [string, WeekData[]][];
  isCurrentWeek: (week: WeekData) => boolean;
  isPastWeek: (week: WeekData) => boolean;
  myChildren: {
    _id: Id<'children'>;
    firstName: string;
    birthdate?: string;
    currentGrade?: number;
    color?: string;
  }[];
}) {
  const [selectedFriendCamp, setSelectedFriendCamp] = useState<{
    registration: ChildCoverage['registrations'][0];
    friendName: string;
    cellRect: { top: number; left: number; width: number; height: number };
  } | null>(null);

  if (friendCalendars.length === 0) return null;

  const handleFriendCellClick = (
    data: ChildCoverage | null,
    friendName: string,
    e: React.MouseEvent,
  ) => {
    if (!data || data.registrations.length === 0) return;
    const reg = data.registrations[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedFriendCamp({
      registration: reg,
      friendName,
      cellRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    });
  };

  return (
    <>
      {/* Divider */}
      <div className="flex items-center gap-3 my-4 px-2">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Friends&apos; Plans
        </span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      {friendCalendars.map((friend) => {
        const isHidden = hiddenFriends.has(friend.familyId);
        return (
          <div
            key={friend.familyId}
            className="md:bg-white/60 md:dark:bg-slate-800/60 md:rounded-xl md:border md:border-slate-200 md:dark:border-slate-700 overflow-hidden md:shadow-sm mb-3 opacity-75"
          >
            {/* Friend header with toggle */}
            <button
              onClick={() => onToggleFriend(friend.familyId)}
              className="w-full flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
                {friend.displayName[0]}
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 text-left">
                {friend.displayName}
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                <EyeIcon isHidden={isHidden} />
              </span>
            </button>

            {/* Friend's children rows - only shown when not hidden */}
            {!isHidden && (
              <>
                {/* Mobile layout */}
                <div className="md:hidden space-y-0">
                  {weeksByMonth.map(([month, weeks]) => {
                    const friendWeeksForMonth = weeks.map((week) => {
                      return friend.coverage.find((fw) => fw.week.startDate === week.week.startDate);
                    });
                    return (
                      <div key={month}>
                        <div className="px-4 py-1.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                          {month}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800/50">
                                <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[90px]" />
                                {weeks.map((week) => (
                                  <th
                                    key={week.week.startDate}
                                    className="px-1 py-1 text-center text-[10px] border-b border-l border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                  >
                                    {week.week.label.split(' ')[0]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {friend.children.map((child, ci) => (
                                <tr
                                  key={child.childId}
                                  className={ci % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}
                                >
                                  <td className="sticky left-0 z-10 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 bg-inherit">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                        {child.childName[0]}
                                      </span>
                                      <span className="truncate text-xs">{child.childName}</span>
                                    </div>
                                  </td>
                                  {friendWeeksForMonth.map((friendWeek, wi) => {
                                    const weekKey = weeks[wi].week.startDate;
                                    const childCov = friendWeek?.childCoverage.find(
                                      (c) => c.childId === child.childId,
                                    );
                                    const hasCamp = childCov && childCov.registrations.length > 0;
                                    return (
                                      <td
                                        key={weekKey}
                                        className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0"
                                      >
                                        {hasCamp ? (
                                          <button
                                            className="w-full h-full cursor-pointer hover:ring-2 hover:ring-primary/50 hover:ring-inset transition-all"
                                            onClick={(e) => handleFriendCellClick(childCov, friend.displayName, e)}
                                          >
                                            <FriendCoverageCell data={childCov ?? null} />
                                          </button>
                                        ) : (
                                          <FriendCoverageCell data={childCov ?? null} />
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    {/* Visible month + week headers matching the main grid */}
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-900/80">
                        <th className="sticky left-0 z-10 bg-slate-100/80 dark:bg-slate-900/80 px-4 py-1.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 min-w-[120px]" />
                        {weeksByMonth.map(([month, weeks]) => (
                          <th
                            key={month}
                            colSpan={weeks.length}
                            className="px-2 py-1.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-l border-slate-200 dark:border-slate-700"
                          >
                            {month}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                        <th className="sticky left-0 z-10 bg-slate-50/80 dark:bg-slate-800/50 px-4 py-1 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[120px]" />
                        {coverage.map((week) => {
                          const current = isCurrentWeek(week);
                          const past = isPastWeek(week);
                          const isMonthStart = monthStartDates.has(week.week.startDate);
                          return (
                            <th
                              key={week.week.startDate}
                              className={`px-1 py-1 text-center text-[10px] border-b border-slate-200 dark:border-slate-700 min-w-[48px] ${
                                isMonthStart
                                  ? 'border-l border-l-slate-300 dark:border-l-slate-600'
                                  : 'border-l border-l-slate-200 dark:border-l-slate-700'
                              } ${
                                current
                                  ? 'bg-primary/15 dark:bg-primary-dark/25 text-primary-dark dark:text-white/60 font-bold'
                                  : past
                                    ? 'text-slate-400 dark:text-slate-500'
                                    : 'text-slate-500 dark:text-slate-400'
                              }`}
                              title={`${week.week.startDate} - ${week.week.endDate}`}
                            >
                              {week.week.label.split(' ')[0]}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {friend.children.map((child, ci) => (
                        <tr
                          key={child.childId}
                          className={ci % 2 === 0 ? 'bg-white/60 dark:bg-slate-800/60' : 'bg-slate-50/30 dark:bg-slate-800/30'}
                        >
                          <td className="sticky left-0 z-10 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 bg-inherit min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
                                {child.childName[0]}
                              </span>
                              <span>{child.childName}</span>
                            </div>
                          </td>
                          {coverage.map((week) => {
                            const friendWeek = friend.coverage.find(
                              (fw) => fw.week.startDate === week.week.startDate,
                            );
                            const childCov = friendWeek?.childCoverage.find(
                              (c) => c.childId === child.childId,
                            );
                            const isMonthStart = monthStartDates.has(week.week.startDate);
                            const hasCamp = childCov && childCov.registrations.length > 0;
                            return (
                              <td
                                key={week.week.startDate}
                                className={`border-b border-slate-100 dark:border-slate-700/50 p-0 min-w-[48px] ${
                                  isMonthStart
                                    ? 'border-l border-l-slate-300 dark:border-l-slate-600'
                                    : 'border-l border-l-slate-100 dark:border-l-slate-700/50'
                                }`}
                              >
                                {hasCamp ? (
                                  <button
                                    className="w-full h-full cursor-pointer hover:ring-2 hover:ring-primary/50 hover:ring-inset transition-all"
                                    onClick={(e) => handleFriendCellClick(childCov, friend.displayName, e)}
                                  >
                                    <FriendCoverageCell data={childCov ?? null} />
                                  </button>
                                ) : (
                                  <FriendCoverageCell data={childCov ?? null} />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Friend camp detail popover */}
      {selectedFriendCamp && (
        <FriendCampPopover
          registration={selectedFriendCamp.registration}
          friendName={selectedFriendCamp.friendName}
          myChildren={myChildren}
          onClose={() => setSelectedFriendCamp(null)}
        />
      )}
    </>
  );
}

// Popover showing friend's camp details with quick-add for own children
function FriendCampPopover({
  registration,
  friendName,
  myChildren,
  onClose,
}: {
  registration: ChildCoverage['registrations'][0];
  friendName: string;
  myChildren: {
    _id: Id<'children'>;
    firstName: string;
    birthdate?: string;
    currentGrade?: number;
    color?: string;
  }[];
  onClose: () => void;
}) {
  const markInterested = useMutation(api.registrations.mutations.markInterested);
  const [savingChildId, setSavingChildId] = useState<Id<'children'> | null>(null);
  const [savedChildIds, setSavedChildIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const checkEligibility = (child: { birthdate?: string; currentGrade?: number }): { eligible: boolean; reason?: string } => {
    if (!child.birthdate) return { eligible: true };
    const birthDate = new Date(child.birthdate);
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age--;

    if (registration.minAge != null && age < registration.minAge) {
      return { eligible: false, reason: `Too young (${age}y, needs ${registration.minAge}+)` };
    }
    if (registration.maxAge != null && age > registration.maxAge) {
      return { eligible: false, reason: `Too old (${age}y, max ${registration.maxAge})` };
    }
    if (child.currentGrade !== undefined) {
      if (registration.minGrade != null && child.currentGrade < registration.minGrade) {
        return { eligible: false, reason: `Grade too low` };
      }
      if (registration.maxGrade != null && child.currentGrade > registration.maxGrade) {
        return { eligible: false, reason: `Grade too high` };
      }
    }
    return { eligible: true };
  };

  const handleSave = async (childId: Id<'children'>) => {
    setSavingChildId(childId);
    setError(null);
    try {
      await markInterested({
        childId,
        sessionId: registration.sessionId as Id<'sessions'>,
        notes: `Saving to go with ${friendName}'s kid`,
      });
      setSavedChildIds((prev) => new Set([...prev, childId]));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      if (msg.includes('PAYWALL') || msg.includes('already')) {
        setError(msg.includes('PAYWALL') ? 'Upgrade to save more camps' : 'Already saved');
      } else {
        setError(msg);
      }
    } finally {
      setSavingChildId(null);
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `$${price}`;
  };

  const formatDates = (start?: string, end?: string) => {
    if (!start || !end) return null;
    try {
      const s = new Date(start + 'T12:00:00');
      const e = new Date(end + 'T12:00:00');
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      if (s.getMonth() === e.getMonth()) {
        return `${s.toLocaleDateString('en-US', opts)} - ${e.getDate()}`;
      }
      return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-sm w-full p-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
              {registration.campName}
            </h3>
            {registration.organizationName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {registration.organizationName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-4">
          {registration.locationName && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{registration.locationName}</span>
            </div>
          )}
          {registration.price != null && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatPrice(registration.price)}</span>
            </div>
          )}
          {formatDates(registration.startDate, registration.endDate) && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDates(registration.startDate, registration.endDate)}</span>
            </div>
          )}
        </div>

        {/* Save for my kids */}
        {myChildren.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Save for your kids
            </p>
            <div className="space-y-1.5">
              {myChildren.map((child) => {
                const { eligible, reason } = checkEligibility(child);
                const isSaved = savedChildIds.has(child._id);
                const isSaving = savingChildId === child._id;

                return (
                  <div
                    key={child._id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: child.color || '#94a3b8' }}
                      >
                        {child.firstName[0]}
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {child.firstName}
                      </span>
                    </div>
                    {isSaved ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Saved
                      </span>
                    ) : !eligible ? (
                      <span className="text-[11px] text-slate-400">{reason}</span>
                    ) : (
                      <button
                        onClick={() => handleSave(child._id)}
                        disabled={isSaving}
                        className="text-xs font-medium px-3 py-1 rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? '...' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

// Simplified read-only cell for friend calendars
function FriendCoverageCell({ data }: { data: ChildCoverage | null }) {
  const status = data?.status || 'gap';
  const logoUrl = data?.registrations?.[0]?.organizationLogoUrl;
  const campName = data?.registrations?.[0]?.campName;
  const registrationStatus = data?.registrations?.[0]?.status;

  let bgColor = '';
  let tooltip = '';

  if (status === 'full' || status === 'partial') {
    if (registrationStatus === 'registered') {
      bgColor = 'bg-green-100/70 dark:bg-green-900/20';
      tooltip = campName ? `${campName} (Registered)` : 'Registered';
    } else if (registrationStatus === 'waitlisted') {
      bgColor = 'bg-yellow-100/70 dark:bg-yellow-900/20';
      tooltip = campName ? `${campName} (Waitlisted)` : 'Waitlisted';
    } else if (registrationStatus === 'interested') {
      bgColor = 'bg-amber-50/70 dark:bg-amber-900/15';
      tooltip = campName ? `${campName} (Saved)` : 'Saved';
    } else {
      bgColor = 'bg-green-100/70 dark:bg-green-900/20';
      tooltip = campName || 'Covered';
    }
  } else {
    bgColor = '';
    tooltip = 'No camp';
  }

  return (
    <div className={`w-full min-h-[40px] flex items-center justify-center ${bgColor}`} title={tooltip}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={campName || ''}
          className="w-5 h-5 rounded object-contain opacity-70"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (status === 'full' || status === 'partial') ? (
        registrationStatus === 'registered' ? (
          <span className="text-green-600/60 dark:text-green-400/60 font-bold text-xs">✓</span>
        ) : registrationStatus === 'waitlisted' ? (
          <span className="text-yellow-600/60 dark:text-yellow-400/60 text-xs">⏳</span>
        ) : registrationStatus === 'interested' ? (
          <span className="text-amber-500/60 dark:text-amber-400/60 text-sm">○</span>
        ) : (
          <span className="text-green-600/60 dark:text-green-400/60 font-bold text-xs">✓</span>
        )
      ) : null}
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

function CoverageCell({
  data,
  week,
  childId,
  childName,
  childGrade,
  availableSessionCount,
  isCurrentWeek,
  isPastWeek,
  isMonthStart,
  citySlug,
  onGapClick,
  onRegistrationClick,
  onEventClick,
}: CoverageCellProps) {
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
    isMonthStart
      ? 'border-l border-l-slate-300 dark:border-l-slate-600'
      : 'border-l border-l-slate-100 dark:border-l-slate-700/50'
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
    tooltip =
      availableCount !== undefined
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
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
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
            data-tutorial="gap"
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
          data-tutorial="gap"
          href={
            citySlug
              ? `/discover/${citySlug}?from=${week.week.startDate}&to=${week.week.endDate}&childId=${childId}${childGrade !== undefined ? `&grade=${childGrade}` : ''}`
              : `/planner/week/${week.week.startDate}`
          }
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

  return <td className={tdClass}>{cellContent}</td>;
}
