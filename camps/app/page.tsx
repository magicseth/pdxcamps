'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Authenticated, Unauthenticated, useQuery, useMutation } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import type { User } from '@workos-inc/node';
import { WeekRow, MonthHeader } from '../components/planner/WeekRow';
import { CoverageLegend } from '../components/planner/CoverageIndicator';
import { AddEventModal } from '../components/planner/AddEventModal';
import { BottomNav } from '../components/shared/BottomNav';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Authenticated>
        <AuthenticatedHub user={user} onSignOut={signOut} />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </div>
  );
}

// Landing page for unauthenticated users
function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="font-bold text-xl">PDX Camps</span>
          </div>
          <div className="flex gap-3">
            <a href="/sign-in">
              <button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900">
                Sign in
              </button>
            </a>
            <a href="/sign-up">
              <button className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Get Started
              </button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
            Plan your kids' <span className="text-blue-600">summer</span> with confidence
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            Discover camps, track coverage week-by-week, coordinate with friends, and never worry about gaps in your summer schedule again.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/sign-up">
              <button className="px-8 py-3 text-lg font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/25">
                Start Planning Free
              </button>
            </a>
            <a href="/discover/portland">
              <button className="px-8 py-3 text-lg font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                Browse Camps
              </button>
            </a>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📅</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Week-by-Week Planning</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">See your whole summer at a glance. Instantly spot coverage gaps.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔍</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Smart Discovery</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Filter by age, category, price, and dates. Find the perfect camp.</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👨‍👩‍👧‍👦</span>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Family Coordination</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Add vacations, track multiple kids, share plans with friends.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Main authenticated hub - the summer planner
function AuthenticatedHub({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const family = useQuery(api.families.queries.getCurrentFamily);
  const children = useQuery(api.children.queries.listChildren);
  const cities = useQuery(api.cities.queries.listActiveCities);

  // If family setup is incomplete, show onboarding prompt
  if (family === undefined || children === undefined) {
    return <LoadingState />;
  }

  if (!family || children.length === 0) {
    return <OnboardingPrompt user={user} onSignOut={onSignOut} hasFamily={!!family} />;
  }

  return <PlannerHub user={user} onSignOut={onSignOut} children={children} cities={cities || []} />;
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-full"></div>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    </div>
  );
}

