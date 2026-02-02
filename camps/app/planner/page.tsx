'use client';

import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { WeekRow, MonthHeader } from '../../components/planner/WeekRow';
import { CoverageLegend } from '../../components/planner/CoverageIndicator';
import { AddEventModal } from '../../components/planner/AddEventModal';

export default function PlannerPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/" className="font-semibold hover:underline">
          PDX Camps
        </Link>
        <h1 className="text-lg font-semibold">Summer Planner</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <PlannerContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">
              Please sign in to view your summer planner.
            </p>
            <a href="/sign-in">
              <button className="bg-foreground text-background px-6 py-2 rounded-md">
                Sign in
              </button>
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function PlannerContent() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | 'all'>('all');
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Fetch children
  const children = useQuery(api.children.queries.listChildren);

  // Fetch summer coverage
  const coverage = useQuery(api.planner.queries.getSummerCoverage, {
    year: selectedYear,
  });

  // Filter coverage by selected child
  const filteredCoverage = useMemo(() => {
    if (!coverage) return [];
    if (selectedChildId === 'all') return coverage;

    return coverage.map((week) => ({
      ...week,
      childCoverage: week.childCoverage.filter((c) => c.childId === selectedChildId),
      hasGap: week.childCoverage
        .filter((c) => c.childId === selectedChildId)
        .some((c) => c.status === 'gap'),
    }));
  }, [coverage, selectedChildId]);

  // Group coverage by month
  const coverageByMonth = useMemo(() => {
    const groups: Map<string, typeof filteredCoverage> = new Map();

    for (const week of filteredCoverage) {
      const month = week.week.monthName;
      if (!groups.has(month)) {
        groups.set(month, []);
      }
      groups.get(month)!.push(week);
    }

    return Array.from(groups.entries());
  }, [filteredCoverage]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!coverage || !children) return null;

    const totalWeeks = coverage.length;
    const weeksWithGaps = coverage.filter((w) => w.hasGap).length;
    const fullyPlannedWeeks = coverage.filter(
      (w) => w.childCoverage.every((c) => c.status === 'full' || c.status === 'event')
    ).length;

    return {
      totalWeeks,
      weeksWithGaps,
      fullyPlannedWeeks,
      coverage: Math.round((fullyPlannedWeeks / totalWeeks) * 100),
    };
  }, [coverage, children]);

  // Loading state
  if (coverage === undefined || children === undefined) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No children state
  if (children.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
        <h2 className="text-xl font-semibold mb-2">No children added yet</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Add your children to start planning their summer.
        </p>
        <Link
          href="/onboarding/children"
          className="inline-block bg-foreground text-background px-6 py-2 rounded-md font-medium hover:opacity-90"
        >
          Add Children
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Summer {selectedYear}
          </h2>
          {stats && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {stats.fullyPlannedWeeks} of {stats.totalWeeks} weeks planned ({stats.coverage}%)
              {stats.weeksWithGaps > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {' '}&bull; {stats.weeksWithGaps} weeks need coverage
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {/* Child filter */}
          {children.length > 1 && (
            <select
              value={selectedChildId}
              onChange={(e) =>
                setSelectedChildId(e.target.value as Id<'children'> | 'all')
              }
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="all">All Children</option>
              {children.map((child) => (
                <option key={child._id} value={child._id}>
                  {child.firstName}
                </option>
              ))}
            </select>
          )}

          {/* Add Event button */}
          <button
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            <PlusIcon />
            Add Event
          </button>
        </div>
      </div>

      {/* Legend */}
      <CoverageLegend />

      {/* Coverage Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {coverageByMonth.map(([month, weeks]) => (
          <div key={month}>
            <MonthHeader monthName={month} />
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {weeks.map((week, index) => (
                <WeekRow key={week.week.startDate} data={week} isFirstOfMonth={index === 0} />
              ))}
            </div>
          </div>
        ))}

        {filteredCoverage.length === 0 && (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No weeks found for summer {selectedYear}.
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/calendar"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          <CalendarIcon />
          View Calendar
        </Link>
        <Link
          href="/discover/portland"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          <SearchIcon />
          Discover Camps
        </Link>
      </div>

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        defaultChildIds={children.map((c) => c._id)}
      />
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
