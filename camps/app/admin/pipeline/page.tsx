'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Authenticated, Unauthenticated } from 'convex/react';

export default function PipelinePage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link
          href="/admin"
          className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Pipeline Diagnostics</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <Suspense fallback={<LoadingState />}>
            <PipelineContent />
          </Suspense>
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">Please sign in to access the admin dashboard.</p>
            <a href="/sign-in" className="bg-foreground text-background px-6 py-2 rounded-md">
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function LoadingState() {
  return (
    <div className="max-w-7xl mx-auto py-8">
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          ))}
        </div>
        <span className="sr-only">Loading pipeline diagnostics...</span>
      </div>
    </div>
  );
}

function PipelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCityId = searchParams.get('city') || null;
  const [selectedCityId, setSelectedCityId] = useState<Id<'cities'> | null>(initialCityId as Id<'cities'> | null);

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const citiesWithStats = useQuery(api.scraping.diagnostics.listCitiesWithStats, {});

  useEffect(() => {
    const city = searchParams.get('city');
    if (city) {
      setSelectedCityId(city as Id<'cities'>);
    }
  }, [searchParams]);

  const handleCityChange = (cityId: string | null) => {
    setSelectedCityId(cityId as Id<'cities'> | null);
    const params = new URLSearchParams(searchParams.toString());
    if (cityId) {
      params.set('city', cityId);
    } else {
      params.delete('city');
    }
    router.push(`/admin/pipeline${params.toString() ? '?' + params.toString() : ''}`);
  };

  if (isAdmin === undefined || citiesWithStats === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You don&apos;t have permission to access the admin dashboard.
        </p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline Diagnostics</h2>
          <p className="text-slate-500 mt-1">Debug why camps aren&apos;t showing for a market</p>
        </div>
        <select
          value={selectedCityId ?? ''}
          onChange={(e) => handleCityChange(e.target.value || null)}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select a market...</option>
          {citiesWithStats?.map((city) => (
            <option key={city._id} value={city._id}>
              {city.name}, {city.state} ({city.stats.activeSessions} active sessions)
              {!city.isActive ? ' [INACTIVE]' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* All Cities Overview */}
      {!selectedCityId && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">All Markets Overview</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {citiesWithStats?.map((city) => (
              <div
                key={city._id}
                onClick={() => handleCityChange(city._id)}
                className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${city.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {city.name}, {city.state}
                    </span>
                    {!city.isActive && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-slate-500">Orgs</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{city.stats.organizations}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-500">Sources</div>
                      <div
                        className={`font-semibold ${city.stats.failingSources > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}
                      >
                        {city.stats.activeSources}/{city.stats.sources}
                        {city.stats.failingSources > 0 && ` (${city.stats.failingSources} failing)`}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-500">Sessions</div>
                      <div
                        className={`font-semibold ${city.stats.activeSessions === 0 ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {city.stats.activeSessions} active
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected City Diagnostics */}
      {selectedCityId && <CityDiagnostics cityId={selectedCityId} />}
    </div>
  );
}

function CityDiagnostics({ cityId }: { cityId: Id<'cities'> }) {
  const diagnostics = useQuery(api.scraping.diagnostics.getPipelineDiagnostics, { cityId });
  const [groupBy, setGroupBy] = useState<'status' | 'source' | 'organization' | 'completeness'>('status');
  const sessionsBreakdown = useQuery(api.scraping.diagnostics.getSessionsBreakdown, {
    cityId,
    groupBy,
  });

  if (diagnostics === undefined) {
    return <LoadingState />;
  }

  if (diagnostics === null) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
        <p className="text-red-600 dark:text-red-400">City not found</p>
      </div>
    );
  }

  const { city, pipeline, recentJobs, issues, topSources } = diagnostics;

  return (
    <div className="space-y-6">
      {/* City Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-4">
          <span className={`w-4 h-4 rounded-full ${city.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{city.name}</h3>
          <span className="text-slate-500">/{city.slug}</span>
          {!city.isActive && (
            <span className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
              CITY IS INACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Issues Panel */}
      {issues.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-900/20">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Issues Detected ({issues.length})</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {issues.map((issue, i) => (
              <div
                key={i}
                className={`px-6 py-3 flex items-center gap-3 ${
                  issue.severity === 'error'
                    ? 'bg-red-50 dark:bg-red-900/10'
                    : issue.severity === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-900/10'
                      : 'bg-blue-50 dark:bg-blue-900/10'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    issue.severity === 'error'
                      ? 'bg-red-500'
                      : issue.severity === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                  }`}
                />
                <span
                  className={`text-sm ${
                    issue.severity === 'error'
                      ? 'text-red-700 dark:text-red-300'
                      : issue.severity === 'warning'
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Flow Visualization */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Pipeline Flow</h3>
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
          <PipelineStage
            label="Organizations"
            count={pipeline.organizations.total}
            subtext={`${pipeline.organizations.active} active`}
            status={pipeline.organizations.active > 0 ? 'success' : 'error'}
            href={`/admin/control-center?city=${cityId}`}
          />
          <Arrow />
          <PipelineStage
            label="Sources"
            count={pipeline.sources.total}
            subtext={`${pipeline.sources.healthy} healthy, ${pipeline.sources.failing} failing`}
            status={pipeline.sources.healthy > 0 ? (pipeline.sources.failing > 0 ? 'warning' : 'success') : 'error'}
            href={`/admin/control-center?city=${cityId}`}
          />
          <Arrow />
          <PipelineStage
            label="Camps"
            count={pipeline.camps.total}
            subtext={`${pipeline.camps.withSessions} with sessions`}
            status={pipeline.camps.withSessions > 0 ? 'success' : 'warning'}
            href={`/admin/camps?city=${cityId}`}
          />
          <Arrow />
          <PipelineStage
            label="Sessions"
            count={pipeline.sessions.total}
            subtext={`${pipeline.sessions.byStatus.active} active`}
            status={pipeline.sessions.byStatus.active > 0 ? 'success' : 'error'}
          />
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sessions by Status */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">Sessions by Status</h4>
          <div className="space-y-2">
            <StatRow
              label="Active"
              count={pipeline.sessions.byStatus.active}
              total={pipeline.sessions.total}
              color="green"
            />
            <StatRow
              label="Draft"
              count={pipeline.sessions.byStatus.draft}
              total={pipeline.sessions.total}
              color="yellow"
            />
            <StatRow
              label="Sold Out"
              count={pipeline.sessions.byStatus.sold_out}
              total={pipeline.sessions.total}
              color="red"
            />
            <StatRow
              label="Cancelled"
              count={pipeline.sessions.byStatus.cancelled}
              total={pipeline.sessions.total}
              color="slate"
            />
            <StatRow
              label="Completed"
              count={pipeline.sessions.byStatus.completed}
              total={pipeline.sessions.total}
              color="blue"
            />
          </div>
        </div>

        {/* Sessions Completeness */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">Data Completeness</h4>
          <div className="space-y-2">
            <StatRow
              label="High (80%+)"
              count={pipeline.sessions.completeness.high}
              total={pipeline.sessions.total}
              color="green"
            />
            <StatRow
              label="Medium (50-79%)"
              count={pipeline.sessions.completeness.medium}
              total={pipeline.sessions.total}
              color="yellow"
            />
            <StatRow
              label="Low (<50%)"
              count={pipeline.sessions.completeness.low}
              total={pipeline.sessions.total}
              color="red"
            />
          </div>
        </div>

        {/* Sources Health */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">Sources Health</h4>
          <div className="space-y-2">
            <StatRow label="Healthy" count={pipeline.sources.healthy} total={pipeline.sources.total} color="green" />
            <StatRow label="Failing" count={pipeline.sources.failing} total={pipeline.sources.total} color="red" />
            <StatRow
              label="Needs Regen"
              count={pipeline.sources.needsRegeneration}
              total={pipeline.sources.total}
              color="orange"
            />
            <StatRow label="Closed" count={pipeline.sources.closed} total={pipeline.sources.total} color="slate" />
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h4 className="text-sm font-medium text-slate-500 mb-3">Recent Jobs (Last 50)</h4>
          <div className="space-y-2">
            <StatRow label="Completed" count={recentJobs.byStatus.completed} total={recentJobs.total} color="green" />
            <StatRow label="Failed" count={recentJobs.byStatus.failed} total={recentJobs.total} color="red" />
            <StatRow label="Running" count={recentJobs.byStatus.running} total={recentJobs.total} color="blue" />
            <StatRow label="Pending" count={recentJobs.byStatus.pending} total={recentJobs.total} color="yellow" />
          </div>
        </div>
      </div>

      {/* Pending Items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/admin/data-quality?city=${cityId}`}
          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-primary transition-colors"
        >
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{pipeline.pendingSessions}</div>
          <div className="text-sm text-slate-500">Pending Sessions to Review</div>
        </Link>
        <Link
          href={`/admin/growth?city=${cityId}`}
          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-primary transition-colors"
        >
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{pipeline.discoveredSources}</div>
          <div className="text-sm text-slate-500">Discovered Sources Pending</div>
        </Link>
        <Link
          href="/admin/development"
          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-primary transition-colors"
        >
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{pipeline.devRequests}</div>
          <div className="text-sm text-slate-500">Active Development Requests</div>
        </Link>
      </div>

      {/* Sessions Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Sessions Breakdown</h3>
          <div className="flex gap-2">
            {(['status', 'source', 'organization', 'completeness'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 text-sm rounded ${
                  groupBy === g
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {sessionsBreakdown === undefined ? (
            <div className="animate-pulse h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
          ) : (
            <div className="space-y-3">
              {sessionsBreakdown.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900 dark:text-white">{item.key}</span>
                    {'activeCount' in item && item.activeCount !== undefined && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                        {item.activeCount} active
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Sources */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Top Sources by Session Count</h3>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {topSources.map((source) => (
            <Link
              key={source._id}
              href={`/admin/sources/${source._id}`}
              className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    source.closureReason
                      ? 'bg-slate-400'
                      : source.health.consecutiveFailures >= 3
                        ? 'bg-red-500'
                        : source.isActive
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                  }`}
                />
                <span className="font-medium text-slate-900 dark:text-white">{source.name}</span>
                {source.closureReason && (
                  <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                    Closed
                  </span>
                )}
                {!source.isActive && !source.closureReason && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">
                  {source.lastScrapedAt ? `Last: ${formatTimestamp(source.lastScrapedAt)}` : 'Never scraped'}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{source.sessionCount} sessions</span>
                <span className="text-green-600 dark:text-green-400">{source.activeSessionCount} active</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Components

function PipelineStage({
  label,
  count,
  subtext,
  status,
  href,
}: {
  label: string;
  count: number;
  subtext: string;
  status: 'success' | 'warning' | 'error';
  href?: string;
}) {
  const content = (
    <div
      className={`flex-shrink-0 w-40 p-4 rounded-lg border-2 transition-colors ${
        status === 'success'
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
          : status === 'warning'
            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-red-500 bg-red-50 dark:bg-red-900/20'
      } ${href ? 'hover:bg-opacity-80 cursor-pointer' : ''}`}
    >
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{count}</div>
      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{subtext}</div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function Arrow() {
  return (
    <div className="flex-shrink-0 text-slate-300 dark:text-slate-600">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function StatRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'slate' | 'orange';
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    slate: 'bg-slate-400',
    orange: 'bg-orange-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-slate-600 dark:text-slate-400">{label}</span>
          <span className="font-medium text-slate-900 dark:text-white">{count}</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${colorClasses[color]}`} style={{ width: `${percentage}%` }} />
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
