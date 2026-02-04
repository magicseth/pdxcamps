'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Id } from '../../convex/_generated/dataModel';
import { CoverageStatus } from './CoverageIndicator';

interface ChildCoverage {
  childId: Id<'children'>;
  childName: string;
  status: CoverageStatus;
  coveredDays: number;
  availableSessionCount?: number;
  registrations: {
    registrationId: string;
    sessionId: string;
    campName: string;
    organizationName?: string;
    organizationLogoUrl?: string | null;
    status: string;
    registrationUrl?: string | null;
  }[];
  events: {
    eventId: Id<'familyEvents'>;
    title: string;
  }[];
}

interface WeekData {
  week: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    monthName: string;
    label: string;
  };
  childCoverage: ChildCoverage[];
  hasGap: boolean;
  hasFamilyEvent: boolean;
}

export interface RegistrationClickData {
  registrationId: string;
  sessionId: string;
  childId: Id<'children'>;
  childName: string;
  campName: string;
  organizationName?: string;
  organizationLogoUrl?: string | null;
  status: string;
  weekLabel: string;
  registrationUrl?: string | null;
}

export interface EventClickData {
  eventId: Id<'familyEvents'>;
  title: string;
  childId: Id<'children'>;
  childName: string;
  weekLabel: string;
}

interface PlannerGridProps {
  coverage: WeekData[];
  children: { _id: Id<'children'>; firstName: string; birthdate?: string; currentGrade?: number }[];
  citySlug?: string;
  onGapClick?: (weekStart: string, weekEnd: string, childId: Id<'children'>) => void;
  onRegistrationClick?: (data: RegistrationClickData) => void;
  onEventClick?: (data: EventClickData) => void;
  onAddChild?: () => void;
}

export function PlannerGrid({ coverage, children, citySlug, onGapClick, onRegistrationClick, onEventClick, onAddChild }: PlannerGridProps) {
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
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
            {children.map((child, childIndex) => (
              <tr
                key={child._id}
                className={childIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}
              >
                {/* Child name - sticky left column */}
                <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700/50 bg-inherit">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-surface-dark flex items-center justify-center text-white text-xs font-bold">
                      {child.firstName[0]}
                    </span>
                    {child.firstName}
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
            ))}
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
  );
}

interface CoverageCellProps {
  data: ChildCoverage | null;
  week: WeekData;
  childId: Id<'children'>;
  childName: string;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  citySlug?: string;
  onGapClick?: (weekStart: string, weekEnd: string, childId: Id<'children'>) => void;
  onRegistrationClick?: (data: RegistrationClickData) => void;
  onEventClick?: (data: EventClickData) => void;
}

function CoverageCell({ data, week, childId, childName, isCurrentWeek, isPastWeek, citySlug, onGapClick, onRegistrationClick, onEventClick }: CoverageCellProps) {
  const status = data?.status || 'gap';
  const hasEvent = data?.events && data.events.length > 0;
  const hasRegistration = data?.registrations && data.registrations.length > 0;
  const campName = data?.registrations?.[0]?.campName;
  const eventTitle = data?.events?.[0]?.title;
  const logoUrl = data?.registrations?.[0]?.organizationLogoUrl;
  const availableCount = data?.availableSessionCount;

  // Determine cell appearance
  let bgColor = '';
  let icon = '';
  let tooltip = '';

  if (hasEvent) {
    bgColor = 'bg-surface/30 dark:bg-surface-dark/40';
    icon = '✈️';
    tooltip = eventTitle || 'Family Event';
  } else if (status === 'full') {
    bgColor = 'bg-green-100 dark:bg-green-900/40';
    icon = '✓';
    tooltip = campName || 'Covered';
  } else if (status === 'partial') {
    bgColor = 'bg-accent/20 dark:bg-accent/30';
    icon = '◐';
    tooltip = campName ? `Partial: ${campName}` : 'Partial coverage';
  } else {
    bgColor = 'bg-accent/10 dark:bg-accent/20';
    icon = '';
    tooltip = availableCount !== undefined
      ? `${availableCount} camp${availableCount === 1 ? '' : 's'} available`
      : 'Gap - needs camp';
  }

  const cellContent = (
    <div
      className={`w-full h-full min-h-[48px] flex flex-col items-center justify-center ${bgColor} ${
        isPastWeek ? 'opacity-50' : ''
      } ${isCurrentWeek ? 'ring-2 ring-primary ring-inset' : ''}`}
      title={tooltip}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={campName || ''}
          title={campName || 'Camp'}
          className="w-6 h-6 rounded object-contain"
        />
      ) : hasEvent ? (
        <span className="text-base">{icon}</span>
      ) : status === 'full' ? (
        <span className="text-green-600 dark:text-green-400 font-bold text-sm">{icon}</span>
      ) : status === 'partial' ? (
        <span className="text-accent-dark dark:text-accent text-sm">{icon}</span>
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
        <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
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
      <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
        <Link
          href={citySlug ? `/discover/${citySlug}?from=${week.week.startDate}&to=${week.week.endDate}` : `/planner/week/${week.week.startDate}`}
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
      <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
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
      <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
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
    <td className="border-b border-l border-slate-100 dark:border-slate-700/50 p-0">
      {cellContent}
    </td>
  );
}
