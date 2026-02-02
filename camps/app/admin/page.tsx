'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';

export default function AdminPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          PDX Camps
        </Link>
        <h1 className="text-lg font-semibold">Admin Dashboard</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <AdminContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">
              Please sign in to access the admin dashboard.
            </p>
            <a
              href="/sign-in"
              className="bg-foreground text-background px-6 py-2 rounded-md"
            >
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function AdminContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const dashboard = useQuery(api.admin.queries.getScrapingDashboard);

  if (isAdmin === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
          <span className="sr-only">Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You don't have permission to access the admin dashboard.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 text-blue-600 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  if (dashboard === undefined) {
    return (
      <div className="max-w-6xl mx-auto">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48" aria-hidden="true"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
          <span className="sr-only">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  if (dashboard === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You don't have permission to access the admin dashboard.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 text-blue-600 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Scraping Dashboard
        </h2>
        <span className="text-xs text-slate-500" title="Data updates in real-time via Convex">
          Live data · Updated {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Summary Cards - Row 1: Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Sources with Data"
          value={dashboard.summary.sourcesWithSessions}
          subtext={`${dashboard.summary.dataSuccessRate}% of active`}
          variant="success"
        />
        <SummaryCard
          label="Active Sessions"
          value={dashboard.summary.totalActiveSessions}
          subtext={`${dashboard.summary.totalSessions} total`}
        />
        <SummaryCard
          label="Pending Review"
          value={dashboard.summary.pendingReview}
          subtext="incomplete sessions"
          variant={dashboard.summary.pendingReview > 0 ? 'warning' : 'default'}
          href="/admin/pending"
        />
        <SummaryCard
          label="No Data"
          value={dashboard.summary.sourcesWithoutSessions}
          subtext="active but empty"
          variant={dashboard.summary.sourcesWithoutSessions > 0 ? 'error' : 'default'}
        />
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/scraper-dev"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          Scraper Development
        </Link>
        <Link
          href="/admin/coverage"
          className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm font-medium"
        >
          Coverage Analysis
        </Link>
        <Link
          href="/admin/pending"
          className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm font-medium"
        >
          Pending Sessions
        </Link>
        <Link
          href="/admin/sources"
          className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm font-medium"
        >
          All Sources
        </Link>
        <Link
          href="/admin/locations"
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium"
        >
          Fix Locations
        </Link>
      </div>

      {/* Summary Cards - Row 2: Quality & Health */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          label="High Quality"
          value={dashboard.summary.highQualitySources}
          subtext="complete data"
          variant="success"
          small
        />
        <SummaryCard
          label="Medium Quality"
          value={dashboard.summary.mediumQualitySources}
          subtext="partial data"
          variant="warning"
          small
        />
        <SummaryCard
          label="Low Quality"
          value={dashboard.summary.lowQualitySources}
          subtext="minimal data"
          variant="error"
          small
        />
        <SummaryCard
          label="Total Sources"
          value={dashboard.summary.totalSources}
          subtext={`${dashboard.summary.activeSources} active`}
          small
        />
        <SummaryCard
          label="With Errors"
          value={dashboard.summary.sourcesWithErrors}
          subtext={`${dashboard.summary.scrapeSuccessRate}% success`}
          variant={dashboard.summary.sourcesWithErrors > 0 ? 'error' : 'default'}
          small
        />
      </div>

      {/* Sources Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Source
                </th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Sessions
                </th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Last Scrape
                </th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Status
                </th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Error
                </th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {dashboard.sources.map((source) => (
                <SourceRow key={source._id} source={source} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  variant = 'default',
  href,
  small = false,
}: {
  label: string;
  value: number;
  subtext: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  href?: string;
  small?: boolean;
}) {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const valueStyles = {
    default: 'text-slate-900 dark:text-white',
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-yellow-700 dark:text-yellow-300',
    error: 'text-red-700 dark:text-red-300',
  };

  const content = (
    <>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`${small ? 'text-2xl' : 'text-3xl'} font-bold tabular-nums ${valueStyles[variant]}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`rounded-lg border ${small ? 'p-3' : 'p-4'} ${variantStyles[variant]} hover:opacity-80 transition-opacity block`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`rounded-lg border ${small ? 'p-3' : 'p-4'} ${variantStyles[variant]}`}>
      {content}
    </div>
  );
}

interface SourceData {
  _id: string;
  name: string;
  url: string;
  organizationName: string | null;
  scraperModule: string | null | undefined;
  isActive: boolean;
  totalSessions: number;
  activeSessions: number;
  draftSessions: number;
  pendingSessions: number;
  hasData: boolean;
  dataQualityScore?: number;
  qualityTier?: 'high' | 'medium' | 'low';
  lastSessionsFoundAt?: number;
  health: {
    lastSuccessAt?: number;
    lastFailureAt?: number;
    consecutiveFailures: number;
    totalRuns: number;
    successRate: number;
    lastError?: string;
    needsRegeneration: boolean;
  };
  lastScrapedAt?: number;
  lastJobId: string | null;
  lastJobStatus: string | null;
  lastJobSessionsFound: number | null;
  lastJobError: string | null;
  lastJobCompletedAt: number | null;
}

function SourceRow({ source }: { source: SourceData }) {
  // Format last scrape time
  const lastScrapeTime = source.lastScrapedAt
    ? formatRelativeTime(source.lastScrapedAt)
    : 'Never';

  // Get status badge
  const statusBadge = getStatusBadge(source);

  // Get quality badge
  const qualityBadge = getQualityBadge(source);

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/sources/${source._id}`}
              className="font-medium text-slate-900 dark:text-white hover:text-blue-600 hover:underline"
            >
              {source.name}
            </Link>
            {qualityBadge}
            {!source.isActive && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded">
                Inactive
              </span>
            )}
          </div>
          {source.organizationName && (
            <p className="text-xs text-slate-500">{source.organizationName}</p>
          )}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            {truncateUrl(source.url)}
            <ExternalLinkIcon />
          </a>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="font-medium text-slate-900 dark:text-white">
            {source.activeSessions}
            {source.draftSessions > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400 ml-1" title="Draft sessions">
                +{source.draftSessions}
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {source.totalSessions} total
            {source.pendingSessions > 0 && (
              <span className="text-orange-600 ml-1">
                ({source.pendingSessions} pending)
              </span>
            )}
          </p>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="text-slate-900 dark:text-white">{lastScrapeTime}</p>
          {source.lastJobSessionsFound !== null && source.lastJobId && (
            <Link
              href={`/admin/jobs/${source.lastJobId}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Found {source.lastJobSessionsFound} sessions
            </Link>
          )}
          {source.lastJobSessionsFound !== null && !source.lastJobId && (
            <p className="text-xs text-slate-500">
              Found {source.lastJobSessionsFound} sessions
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          {statusBadge}
          {source.health.totalRuns > 0 && (
            <p className="text-xs text-slate-500" title={`${source.health.totalRuns} total runs`}>
              {Math.round(source.health.successRate * 100)}% success
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 max-w-xs">
        {source.health.lastError ? (
          <div className="group relative">
            <p className="text-xs text-red-600 dark:text-red-400 truncate max-w-[200px]">
              {source.health.lastError}
            </p>
            {/* Tooltip on hover */}
            <div className="hidden group-hover:block absolute z-10 left-0 top-full mt-1 p-2 bg-slate-900 text-white text-xs rounded shadow-lg max-w-md whitespace-pre-wrap">
              {source.health.lastError}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/admin/scraper-dev?sourceId=${source._id}&sourceName=${encodeURIComponent(source.name)}&sourceUrl=${encodeURIComponent(source.url)}`}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
        >
          Improve Scraper
        </Link>
      </td>
    </tr>
  );
}

function getQualityBadge(source: SourceData) {
  if (!source.hasData) {
    return null;
  }

  if (source.qualityTier === 'high') {
    return (
      <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded" title={`${source.dataQualityScore}% complete`}>
        High
      </span>
    );
  }

  if (source.qualityTier === 'medium') {
    return (
      <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded" title={`${source.dataQualityScore}% complete`}>
        Med
      </span>
    );
  }

  if (source.qualityTier === 'low') {
    return (
      <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded" title={`${source.dataQualityScore}% complete`}>
        Low
      </span>
    );
  }

  return null;
}

function getStatusBadge(source: SourceData) {
  if (!source.isActive) {
    return (
      <span className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full">
        Disabled
      </span>
    );
  }

  if (source.health.needsRegeneration) {
    return (
      <span className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
        Needs Regen
      </span>
    );
  }

  if (source.health.consecutiveFailures > 2) {
    return (
      <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
        Failing ({source.health.consecutiveFailures}x)
      </span>
    );
  }

  if (source.health.consecutiveFailures > 0) {
    return (
      <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
        Warning
      </span>
    );
  }

  if (source.health.totalRuns === 0) {
    return (
      <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
        Never Run
      </span>
    );
  }

  return (
    <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
      Healthy
    </span>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 30
      ? parsed.pathname.substring(0, 30) + '...'
      : parsed.pathname;
    return parsed.hostname + path;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  }
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