function OnboardingPrompt({ user, onSignOut, hasFamily }: { user: User | null; onSignOut: () => void; hasFamily: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={user} onSignOut={onSignOut} />
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            {hasFamily ? "Add your children" : "Welcome! Let's get started"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {hasFamily
              ? "Add your children to start planning their summer camps."
              : "Set up your family profile to discover and plan summer camps."
            }
          </p>
          <Link
            href={hasFamily ? "/onboarding/children" : "/onboarding"}
            className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            {hasFamily ? "Add Children" : "Complete Setup"}
          </Link>
        </div>
      </main>
    </div>
  );
}

// The main planner hub
function PlannerHub({
  user,
  onSignOut,
  children,
  cities
}: {
  user: User | null;
  onSignOut: () => void;
  children: { _id: Id<'children'>; firstName: string; lastName?: string }[];
  cities: { _id: Id<'cities'>; slug: string; name: string }[];
}) {
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const yearParam = searchParams.get('year');
    return yearParam ? parseInt(yearParam) : currentYear;
  });
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | 'all'>(() => {
    const childParam = searchParams.get('child');
    return childParam && childParam !== 'all' ? childParam as Id<'children'> : 'all';
  });
  const [showOnlyGaps, setShowOnlyGaps] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedYear !== currentYear) params.set('year', selectedYear.toString());
    if (selectedChildId !== 'all') params.set('child', selectedChildId);
    const queryString = params.toString();
    router.replace(`/${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [selectedYear, selectedChildId, currentYear, router]);

  // Keyboard shortcut: 'e' to add event, 'g' to toggle gaps filter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if ((e.key === 'e' || e.key === 'E') && !showAddEventModal) {
        e.preventDefault();
        setShowAddEventModal(true);
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowOnlyGaps((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddEventModal]);

  // Fetch summer coverage
  const coverage = useQuery(api.planner.queries.getSummerCoverage, {
    year: selectedYear,
  });

  // Filter coverage by selected child and gaps filter
  const filteredCoverage = useMemo(() => {
    if (!coverage) return [];
    let result = coverage;

    // Filter by child
    if (selectedChildId !== 'all') {
      result = result.map((week) => ({
        ...week,
        childCoverage: week.childCoverage.filter((c) => c.childId === selectedChildId),
        hasGap: week.childCoverage
          .filter((c) => c.childId === selectedChildId)
          .some((c) => c.status === 'gap'),
      }));
    }

    // Filter to only show weeks with gaps
    if (showOnlyGaps) {
      result = result.filter((week) => week.hasGap);
    }

    return result;
  }, [coverage, selectedChildId, showOnlyGaps]);

  // Group coverage by month
  const coverageByMonth = useMemo(() => {
    const groups: Map<string, typeof filteredCoverage> = new Map();
    for (const week of filteredCoverage) {
      const month = week.week.monthName;
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(week);
    }
    return Array.from(groups.entries());
  }, [filteredCoverage]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!coverage) return null;
    const totalWeeks = coverage.length;
    const weeksWithGaps = coverage.filter((w) => w.hasGap).length;
    const fullyPlannedWeeks = coverage.filter(
      (w) => w.childCoverage.every((c) => c.status === 'full' || c.status === 'event')
    ).length;

    // Count unique registrations (registered status)
    const registeredSessionIds = new Set<string>();
    const interestedSessionIds = new Set<string>();
    let totalGaps = 0;
    for (const week of coverage) {
      for (const child of week.childCoverage) {
        if (child.status === 'gap') {
          totalGaps++;
        }
        for (const reg of child.registrations) {
          if (reg.status === 'registered') {
            registeredSessionIds.add(reg.sessionId);
          } else if (reg.status === 'interested' || reg.status === 'waitlisted') {
            interestedSessionIds.add(reg.sessionId);
          }
        }
      }
    }

    return {
      totalWeeks,
      weeksWithGaps,
      fullyPlannedWeeks,
      coverage: totalWeeks > 0 ? Math.round((fullyPlannedWeeks / totalWeeks) * 100) : 0,
      registeredCount: registeredSessionIds.size,
      savedCount: interestedSessionIds.size,
      totalGaps,
    };
  }, [coverage]);

  const defaultCity = cities.find(c => c.slug === 'portland') || cities[0];

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader user={user} onSignOut={onSignOut} />

      <main className="flex-1 pb-20">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Hero Stats Section */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Summer {selectedYear}</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedYear((y) => y - 1)}
                  disabled={selectedYear <= currentYear - 1}
                  className="p-1.5 bg-white/20 border border-white/30 rounded-lg text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous year"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white text-sm backdrop-blur-sm"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                    <option key={year} value={year} className="text-slate-900">
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedYear((y) => y + 1)}
                  disabled={selectedYear >= currentYear + 1}
                  className="p-1.5 bg-white/20 border border-white/30 rounded-lg text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next year"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className={`text-3xl font-bold ${stats.coverage === 100 ? 'text-green-300 animate-bounce motion-reduce:animate-none' : ''}`}>
                      {stats.coverage === 100 && '🎉 '}
                      {stats.coverage}%
                    </div>
                    <div className="text-sm text-blue-100">Planned</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.fullyPlannedWeeks}</div>
                    <div className="text-sm text-blue-100">Weeks Covered</div>
                  </div>
                  <div title={stats.totalGaps > 0 ? `${stats.totalGaps} child-weeks need camps` : 'All covered!'}>
                    <div className={`text-3xl font-bold ${stats.weeksWithGaps > 0 ? 'text-yellow-300' : ''}`}>
                      {stats.weeksWithGaps}
                    </div>
                    <div className="text-sm text-blue-100">
                      Gaps to Fill
                      {stats.totalGaps > stats.weeksWithGaps && (
                        <span className="text-blue-200/70"> ({stats.totalGaps} slots)</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Visual progress bar */}
                <div className="mb-4">
                  <div className="h-3 bg-blue-900/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.coverage === 100
                          ? 'bg-green-400'
                          : stats.coverage >= 75
                          ? 'bg-blue-300'
                          : stats.coverage >= 50
                          ? 'bg-yellow-400'
                          : 'bg-orange-400'
                      }`}
                      style={{ width: `${stats.coverage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-blue-200 mt-1">
                    <span>June</span>
                    <span>July</span>
                    <span>August</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-blue-100 border-t border-blue-500/30 pt-3">
                  <span>{stats.registeredCount} camp{stats.registeredCount !== 1 ? 's' : ''} registered</span>
                  {stats.savedCount > 0 && (
                    <>
                      <span className="text-blue-300">•</span>
                      <span>{stats.savedCount} saved for later</span>
                    </>
                  )}
                </div>
                {/* Motivational message */}
                <p className="mt-3 text-sm text-blue-200 italic">
                  {stats.coverage === 100
                    ? "🎉 Amazing! Summer is fully planned!"
                    : stats.coverage >= 75
                    ? "🚀 Almost there! Just a few more weeks to fill."
                    : stats.coverage >= 50
                    ? "💪 Great progress! Keep filling those gaps."
                    : stats.coverage > 0
                    ? "🌱 Good start! Lots of camps to explore."
                    : "👋 Welcome! Let's plan an awesome summer."}
                </p>
              </>
            )}

            {stats && stats.weeksWithGaps > 0 && defaultCity && (
              <Link
                href={`/discover/${defaultCity.slug}`}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors"
              >
                <SearchIcon />
                Find Camps to Fill Gaps
              </Link>
            )}
          </div>

          {/* Child Selector + Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {children.length > 1 && (
                <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
                  <button
                    onClick={() => setSelectedChildId('all')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedChildId === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All
                  </button>
                  {children.map((child) => (
                    <button
                      key={child._id}
                      onClick={() => setSelectedChildId(child._id)}
                      title={child.lastName ? `${child.firstName} ${child.lastName}` : child.firstName}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        selectedChildId === child._id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedChildId === child._id
                          ? 'bg-white/30 dark:bg-slate-900/30'
                          : 'bg-slate-200 dark:bg-slate-600'
                      }`}>
                        {child.firstName[0]}
                      </span>
                      {child.firstName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddEventModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Add family event (E key)"
            >
              <PlusIcon />
              Add Event
              <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded text-[10px]">E</kbd>
            </button>
          </div>

          {/* Legend + Gap Filter */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <CoverageLegend />
            {stats && stats.weeksWithGaps > 0 && (
              <label
                className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg transition-colors ${
                  showOnlyGaps
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Toggle gaps filter (G key)"
              >
                <input
                  type="checkbox"
                  checked={showOnlyGaps}
                  onChange={(e) => setShowOnlyGaps(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className={`text-sm ${showOnlyGaps ? 'font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                  Show only gaps ({stats.weeksWithGaps})
                </span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded text-[10px]">G</kbd>
              </label>
            )}
          </div>

          {/* Coverage Grid */}
          {coverage === undefined ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
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
                <div className="p-8 text-center">
                  {showOnlyGaps && stats && stats.weeksWithGaps === 0 ? (
                    <>
                      <div className="text-4xl mb-3">🎉</div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                        No gaps to show!
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        Amazing work! Every week is covered for summer {selectedYear}.
                      </p>
                    </>
                  ) : showOnlyGaps ? (
                    <>
                      <div className="text-4xl mb-3">✨</div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                        No gaps for {children.find(c => c._id === selectedChildId)?.firstName || 'this child'}!
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        This child is fully covered for the summer.
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">
                      No weeks found for summer {selectedYear}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav citySlug={defaultCity?.slug} />

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        defaultChildIds={children.map((c) => c._id)}
      />
    </div>
  );
}

// App Header with user menu
function AppHeader({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const ADMIN_EMAILS = ['seth@magicseth.com'];
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-20">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">☀️</span>
          <span className="font-bold text-lg">PDX Camps</span>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin" className="text-sm text-orange-600 hover:underline font-medium">
              Admin
            </Link>
          )}
          <Link
            href="/settings"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Settings - Manage children, preferences"
            aria-label="Settings"
          >
            <SettingsIcon />
          </Link>
          <button
            onClick={onSignOut}
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Sign out of your account"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
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

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
