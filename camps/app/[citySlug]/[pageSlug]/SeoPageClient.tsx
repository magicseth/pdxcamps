'use client';

import { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';

interface SeoSession {
  _id: string;
  campId: string;
  campName: string;
  campSlug: string;
  campDescription: string;
  categories: string[];
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLogoUrl?: string;
  locationName: string;
  locationCity?: string;
  locationState?: string;
  imageUrl?: string;
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
  ageRequirements: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
  externalRegistrationUrl?: string;
  status: string;
}

interface SeoPageClientProps {
  citySlug: string;
  cityName: string;
  pageSlug: string;
  title: string;
  intro: string;
  sessions: SeoSession[];
  totalCount: number;
  stats: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    organizationCount: number;
    availableCount: number;
  };
  relatedPages: Array<{ slug: string; title: string; href: string }>;
  discoverHref: string;
  filterLabel: string;
}

const ITEMS_PER_PAGE = 20;

const CATEGORY_ICONS: Record<string, string> = {
  Sports: '⚽',
  Arts: '🎨',
  STEM: '🔬',
  Nature: '🌲',
  Music: '🎵',
  Academic: '📚',
  Drama: '🎭',
  Adventure: '🏕️',
  Cooking: '🍳',
  Dance: '💃',
};

export function SeoPageClient({
  citySlug,
  cityName,
  pageSlug,
  title,
  intro,
  sessions,
  totalCount,
  stats,
  relatedPages,
  discoverHref,
  filterLabel,
}: SeoPageClientProps) {
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [sortBy, setSortBy] = useState<'date' | 'price-low' | 'price-high'>('date');

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];
    switch (sortBy) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'date':
      default:
        sorted.sort((a, b) => a.startDate.localeCompare(b.startDate));
        break;
    }
    return sorted;
  }, [sessions, sortBy]);

  const displayed = sortedSessions.slice(0, displayCount);
  const hasMore = displayCount < sessions.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero Section */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-400">
            <ol className="flex items-center gap-1.5 flex-wrap">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={discoverHref} className="hover:text-white transition-colors">
                  {cityName} Camps
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-white font-medium" aria-current="page">
                {filterLabel}
              </li>
            </ol>
          </nav>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            {title.replace(/ \| Summer \d{4}$/, '')}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
            {intro}
          </p>

          {/* Quick stats */}
          {totalCount > 0 && (
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium">
                <span className="font-semibold">{totalCount}</span>{' '}
                <span className="text-xs opacity-75">Programs</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium">
                <span className="font-semibold">{stats.organizationCount}</span>{' '}
                <span className="text-xs opacity-75">Organizations</span>
              </div>
              {stats.availableCount > 0 && (
                <div className="px-3 py-1.5 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-green-300 font-medium">
                  <span className="font-semibold">{stats.availableCount}</span>{' '}
                  <span className="text-xs opacity-75">With spots</span>
                </div>
              )}
              {stats.minPrice > 0 && (
                <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium">
                  <span className="font-semibold">${Math.round(stats.minPrice / 100)} - ${Math.round(stats.maxPrice / 100)}</span>{' '}
                  <span className="text-xs opacity-75">Price range</span>
                </div>
              )}
              {stats.minPrice === 0 && stats.maxPrice === 0 && (
                <div className="px-3 py-1.5 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-400/30 text-green-300 font-medium">
                  <span className="font-semibold">Free</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Sort + count bar */}
        {sessions.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Showing {Math.min(displayCount, sessions.length)} of {sessions.length} sessions
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="seo-sort" className="text-xs text-slate-500 dark:text-slate-400">
                Sort:
              </label>
              <select
                id="seo-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-sm px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                <option value="date">Start Date</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        )}

        {/* Sessions Grid */}
        {sessions.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {displayed.map((session) => (
                <SeoSessionCard key={session._id} session={session} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setDisplayCount((prev) => prev + ITEMS_PER_PAGE)}
                  className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Show more camps
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">🏕️</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No camps found yet
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              We&apos;re still adding camps for this category. Check back soon, or browse all available
              camps in {cityName}.
            </p>
            <Link
              href={discoverHref}
              className="inline-block px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              Browse All {cityName} Camps
            </Link>
          </div>
        )}

        {/* CTA + Email Capture */}
        <div className="mt-10 grid sm:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Plan your whole summer
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Map out every week. Add kids, track camps, and fill the gaps — all free.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                className="px-5 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors text-center text-sm"
              >
                Open Summer Planner
              </Link>
              <Link
                href={discoverHref}
                className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center text-sm"
              >
                Browse All Camps
              </Link>
            </div>
          </div>
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10 rounded-xl border border-primary/20 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Get weekly updates for {cityName}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              New sessions, price drops, and spots opening up — straight to your inbox.
            </p>
            <SeoEmailCapture citySlug={citySlug} cityName={cityName} pageSlug={pageSlug} />
          </div>
        </div>

        {/* Related pages for internal linking */}
        {relatedPages.length > 0 && (
          <nav className="mt-10" aria-label="Related camp searches">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              More {cityName} camp searches
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {relatedPages.map((rp) => (
                <Link
                  key={rp.slug}
                  href={rp.href}
                  className="block p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors"
                >
                  {rp.title}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </main>

      {/* Footer breadcrumb for SEO */}
      <footer className="max-w-5xl mx-auto px-4 py-6 border-t border-slate-200 dark:border-slate-700">
        <nav aria-label="Footer navigation" className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          {' / '}
          <Link href={discoverHref} className="hover:text-primary">
            {cityName} Summer Camps
          </Link>
          {' / '}
          <span className="text-slate-700 dark:text-slate-200">{filterLabel}</span>
        </nav>
      </footer>
    </div>
  );
}

function SeoSessionCard({ session }: { session: SeoSession }) {
  const isSoldOut = session.enrolledCount >= session.capacity;
  const spotsLeft = session.capacity - session.enrolledCount;

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${Math.round(cents / 100)}`;
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    if (start === end) {
      return s.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
    }
    return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  };

  const formatTime = (time: { hour: number; minute: number }) => {
    const h = time.hour % 12 || 12;
    const ampm = time.hour < 12 ? 'am' : 'pm';
    if (time.minute === 0) return `${h}${ampm}`;
    return `${h}:${time.minute.toString().padStart(2, '0')}${ampm}`;
  };

  const formatAgeRange = (req: SeoSession['ageRequirements']) => {
    if (req.minAge !== undefined && req.maxAge !== undefined) return `Ages ${req.minAge}-${req.maxAge}`;
    if (req.minAge !== undefined) return `Ages ${req.minAge}+`;
    if (req.maxAge !== undefined) return `Ages up to ${req.maxAge}`;
    if (req.minGrade !== undefined && req.maxGrade !== undefined) {
      const gl = (g: number) => (g === -1 ? 'Pre-K' : g === 0 ? 'K' : `${g}`);
      return `Grades ${gl(req.minGrade)}-${gl(req.maxGrade)}`;
    }
    return 'All ages';
  };

  const getCategoryStyle = (cat: string) => {
    const styles: Record<string, string> = {
      Sports: 'from-green-500 to-emerald-600',
      Arts: 'from-purple-500 to-pink-600',
      STEM: 'from-blue-500 to-cyan-600',
      Nature: 'from-green-600 to-teal-600',
      Music: 'from-pink-500 to-rose-600',
      Academic: 'from-amber-500 to-orange-600',
      Drama: 'from-red-500 to-pink-600',
      Adventure: 'from-orange-500 to-red-600',
      Cooking: 'from-yellow-500 to-orange-500',
      Dance: 'from-fuchsia-500 to-purple-600',
    };
    return styles[cat] ?? 'from-slate-500 to-slate-600';
  };

  const primaryCategory = session.categories[0] ?? '';

  return (
    <article
      className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${
        isSoldOut ? 'opacity-60' : 'hover:shadow-md'
      }`}
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt={session.campName}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${getCategoryStyle(primaryCategory)} flex items-center justify-center`}
          >
            <span className="text-3xl opacity-50">
              {CATEGORY_ICONS[primaryCategory] ?? '🏕️'}
            </span>
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        {/* Camp name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-end gap-2">
            {session.organizationLogoUrl && (
              <div className="w-8 h-8 rounded bg-white dark:bg-slate-800 shadow flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={session.organizationLogoUrl}
                  alt=""
                  className="w-6 h-6 object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white line-clamp-1 drop-shadow-md">
                {session.campName}
              </h3>
              <p className="text-xs text-white/80 line-clamp-1">{session.organizationName}</p>
            </div>
          </div>
        </div>
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isSoldOut && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Sold Out
            </span>
          )}
          {!isSoldOut && spotsLeft <= 5 && spotsLeft > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {spotsLeft} spots left
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Categories */}
        {session.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {session.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >
                {CATEGORY_ICONS[cat] && (
                  <span className="text-[10px]">{CATEGORY_ICONS[cat]}</span>
                )}
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400 mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDateRange(session.startDate, session.endDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {session.isOvernight
                ? 'Overnight'
                : `${formatTime(session.dropOffTime)} - ${formatTime(session.pickUpTime)}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{formatPrice(session.price)}</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{formatAgeRange(session.ageRequirements)}</span>
          </div>
          {session.locationName && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="line-clamp-1">
                {session.locationName}
                {session.locationCity && ` - ${session.locationCity}`}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {session.externalRegistrationUrl ? (
            <a
              href={session.externalRegistrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-green-600 text-white text-center text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              Register
            </a>
          ) : (
            <Link
              href={`/session/${session._id}`}
              className="flex-1 px-4 py-2 bg-primary text-white text-center text-sm font-medium rounded-md hover:bg-primary-dark transition-colors"
            >
              View Details
            </Link>
          )}
          <Link
            href={`/organization/${session.organizationSlug}`}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title={`More from ${session.organizationName}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}

function SeoEmailCapture({
  citySlug,
  cityName,
  pageSlug,
}: {
  citySlug: string;
  cityName: string;
  pageSlug: string;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const captureEmail = useMutation(api.leads.mutations.captureEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('submitting');
    try {
      await captureEmail({ email: email.trim(), citySlug, source: `seo-${pageSlug}` });
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p className="text-green-700 dark:text-green-400 font-medium py-2">
        You&apos;re on the list! We&apos;ll send you updates for {cityName}.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {status === 'submitting' ? 'Joining...' : 'Sign Up'}
      </button>
    </form>
  );
}
