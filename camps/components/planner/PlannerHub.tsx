'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import type { User } from '@workos-inc/node';
import { PlannerGrid } from './PlannerGrid';
import type { RegistrationClickData, EventClickData } from '../../lib/types';
import { RegistrationModal } from './RegistrationModal';
import { EditEventModal } from './EditEventModal';
import { AddEventModal } from './AddEventModal';
import { AddChildModal } from './AddChildModal';
import { RequestCampModal } from '../../components/discover/RequestCampModal';
import { BottomNav } from '../shared/BottomNav';
import { SharePlanModal } from './SharePlanModal';
import { AppHeader } from '../shared/AppHeader';
import { OrgFilterChip } from '../shared/OrgFilterChip';
import { useMarket } from '../../hooks/useMarket';
import { QueryErrorBoundary } from '../shared/QueryErrorBoundary';
import { PlusIcon, SearchIcon } from '../shared/icons';
import { generateSummerWeeks, type SummerWeek, isAgeInRange, isGradeInRange, calculateAge } from '../../convex/lib/helpers';
import { RegistrationProgressBanner } from './RegistrationProgressBanner';
import { RegistrationChecklist, ChecklistFAB } from './RegistrationChecklist';
import { CampSelectorDrawer } from './CampSelectorDrawer';

export function PlannerHub({
  user,
  onSignOut,
  children,
  cities
}: {
  user: User | null;
  onSignOut: () => void;
  children: { _id: Id<'children'>; firstName: string; lastName?: string; birthdate?: string; currentGrade?: number; color?: string; shareToken?: string }[];
  cities: { _id: Id<'cities'>; slug: string; name: string }[];
}) {
  const market = useMarket();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed, so September = 8
  // Only show next year starting in September
  const maxYear = currentMonth >= 8 ? currentYear + 1 : currentYear;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const yearParam = searchParams.get('year');
    return yearParam ? parseInt(yearParam) : currentYear;
  });
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showRequestCampModal, setShowRequestCampModal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationClickData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<Id<'familyEvents'> | null>(null);
  const [selectedGap, setSelectedGap] = useState<{
    weekStart: string;
    weekEnd: string;
    childId: Id<'children'>;
    childName: string;
    childColor?: string;
    childAge?: number;
    childGrade?: number;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedYear !== currentYear) params.set('year', selectedYear.toString());
    const queryString = params.toString();
    router.replace(`/${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [selectedYear, currentYear, router]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddEventModal]);

  const coverage = useQuery(api.planner.queries.getSummerCoverage, {
    year: selectedYear,
  });

  // Pre-computed availability aggregate — single doc read, instant
  const availability = useQuery(api.planner.aggregates.getWeeklyAvailability, {
    year: selectedYear,
  });

  // Category and org filters for planner grid counts
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }, []);

  const toggleOrg = useCallback((orgId: string) => {
    setSelectedOrgs(prev =>
      prev.includes(orgId) ? prev.filter(o => o !== orgId) : [...prev, orgId]
    );
  }, []);

  // Derive available categories from aggregate data, sorted by frequency
  // Filter out generic catch-all categories
  const availableCategories = useMemo(() => {
    if (!availability?.weeks) return [];
    const freq: Record<string, number> = {};
    for (const summaries of Object.values(availability.weeks)) {
      for (const s of summaries) {
        for (const cat of s.cats) {
          if (cat !== 'General' && cat !== 'camp') {
            freq[cat] = (freq[cat] || 0) + 1;
          }
        }
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [availability]);

  // Derive available organizations from aggregate data, sorted by frequency
  const availableOrgs = useMemo(() => {
    if (!availability?.weeks) return [];
    const orgs: Record<string, { name: string; logoUrl?: string; count: number }> = {};
    for (const summaries of Object.values(availability.weeks)) {
      for (const s of summaries) {
        if (!s.orgName) continue; // Skip entries without org name
        if (!orgs[s.orgId]) {
          orgs[s.orgId] = { name: s.orgName, logoUrl: s.orgLogoUrl, count: 0 };
        }
        orgs[s.orgId].count++;
      }
    }
    return Object.entries(orgs)
      .filter(([, org]) => org.name) // Filter out any with undefined names
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id, org]) => ({ id, name: org.name, logoUrl: org.logoUrl }));
  }, [availability]);

  // Compute session counts client-side from the aggregate, applying filters
  const sessionCounts = useMemo(() => {
    if (!availability?.weeks) return undefined;

    const result: Record<string, Record<string, number>> = {};

    for (const [weekStart, summaries] of Object.entries(availability.weeks)) {
      const weekCounts: Record<string, number> = {};

      for (const child of children) {
        if (!child.birthdate) continue;
        const age = calculateAge(child.birthdate);
        let count = 0;

        for (const s of summaries) {
          if (!isAgeInRange(age, { minAge: s.minAge, maxAge: s.maxAge })) continue;
          if (
            child.currentGrade !== undefined &&
            child.currentGrade !== null &&
            !isGradeInRange(child.currentGrade, { minGrade: s.minGrade, maxGrade: s.maxGrade })
          ) continue;
          // Apply category filter
          if (selectedCategories.length > 0 && !selectedCategories.some(cat => s.cats.includes(cat))) continue;
          // Apply org filter
          if (selectedOrgs.length > 0 && !selectedOrgs.includes(s.orgId)) continue;
          count++;
        }

        if (count > 0) weekCounts[child._id] = count;
      }

      if (Object.keys(weekCounts).length > 0) result[weekStart] = weekCounts;
    }

    return result;
  }, [availability, children, selectedCategories, selectedOrgs]);

  const subscription = useQuery(api.subscriptions.getSubscription);
  const isPremium = subscription?.isPremium ?? false;

  // Query saved camps for the registration checklist
  const savedCamps = useQuery(api.registrations.queries.getSavedCamps);

  const featuredSessions = useQuery(api.sessions.queries.getFeaturedSessions, {
    citySlug: market.slug,
    limit: 16,
  });

  const familyEvents = useQuery(api.planner.queries.getFamilyEvents, {
    year: selectedYear,
  });

  // Find the selected event for the edit modal
  const selectedEvent = useMemo(() => {
    if (!selectedEventId || !familyEvents) return null;
    return familyEvents.find((e) => e._id === selectedEventId) ?? null;
  }, [selectedEventId, familyEvents]);

  // Pre-compute skeleton weeks so the skeleton shows real month/week headers
  const skeletonWeeks = useMemo(() => generateSummerWeeks(selectedYear), [selectedYear]);

  // Group skeleton weeks by month
  const skeletonByMonth = useMemo(() => {
    const groups: Map<string, SummerWeek[]> = new Map();
    for (const w of skeletonWeeks) {
      if (!groups.has(w.monthName)) groups.set(w.monthName, []);
      groups.get(w.monthName)!.push(w);
    }
    return Array.from(groups.entries());
  }, [skeletonWeeks]);

  const filteredCoverage = coverage || [];

  const stats = useMemo(() => {
    if (!coverage) return null;
    const totalWeeks = coverage.length;
    const weeksWithGaps = coverage.filter((w) => w.hasGap).length;
    const fullyPlannedWeeks = coverage.filter(
      (w) => w.childCoverage.every((c) => c.status === 'full' || c.status === 'event')
    ).length;

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

  // Get registration counts from savedCamps query for the progress banner
  const registrationStats = useMemo(() => {
    if (!savedCamps) return { registered: 0, todo: 0, waitlist: 0 };
    return {
      registered: savedCamps.registered.length,
      todo: savedCamps.interested.length,
      waitlist: savedCamps.waitlisted.length,
    };
  }, [savedCamps]);

  const defaultCity = cities.find(c => c.slug === market.slug) || cities[0];

  const handleGapClick = useCallback((weekStart: string, weekEnd: string, childId: Id<'children'>) => {
    const child = children.find(c => c._id === childId);
    if (!child) return;

    // Calculate child's age at the time of the camp
    let age: number | undefined;
    if (child.birthdate) {
      const birthDate = new Date(child.birthdate);
      const weekStartDate = new Date(weekStart);
      age = weekStartDate.getFullYear() - birthDate.getFullYear();
      const monthDiff = weekStartDate.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && weekStartDate.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age <= 0) age = undefined;
    }

    setSelectedGap({
      weekStart,
      weekEnd,
      childId,
      childName: child.firstName,
      childColor: child.color,
      childAge: age,
      childGrade: child.currentGrade,
    });
  }, [children]);

  const handleRegistrationClick = useCallback((data: RegistrationClickData) => {
    setSelectedRegistration(data);
  }, []);

  const handleEventClick = useCallback((data: EventClickData) => {
    setSelectedEventId(data.eventId);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <AppHeader
        user={user}
        onSignOut={onSignOut}
        isPremium={isPremium}
        yearSelector={{
          selectedYear,
          onPrevYear: () => setSelectedYear((y) => y - 1),
          onNextYear: () => setSelectedYear((y) => y + 1),
          canGoPrev: selectedYear > currentYear - 1,
          canGoNext: selectedYear < maxYear,
        }}
        onShare={() => setShowShareModal(true)}
      />

      <main id="main-content" className="flex-1 pb-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Upgrade Banner for Free Users - compelling upsell */}
          {!isPremium && subscription !== undefined && (
            <Link
              href="/upgrade"
              className="block bg-gradient-to-r from-accent/10 to-primary/10 dark:from-accent/20 dark:to-primary/20 border border-accent/30 rounded-lg px-4 py-3 mb-4 hover:from-accent/15 hover:to-primary/15 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Sync to Google Calendar
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Plus: share with co-parents, registration reminders, waitlist alerts
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-accent group-hover:text-accent-dark">
                  Upgrade →
                </span>
              </div>
            </Link>
          )}

          {/* Registration Progress Banner */}
          {stats && (registrationStats.registered > 0 || registrationStats.todo > 0 || registrationStats.waitlist > 0) && (
            <RegistrationProgressBanner
              year={selectedYear}
              totalWeeks={stats.totalWeeks}
              coveredWeeks={stats.fullyPlannedWeeks}
              registeredCount={registrationStats.registered}
              todoCount={registrationStats.todo}
              waitlistCount={registrationStats.waitlist}
              onTodoClick={() => setShowChecklist(true)}
            />
          )}

          {/* Category filter chips + action buttons */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {/* Find Camps button */}
            {stats && stats.weeksWithGaps > 0 && defaultCity && (
              <Link
                href={`/discover/${defaultCity.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-full font-medium text-xs hover:bg-accent-dark transition-colors flex-shrink-0"
              >
                <SearchIcon />
                <span>Find Camps</span>
              </Link>
            )}

            {/* Add Event button */}
            <button
              onClick={() => setShowAddEventModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0"
              title="Add family event (E key)"
            >
              <PlusIcon />
              <span>Add Event</span>
            </button>

            {/* Divider */}
            {availableCategories.length > 0 && (
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 flex-shrink-0" />
            )}

            {/* Category filter chips */}
            {availableCategories.length > 0 && availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors whitespace-nowrap ${
                  selectedCategories.includes(cat)
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          {/* Organization filter chips */}
          {availableOrgs.length > 0 && (
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {availableOrgs.map(org => (
                <OrgFilterChip
                  key={org.id}
                  id={org.id}
                  name={org.name}
                  logoUrl={org.logoUrl}
                  isSelected={selectedOrgs.includes(org.id)}
                  onClick={() => toggleOrg(org.id)}
                  showCount={false}
                  size="sm"
                />
              ))}
              {selectedOrgs.length > 0 && (
                <button
                  onClick={() => setSelectedOrgs([])}
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {coverage === undefined ? (
            <div role="status" aria-live="polite" className="animate-in fade-in duration-300" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
              <span className="sr-only">Loading coverage data...</span>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      {/* Month headers */}
                      <tr className="bg-slate-100 dark:bg-slate-900">
                        <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-900 px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 min-w-[120px]" />
                        {skeletonByMonth.map(([month, weeks]) => (
                          <th
                            key={month}
                            colSpan={weeks.length}
                            className="px-2 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-l border-slate-200 dark:border-slate-700"
                          >
                            {month}
                          </th>
                        ))}
                      </tr>
                      {/* Week headers */}
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700" />
                        {skeletonWeeks.map((week, i) => {
                          const isMonthStart = i > 0 && skeletonWeeks[i - 1].monthName !== week.monthName;
                          return (
                            <th
                              key={week.startDate}
                              className={`px-1 py-1.5 text-center text-xs border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 ${
                                isMonthStart ? 'border-l border-l-slate-300 dark:border-l-slate-600' : 'border-l border-l-slate-200 dark:border-l-slate-700'
                              }`}
                            >
                              <div className="font-medium">{week.label.split(' ')[0]}</div>
                              <div className="text-[10px] opacity-70">{week.label.split(' ').slice(1).join(' ')}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {children.map((child, i) => (
                        <tr key={child._id} className={i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}>
                          <td className="sticky left-0 z-10 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700/50 bg-inherit">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
                                {child.firstName[0]}
                              </span>
                              <span>{child.firstName}</span>
                            </div>
                          </td>
                          {skeletonWeeks.map((week, j) => {
                            const isMonthStart = j > 0 && skeletonWeeks[j - 1].monthName !== week.monthName;
                            return (
                              <td key={week.startDate} className={`border-b border-slate-100 dark:border-slate-700/50 p-0 ${
                                isMonthStart ? 'border-l border-l-slate-300 dark:border-l-slate-600' : 'border-l border-l-slate-100 dark:border-l-slate-700/50'
                              }`}>
                                <div className="w-full min-h-[48px] bg-slate-100/50 dark:bg-slate-700/30 animate-pulse" />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile skeleton */}
                <div className="md:hidden">
                  {skeletonByMonth.map(([month, weeks]) => (
                    <div key={month}>
                      <div className="px-4 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        {month}
                      </div>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50">
                            <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[90px]" />
                            {weeks.map((week) => (
                              <th key={week.startDate} className="px-1 py-1.5 text-center text-xs border-b border-l border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                <div className="font-medium">{week.label.split(' ')[0]}</div>
                                <div className="text-[10px] opacity-70">{week.label.split(' ').slice(1).join(' ')}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {children.map((child, i) => (
                            <tr key={child._id} className={i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}>
                              <td className="sticky left-0 z-10 px-3 py-2 text-sm font-medium text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700/50 bg-inherit">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {child.firstName[0]}
                                  </span>
                                  <span className="truncate text-xs">{child.firstName}</span>
                                </div>
                              </td>
                              {weeks.map((week) => (
                                <td key={week.startDate} className="px-1 py-2 border-b border-l border-slate-100 dark:border-slate-700/50">
                                  <div className="h-8 bg-slate-100/50 dark:bg-slate-700/30 rounded animate-pulse" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredCoverage.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                No weeks found for summer {selectedYear}.
              </p>
            </div>
          ) : (
            <QueryErrorBoundary section="planner">
              <PlannerGrid
                coverage={filteredCoverage}
                children={children}
                citySlug={defaultCity?.slug}
                sessionCounts={sessionCounts}
                onGapClick={handleGapClick}
                onRegistrationClick={handleRegistrationClick}
                onEventClick={handleEventClick}
                onAddChild={() => setShowAddChildModal(true)}
              />
            </QueryErrorBoundary>
          )}
        </div>

        {/* Scrolling Sessions Showcase */}
        {featuredSessions && featuredSessions.length > 0 && (
          <section className="bg-slate-900 py-12 overflow-hidden mt-8">
            <div className="max-w-4xl mx-auto px-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  Featured camps in {market.name}
                </h2>
                <button
                  onClick={() => setShowRequestCampModal(true)}
                  className="text-sm text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Request a camp
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="flex gap-4 animate-scroll-planner hover:pause-animation">
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={session._id} session={session} citySlug={market.slug} />
                ))}
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={`dup-${session._id}`} session={session} citySlug={market.slug} />
                ))}
              </div>
            </div>

            <style jsx>{`
              @keyframes scroll-planner {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-scroll-planner {
                animation: scroll-planner 60s linear infinite;
              }
              .animate-scroll-planner:hover {
                animation-play-state: paused;
              }
            `}</style>
          </section>
        )}
      </main>

      <BottomNav citySlug={defaultCity?.slug} />

      <AddEventModal
        isOpen={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        defaultChildIds={children.map((c) => c._id)}
      />

      <AddChildModal
        isOpen={showAddChildModal}
        onClose={() => setShowAddChildModal(false)}
      />

      <RequestCampModal
        isOpen={showRequestCampModal}
        onClose={() => setShowRequestCampModal(false)}
      />

      <SharePlanModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        children={children}
      />

      <RegistrationModal
        isOpen={selectedRegistration !== null}
        onClose={() => setSelectedRegistration(null)}
        registration={selectedRegistration ? {
          registrationId: selectedRegistration.registrationId as Id<'registrations'>,
          sessionId: selectedRegistration.sessionId as Id<'sessions'>,
          childId: selectedRegistration.childId,
          childName: selectedRegistration.childName,
          campName: selectedRegistration.campName,
          organizationName: selectedRegistration.organizationName,
          organizationLogoUrl: selectedRegistration.organizationLogoUrl,
          status: selectedRegistration.status as 'interested' | 'waitlisted' | 'registered' | 'cancelled',
          weekLabel: selectedRegistration.weekLabel,
          registrationUrl: selectedRegistration.registrationUrl,
        } : null}
        citySlug={defaultCity?.slug}
      />

      {selectedEvent && (
        <EditEventModal
          isOpen={selectedEventId !== null}
          onClose={() => setSelectedEventId(null)}
          event={{
            _id: selectedEvent._id,
            title: selectedEvent.title,
            description: selectedEvent.description,
            startDate: selectedEvent.startDate,
            endDate: selectedEvent.endDate,
            eventType: selectedEvent.eventType,
            location: selectedEvent.location,
            notes: selectedEvent.notes,
            color: selectedEvent.color,
            childIds: selectedEvent.childIds,
          }}
        />
      )}

      {/* Registration Checklist Drawer */}
      <RegistrationChecklist
        isOpen={showChecklist}
        onClose={() => setShowChecklist(false)}
        children={children}
      />

      {/* Camp Selector Drawer (for gap clicks) */}
      {selectedGap && defaultCity && (
        <CampSelectorDrawer
          isOpen={selectedGap !== null}
          onClose={() => setSelectedGap(null)}
          weekStart={selectedGap.weekStart}
          weekEnd={selectedGap.weekEnd}
          childId={selectedGap.childId}
          childName={selectedGap.childName}
          childColor={selectedGap.childColor}
          childAge={selectedGap.childAge}
          childGrade={selectedGap.childGrade}
          cityId={defaultCity._id}
        />
      )}

      {/* Floating Action Button for quick access to checklist */}
      <ChecklistFAB
        pendingCount={registrationStats.todo}
        onClick={() => setShowChecklist(true)}
      />
    </div>
  );
}


// Session showcase card for scrolling display (used in PlannerHub)
function SessionShowcaseCard({ session, citySlug }: {
  session: {
    _id: string;
    campName: string;
    campSlug: string;
    organizationName?: string;
    organizationLogoUrl?: string;
    imageUrl?: string;
    startDate: string;
    endDate: string;
    price: number;
    locationName?: string;
    ageRequirements?: { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number };
    categories: string[];
    spotsLeft: number;
    isSoldOut: boolean;
  };
  citySlug: string;
}) {
  const formatDateRange = () => {
    const start = new Date(session.startDate + 'T12:00:00');
    const end = new Date(session.endDate + 'T12:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (start.getMonth() === end.getMonth()) {
      return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
    }
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}`;
  };

  const formatPrice = () => {
    return `$${(session.price / 100).toFixed(0)}`;
  };

  const formatAges = () => {
    if (!session.ageRequirements) return null;
    const { minAge, maxAge, minGrade, maxGrade } = session.ageRequirements;
    if (minGrade !== undefined || maxGrade !== undefined) {
      const gradeLabel = (g: number) => (g === 0 ? 'K' : `${g}`);
      if (minGrade !== undefined && maxGrade !== undefined) {
        return `Gr ${gradeLabel(minGrade)}-${gradeLabel(maxGrade)}`;
      }
    }
    if (minAge !== undefined && maxAge !== undefined) {
      return `${minAge}-${maxAge}y`;
    }
    return null;
  };

  return (
    <a
      href={`/discover/${citySlug}?camp=${session.campSlug}`}
      className="flex-shrink-0 w-72 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-accent transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/20 group"
    >
      <div className="aspect-[16/10] bg-slate-700 relative overflow-hidden">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt={session.campName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary to-surface-dark">
            🏕️
          </div>
        )}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
          {formatDateRange()}
        </div>
        {session.isSoldOut ? (
          <div className="absolute top-3 right-3 px-2 py-1 bg-red-500 rounded-lg text-white text-xs font-bold">
            SOLD OUT
          </div>
        ) : session.spotsLeft <= 5 && session.spotsLeft > 0 ? (
          <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500 rounded-lg text-white text-xs font-bold">
            {session.spotsLeft} left!
          </div>
        ) : null}
        {session.organizationLogoUrl && (
          <div className="absolute bottom-2 left-2 w-10 h-10 rounded-lg bg-white shadow-lg overflow-hidden border border-white/50">
            <img
              src={session.organizationLogoUrl}
              alt={session.organizationName || 'Organization'}
              className="w-full h-full object-contain p-1"
            />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-white text-sm line-clamp-1 group-hover:text-accent transition-colors">
          {session.campName}
        </h3>
        {session.organizationName && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
            {session.organizationName}
          </p>
        )}

        <div className="flex items-center justify-between mt-3">
          {session.price > 0 ? (
            <span className="text-lg font-bold text-green-400">{formatPrice()}</span>
          ) : (
            <span className="text-sm text-slate-500">Price TBD</span>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {formatAges() && <span>{formatAges()}</span>}
            {session.categories[0] && (
              <span className="px-2 py-0.5 bg-slate-700 rounded-full">{session.categories[0]}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
