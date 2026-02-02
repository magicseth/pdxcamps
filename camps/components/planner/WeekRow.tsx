'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CoverageChip, CoverageStatus } from './CoverageIndicator';
import { Id } from '../../convex/_generated/dataModel';

interface ChildCoverage {
  childId: Id<'children'>;
  childName: string;
  status: CoverageStatus;
  coveredDays: number;
  registrations: {
    registrationId: string;
    campName: string;
    organizationLogoUrl?: string | null;
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

interface WeekRowProps {
  data: WeekData;
  isFirstOfMonth?: boolean;
}

export function WeekRow({ data, isFirstOfMonth = false }: WeekRowProps) {
  const { week, childCoverage, hasGap } = data;
  const rowRef = useRef<HTMLDivElement>(null);

  // Find if there's a shared family event (same event for all children)
  const sharedEvent = findSharedEvent(childCoverage);

  // Check if this is the current week or a past week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(week.startDate + 'T00:00:00');
  const weekEnd = new Date(week.endDate + 'T23:59:59');
  const isCurrentWeek = today >= weekStart && today <= weekEnd;
  const isPastWeek = today > weekEnd;

  // Count children with gaps
  const childrenWithGaps = childCoverage.filter((c) => c.status === 'gap').length;

  // Auto-scroll to current week on mount
  useEffect(() => {
    if (isCurrentWeek && rowRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        rowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [isCurrentWeek]);

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 hover:shadow-sm cursor-pointer ${
        isFirstOfMonth ? 'border-t border-slate-200 dark:border-slate-700' : ''
      } ${isCurrentWeek ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''} ${
        isPastWeek ? 'opacity-50 hover:opacity-70' : ''
      }`}
    >
      {/* Week info */}
      <div
        className="w-20 flex-shrink-0"
        title={`${week.startDate} to ${week.endDate}`}
      >
        <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1">
          Week {week.weekNumber}
          {isCurrentWeek && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded animate-pulse">
              NOW
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{week.label}</div>
      </div>

      {/* Coverage indicators */}
      <div className="flex-1 flex flex-wrap gap-2">
        {sharedEvent ? (
          // Show single event badge for shared events
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-sm"
            title={sharedEvent.title}
          >
            <span>✈</span>
            <span className="font-medium">All</span>
            <span className="text-purple-600 dark:text-purple-300 truncate max-w-[150px]">
              {sharedEvent.title}
            </span>
          </span>
        ) : (
          // Show individual child coverage
          childCoverage.map((child) => {
            const eventTitle = child.events[0]?.title;
            const firstReg = child.registrations?.[0];
            return (
              <CoverageChip
                key={child.childId}
                status={child.status}
                childName={child.childName}
                eventTitle={eventTitle}
                campName={firstReg?.campName}
                organizationLogoUrl={firstReg?.organizationLogoUrl}
              />
            );
          })
        )}
      </div>

      {/* Gap indicator / Find camps link */}
      {hasGap ? (
        <Link
          href={`/planner/week/${week.startDate}`}
          className="flex-shrink-0 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline animate-pulse motion-reduce:animate-none"
          title={`Find camps for ${week.label} (${week.startDate} to ${week.endDate})`}
        >
          {childrenWithGaps > 1 ? `${childrenWithGaps} need camps` : 'Find camps'} →
        </Link>
      ) : (
        <Link
          href={`/planner/week/${week.startDate}`}
          className="flex-shrink-0 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
          aria-label={`View week ${week.weekNumber} details`}
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

function findSharedEvent(childCoverage: ChildCoverage[]): { title: string } | null {
  if (childCoverage.length < 2) return null;

  // Check if all children have the same event
  const firstChildEvents = childCoverage[0]?.events ?? [];
  if (firstChildEvents.length === 0) return null;

  const sharedEventId = firstChildEvents[0]?.eventId;
  if (!sharedEventId) return null;

  const allHaveSameEvent = childCoverage.every((child) =>
    child.events.some((e) => e.eventId === sharedEventId)
  );

  if (allHaveSameEvent) {
    return { title: firstChildEvents[0].title };
  }

  return null;
}

interface MonthHeaderProps {
  monthName: string;
}

export function MonthHeader({ monthName }: MonthHeaderProps) {
  return (
    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
        {monthName}
      </h3>
    </div>
  );
}
