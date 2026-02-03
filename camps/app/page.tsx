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
import { PlannerGrid } from '../components/planner/PlannerGrid';
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

// Market configuration - change this to pivot to other cities
const CURRENT_MARKET = {
  slug: 'portland',
  name: 'Portland',
  tagline: 'PDX Camps',
  region: 'Portland Metro Area',
  heroSubtext: 'OMSI, Oregon Zoo, Portland Parks & Rec, and 100+ more camps in the Portland area.',
};

// Landing page for unauthenticated users
function LandingPage() {
  const featuredCamps = useQuery(api.camps.queries.getFeaturedCamps, {
    citySlug: CURRENT_MARKET.slug,
    limit: 6,
  });

  const featuredSessions = useQuery(api.sessions.queries.getFeaturedSessions, {
    citySlug: CURRENT_MARKET.slug,
    limit: 16,
  });

  const organizationsWithLogos = useQuery(api.organizations.queries.getOrganizationsWithLogos, {
    citySlug: CURRENT_MARKET.slug,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☀️</span>
            <span className="font-bold text-xl">{CURRENT_MARKET.tagline}</span>
          </div>
          <div className="flex gap-3">
            <a
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900"
            >
              Sign in
            </a>
            <a
              href="/sign-up"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="max-w-6xl mx-auto px-4 py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-6">
                <span>📍</span>
                <span>{CURRENT_MARKET.region}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                {CURRENT_MARKET.name} summer camps <span className="text-yellow-300">YOUR</span> kids will love
              </h1>
              <p className="text-xl text-blue-100 mb-4">
                {CURRENT_MARKET.heroSubtext}
              </p>
              <p className="text-lg text-blue-200 mb-8">
                Plan week-by-week, track coverage, and never stress about summer again.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="/sign-up"
                  className="px-8 py-4 text-lg font-semibold bg-white text-blue-700 rounded-xl hover:bg-blue-50 shadow-lg transition-all hover:scale-105"
                >
                  Start Planning Free
                </a>
                <a
                  href={`/discover/${CURRENT_MARKET.slug}`}
                  className="px-8 py-4 text-lg font-semibold bg-blue-500/30 text-white border-2 border-white/30 rounded-xl hover:bg-blue-500/50 transition-all"
                >
                  Browse All Camps
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Scrolling Organization Logos */}
        {organizationsWithLogos && organizationsWithLogos.length > 0 && (
          <div className="bg-white py-8 overflow-hidden border-b border-slate-200">
            <div className="max-w-6xl mx-auto px-4 mb-4">
              <p className="text-center text-sm text-slate-500 font-medium uppercase tracking-wider">
                The most trusted camps in {CURRENT_MARKET.name}
              </p>
            </div>
            <div className="relative">
              <div className="flex items-center gap-12 animate-scroll-slow">
                {/* First set */}
                {organizationsWithLogos.map((org) => (
                  <a
                    key={org._id}
                    href={`/discover/${CURRENT_MARKET.slug}?org=${org.slug}`}
                    className="flex-shrink-0 h-16 w-32 flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
                    title={org.name}
                  >
                    <img
                      src={org.logoUrl!}
                      alt={org.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </a>
                ))}
                {/* Duplicate for seamless loop */}
                {organizationsWithLogos.map((org) => (
                  <a
                    key={`dup-${org._id}`}
                    href={`/discover/${CURRENT_MARKET.slug}?org=${org.slug}`}
                    className="flex-shrink-0 h-16 w-32 flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
                    title={org.name}
                  >
                    <img
                      src={org.logoUrl!}
                      alt={org.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </a>
                ))}
              </div>
            </div>
            <style jsx>{`
              @keyframes scroll-slow {
                0% {
                  transform: translateX(0);
                }
                100% {
                  transform: translateX(-50%);
                }
              }
              .animate-scroll-slow {
                animation: scroll-slow 40s linear infinite;
              }
              .animate-scroll-slow:hover {
                animation-play-state: paused;
              }
            `}</style>
          </div>
        )}

        {/* Scrolling Sessions Showcase */}
        {featuredSessions && featuredSessions.length > 0 && (
          <div className="bg-slate-900 py-12 overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 mb-6">
              <h2 className="text-2xl font-bold text-white">
                Upcoming camps in <span className="text-yellow-400">{CURRENT_MARKET.name}</span>
              </h2>
              <p className="text-slate-400 mt-1">Real sessions with real spots available</p>
            </div>

            {/* Infinite scroll container */}
            <div className="relative">
              <div className="flex gap-4 animate-scroll hover:pause-animation">
                {/* First set */}
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={session._id} session={session} citySlug={CURRENT_MARKET.slug} />
                ))}
                {/* Duplicate for seamless loop */}
                {featuredSessions.map((session) => (
                  <SessionShowcaseCard key={`dup-${session._id}`} session={session} citySlug={CURRENT_MARKET.slug} />
                ))}
              </div>
            </div>

            <style jsx>{`
              @keyframes scroll {
                0% {
                  transform: translateX(0);
                }
                100% {
                  transform: translateX(-50%);
                }
              }
              .animate-scroll {
                animation: scroll 60s linear infinite;
              }
              .animate-scroll:hover {
                animation-play-state: paused;
              }
            `}</style>
          </div>
        )}

        {/* Featured Camps Section */}
        {featuredCamps && featuredCamps.length > 0 && (
          <div className="py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                  Popular {CURRENT_MARKET.name} Camps
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Trusted by families across the {CURRENT_MARKET.region}
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredCamps.map((camp) => (
                  <FeaturedCampCard key={camp._id} camp={camp} citySlug={CURRENT_MARKET.slug} />
                ))}
              </div>

              <div className="text-center mt-10">
                <a
                  href={`/discover/${CURRENT_MARKET.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  View All {CURRENT_MARKET.name} Camps
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="bg-slate-100 dark:bg-slate-800/50 py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-10">
              Everything you need to plan summer
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📅</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Week-by-Week Planning</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">See your whole summer at a glance. Instantly spot coverage gaps.</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔍</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Smart Discovery</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Filter by age, category, price, and dates. Find the perfect camp.</p>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">👨‍👩‍👧‍👦</span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Family Coordination</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Add vacations, track multiple kids, share plans with friends.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Ready to plan your summer?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Join hundreds of {CURRENT_MARKET.name} families who use {CURRENT_MARKET.tagline} to organize their kids' summers.
            </p>
            <a
              href="/sign-up"
              className="inline-block px-8 py-4 text-lg font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all hover:scale-105"
            >
              Get Started — It's Free
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-sm">
          <p>© {new Date().getFullYear()} {CURRENT_MARKET.tagline}. Made with ☀️ in {CURRENT_MARKET.name}.</p>
        </div>
      </footer>
    </div>
  );
}

// Featured camp card for landing page
function FeaturedCampCard({ camp, citySlug }: {
  camp: {
    _id: string;
    name: string;
    slug: string;
    description: string;
    categories: string[];
    ageRequirements: { minAge?: number; maxAge?: number; minGrade?: number; maxGrade?: number };
    organizationName?: string;
    imageUrl?: string;
    priceRange?: { min: number; max: number };
    upcomingSessionCount: number;
  };
  citySlug: string;
}) {
  // Format age range
  const formatAgeRange = () => {
    const { minAge, maxAge, minGrade, maxGrade } = camp.ageRequirements;
    if (minGrade !== undefined || maxGrade !== undefined) {
      const gradeLabel = (g: number) => (g === 0 ? 'K' : g < 0 ? 'Pre-K' : `${g}`);
      if (minGrade !== undefined && maxGrade !== undefined) {
        return `Grades ${gradeLabel(minGrade)}-${gradeLabel(maxGrade)}`;
      }
      if (minGrade !== undefined) return `Grades ${gradeLabel(minGrade)}+`;
      if (maxGrade !== undefined) return `Grades up to ${gradeLabel(maxGrade)}`;
    }
    if (minAge !== undefined && maxAge !== undefined) {
      return `Ages ${minAge}-${maxAge}`;
    }
    if (minAge !== undefined) return `Ages ${minAge}+`;
    if (maxAge !== undefined) return `Ages up to ${maxAge}`;
    return null;
  };

  // Format price
  const formatPrice = () => {
    if (!camp.priceRange) return null;
    const { min, max } = camp.priceRange;
    if (min === max) {
      return `$${(min / 100).toFixed(0)}`;
    }
    return `$${(min / 100).toFixed(0)} - $${(max / 100).toFixed(0)}`;
  };

  const ageRange = formatAgeRange();
  const price = formatPrice();

  return (
    <a
      href={`/discover/${citySlug}?camp=${camp.slug}`}
      className="group bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-slate-200 dark:border-slate-700"
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
        {camp.imageUrl ? (
          <img
            src={camp.imageUrl}
            alt={camp.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🏕️
          </div>
        )}
        {/* Category badge */}
        {camp.categories[0] && (
          <span className="absolute top-3 left-3 px-2 py-1 bg-white/90 dark:bg-slate-900/90 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300">
            {camp.categories[0]}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 transition-colors line-clamp-1">
          {camp.name}
        </h3>
        {camp.organizationName && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            {camp.organizationName}
          </p>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
          {camp.description}
        </p>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {ageRange && (
            <span className="flex items-center gap-1">
              <span>👤</span>
              {ageRange}
            </span>
          )}
          {price && (
            <span className="flex items-center gap-1">
              <span>💰</span>
              {price}
            </span>
          )}
          {camp.upcomingSessionCount > 0 && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span>📅</span>
              {camp.upcomingSessionCount} sessions
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// Session showcase card for scrolling display
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
  // Format date range
  const formatDateRange = () => {
    const start = new Date(session.startDate + 'T12:00:00');
    const end = new Date(session.endDate + 'T12:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (start.getMonth() === end.getMonth()) {
      return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
    }
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}`;
  };

  // Format price
  const formatPrice = () => {
    return `$${(session.price / 100).toFixed(0)}`;
  };

  // Format ages
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
      className="flex-shrink-0 w-72 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20 group"
    >
      {/* Image */}
      <div className="aspect-[16/10] bg-slate-700 relative overflow-hidden">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt={session.campName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-blue-600 to-purple-600">
            🏕️
          </div>
        )}
        {/* Date badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-white text-sm font-medium">
          {formatDateRange()}
        </div>
        {/* Spots indicator */}
        {session.isSoldOut ? (
          <div className="absolute top-3 right-3 px-2 py-1 bg-red-500 rounded-lg text-white text-xs font-bold">
            SOLD OUT
          </div>
        ) : session.spotsLeft <= 5 && session.spotsLeft > 0 ? (
          <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500 rounded-lg text-white text-xs font-bold">
            {session.spotsLeft} left!
          </div>
        ) : null}
        {/* Organization logo */}
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

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white text-sm line-clamp-1 group-hover:text-blue-400 transition-colors">
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
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-full" aria-hidden="true"></div>
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
        <span className="sr-only">Loading...</span>
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <AppHeader user={user} onSignOut={onSignOut} />

      <main id="main-content" className="flex-1 pb-20">
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  aria-label="Select year"
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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
                    aria-pressed={selectedChildId === 'all'}
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
                      aria-pressed={selectedChildId === child._id}
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

          {/* Legend + View Toggle + Gap Filter */}
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <CoverageLegend />
              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Grid view"
                >
                  <GridIcon />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="List view"
                >
                  <ListIcon />
                </button>
              </div>
            </div>
            {stats && stats.weeksWithGaps > 0 && (
              <label
                htmlFor="show-only-gaps"
                className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg transition-colors ${
                  showOnlyGaps
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Toggle gaps filter (G key)"
              >
                <input
                  id="show-only-gaps"
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
            <div role="status" aria-live="polite" className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse motion-reduce:animate-none" aria-hidden="true"></div>
              ))}
              <span className="sr-only">Loading coverage data...</span>
            </div>
          ) : filteredCoverage.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
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
          ) : viewMode === 'grid' ? (
            <PlannerGrid
              coverage={filteredCoverage}
              children={selectedChildId === 'all' ? children : children.filter(c => c._id === selectedChildId)}
              citySlug={defaultCity?.slug}
            />
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
            <Link href="/admin" className="text-sm text-orange-600 hover:underline font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              Admin
            </Link>
          )}
          <Link
            href="/settings"
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
