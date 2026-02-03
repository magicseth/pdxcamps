'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';
import { StatCard, AlertBanner } from '../../components/admin';

export default function AdminPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          PDX Camps
        </Link>
        <h1 className="text-lg font-semibold">Command Center</h1>
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
  const [selectedCityId, setSelectedCityId] = useState<Id<"cities"> | undefined>(undefined);

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const cities = useQuery(api.cities.queries.listActiveCities);
  // Use lightweight summary query instead of full dashboard with sources
  const dashboard = useQuery(api.admin.queries.getDashboardSummary, { cityId: selectedCityId });
  const alerts = useQuery(api.scraping.queries.listUnacknowledgedAlerts, {});

  if (isAdmin === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
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
          className="inline-block mt-4 text-primary hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          className="inline-block mt-4 text-primary hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  // Calculate alert counts
  const alertStats = {
    critical: alerts?.filter((a) => a.severity === 'critical').length ?? 0,
    error: alerts?.filter((a) => a.severity === 'error').length ?? 0,
    warning: alerts?.filter((a) => a.severity === 'warning').length ?? 0,
  };

  // Build needs attention items
  const needsAttention: AttentionItem[] = [];

  // Failing sources
  if (dashboard.summary.sourcesWithErrors > 0) {
    needsAttention.push({
      type: 'error',
      title: `${dashboard.summary.sourcesWithErrors} source${dashboard.summary.sourcesWithErrors > 1 ? 's' : ''} failing`,
      description: 'Consecutive scrape failures detected',
      primaryAction: { label: 'View Sources', href: '/admin/sources?tab=failing' },
      secondaryAction: { label: 'Fix Scrapers', href: '/admin/development' },
    });
  }

  // Pending sessions
  if (dashboard.summary.pendingReview > 0) {
    needsAttention.push({
      type: 'warning',
      title: `${dashboard.summary.pendingReview} session${dashboard.summary.pendingReview > 1 ? 's' : ''} need review`,
      description: 'Incomplete session data waiting for review',
      primaryAction: { label: 'Review Sessions', href: '/admin/data-quality' },
    });
  }

  // No data sources
  if (dashboard.summary.sourcesWithoutSessions > 0) {
    needsAttention.push({
      type: 'info',
      title: `${dashboard.summary.sourcesWithoutSessions} source${dashboard.summary.sourcesWithoutSessions > 1 ? 's' : ''} with no data`,
      description: 'Active sources that have not produced sessions',
      primaryAction: { label: 'View Sources', href: '/admin/sources?tab=nodata' },
    });
  }

  // Low quality sources
  if (dashboard.summary.lowQualitySources > 0) {
    needsAttention.push({
      type: 'info',
      title: `${dashboard.summary.lowQualitySources} source${dashboard.summary.lowQualitySources > 1 ? 's' : ''} with low quality`,
      description: 'Sources returning minimal or incomplete data',
      primaryAction: { label: 'Improve Scrapers', href: '/admin/development' },
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Market Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Command Center
          </h2>
          <select
            value={selectedCityId || ''}
            onChange={(e) => setSelectedCityId(e.target.value ? e.target.value as Id<"cities"> : undefined)}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="">All Markets</option>
            {cities?.map((city) => (
              <option key={city._id} value={city._id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-500" title="Data updates in real-time via Convex">
          Live data
        </span>
      </div>

      {/* Alert Banner */}
      <AlertBanner
        criticalCount={alertStats.critical}
        errorCount={alertStats.error}
        warningCount={alertStats.warning}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Healthy"
          value={dashboard.summary.sourcesWithSessions}
          subtext={`${dashboard.summary.dataSuccessRate}% with data`}
          variant="success"
          href="/admin/sources?tab=active"
        />
        <StatCard
          label="Failing"
          value={dashboard.summary.sourcesWithErrors}
          subtext="consecutive failures"
          variant={dashboard.summary.sourcesWithErrors > 0 ? 'error' : 'default'}
          href="/admin/sources?tab=failing"
        />
        <StatCard
          label="No Data"
          value={dashboard.summary.sourcesWithoutSessions}
          subtext="active but empty"
          variant={dashboard.summary.sourcesWithoutSessions > 0 ? 'warning' : 'default'}
          href="/admin/sources?tab=nodata"
        />
        <StatCard
          label="Pending Review"
          value={dashboard.summary.pendingReview}
          subtext="incomplete sessions"
          variant={dashboard.summary.pendingReview > 0 ? 'warning' : 'default'}
          href="/admin/data-quality"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/growth"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
        >
          + Seed Market
        </Link>
        <Link
          href="/admin/development"
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark text-sm font-medium"
        >
          + Request Scraper
        </Link>
        <Link
          href="/admin/sources"
          className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm font-medium"
        >
          All Sources
        </Link>
        <Link
          href="/admin/data-quality"
          className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm font-medium"
        >
          Data Quality
        </Link>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="High Quality"
          value={dashboard.summary.highQualitySources}
          subtext="complete data"
          variant="success"
          small
        />
        <StatCard
          label="Medium Quality"
          value={dashboard.summary.mediumQualitySources}
          subtext="partial data"
          variant="warning"
          small
        />
        <StatCard
          label="Low Quality"
          value={dashboard.summary.lowQualitySources}
          subtext="minimal data"
          variant="error"
          small
        />
        <StatCard
          label="Total Sources"
          value={dashboard.summary.totalSources}
          subtext={`${dashboard.summary.activeSources} active`}
          small
        />
        <StatCard
          label="Active Sessions"
          value={dashboard.summary.totalActiveSessions}
          subtext={`${dashboard.summary.totalSessions} total`}
          small
        />
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">Needs Attention</h3>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {needsAttention.map((item, index) => (
              <AttentionRow key={index} item={item} />
            ))}
          </ul>
        </div>
      )}

      {/* All Clear State */}
      {needsAttention.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-8 text-center">
          <div className="text-green-500 mb-2">
            <CheckCircleIcon />
          </div>
          <h3 className="font-semibold text-green-800 dark:text-green-200">All Systems Healthy</h3>
          <p className="text-sm text-green-600 dark:text-green-300 mt-1">
            No immediate issues detected. Great job!
          </p>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 dark:bg-primary-dark/30 flex items-center justify-center text-primary dark:text-primary-light">
              <DatabaseIcon />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {dashboard.summary.activeSources} sources active
              </p>
              <p className="text-slate-500 text-xs">Actively scraping</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <CalendarIcon />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {dashboard.summary.totalActiveSessions} sessions
              </p>
              <p className="text-slate-500 text-xs">Active camp sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ChartIcon />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {dashboard.summary.scrapeSuccessRate}% success rate
              </p>
              <p className="text-slate-500 text-xs">Overall scraping health</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AttentionItem {
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const iconStyles = {
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-primary dark:text-primary-light',
  };

  return (
    <li className="px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 ${iconStyles[item.type]}`}>
          {item.type === 'error' ? (
            <ErrorIcon />
          ) : item.type === 'warning' ? (
            <WarningIcon />
          ) : (
            <InfoIcon />
          )}
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
          <p className="text-sm text-slate-500">{item.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {item.secondaryAction && (
          <Link
            href={item.secondaryAction.href}
            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {item.secondaryAction.label}
          </Link>
        )}
        <Link
          href={item.primaryAction.href}
          className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          {item.primaryAction.label}
        </Link>
      </div>
    </li>
  );
}

// Icons
function ErrorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
