'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';

export default function AdminPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/" className="font-semibold hover:underline">
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

function AdminContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const dashboard = useQuery(api.admin.queries.getScrapingDashboard);

  if (isAdmin === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
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
          className="inline-block mt-4 text-blue-600 hover:underline"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  if (dashboard === undefined) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
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
          className="inline-block mt-4 text-blue-600 hover:underline"
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Sources"
          value={dashboard.summary.totalSources}
          subtext={`${dashboard.summary.activeSources} active`}
        />
        <SummaryCard
          label="Total Sessions"
          value={dashboard.summary.totalSessions}
          subtext="from all sources"
        />
        <SummaryCard
          label="Healthy"
          value={dashboard.summary.activeSources - dashboard.summary.sourcesWithErrors}
          subtext="sources running"
          variant="success"
        />
        <SummaryCard
          label="With Errors"
          value={dashboard.summary.sourcesWithErrors}
          subtext="need attention"
          variant={dashboard.summary.sourcesWithErrors > 0 ? 'error' : 'default'}
        />
      </div>

      {/* Sources Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Source
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Sessions
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Last Scrape
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Error
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
}: {
  label: string;
  value: number;
  subtext: string;
  variant?: 'default' | 'success' | 'error';
}) {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  };

  const valueStyles = {
    default: 'text-slate-900 dark:text-white',
    success: 'text-green-700 dark:text-green-300',
    error: 'text-red-700 dark:text-red-300',
  };

  return (
    <div className={`rounded-lg border p-4 ${variantStyles[variant]}`}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-3xl font-bold ${valueStyles[variant]}`}>{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
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
  lastJobStatus: string | null;
  lastJobSessionsFound: number | null;
  lastJobError: string | null;
  lastJobCompletedAt: number | null;
}

function SourceRow({ source }: { source: SourceData }) {
  const hasError = source.health.consecutiveFailures > 0;
  const isHealthy = source.isActive && !hasError;

  // Format last scrape time
  const lastScrapeTime = source.lastScrapedAt
    ? formatRelativeTime(source.lastScrapedAt)
    : 'Never';

  // Get status badge
  const statusBadge = getStatusBadge(source);

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {source.name}
            </span>
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
            {source.totalSessions}
          </p>
          <p className="text-xs text-slate-500">
            {source.activeSessions} active
          </p>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="text-slate-900 dark:text-white">{lastScrapeTime}</p>
          {source.lastJobSessionsFound !== null && (
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
    </tr>
  );
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

  return new Date(timestamp).toLocaleDateString();
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
