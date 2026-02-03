'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTabs, StatCard } from '../../../components/admin';

export default function SourcesManagementPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Admin Access Required
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Please sign in to access the admin dashboard.
          </p>
          <a
            href="/sign-in"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState />}>
      <SourcesManagementContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-4">
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <span className="sr-only">Loading sources...</span>
        </div>
      </main>
    </div>
  );
}

type TabFilter = 'all' | 'active' | 'failing' | 'nodata';

function SourcesManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial tab from URL
  const initialTab = (searchParams.get('tab') as TabFilter) || 'all';
  const [activeTab, setActiveTab] = useState<TabFilter>(initialTab);
  const [triggeringSource, setTriggeringSource] = useState<Id<'scrapeSources'> | null>(null);

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`/admin/sources${params.toString() ? '?' + params.toString() : ''}`);
  };

  // Sync with URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabFilter;
    if (tab && ['all', 'active', 'failing', 'nodata'].includes(tab)) {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab('all');
    }
  }, [searchParams]);

  // Single query for both counts and filtered sources
  const filteredData = useQuery(api.scraping.queries.listSourcesFiltered, {
    filter: activeTab,
    limit: 50,
  });

  // Mutations
  const toggleSourceActive = useMutation(api.scraping.mutations.toggleSourceActive);
  const createScrapeJob = useMutation(api.scraping.mutations.createScrapeJob);

  const handleToggleActive = async (sourceId: Id<'scrapeSources'>, currentActive: boolean) => {
    try {
      await toggleSourceActive({
        sourceId,
        isActive: !currentActive,
      });
    } catch (error) {
      console.error('Failed to toggle source:', error);
    }
  };

  const handleTriggerScrape = async (sourceId: Id<'scrapeSources'>) => {
    try {
      setTriggeringSource(sourceId);
      await createScrapeJob({
        sourceId,
        triggeredBy: 'admin-manual',
      });
    } catch (error) {
      console.error('Failed to trigger scrape:', error);
      alert(error instanceof Error ? error.message : 'Failed to trigger scrape');
    } finally {
      setTriggeringSource(null);
    }
  };

  // Use counts from combined query
  const stats = filteredData?.counts ?? { all: 0, active: 0, failing: 0, nodata: 0 };

  // Filtered sources from the filtered query
  const filteredSources = filteredData?.sources ?? [];

  const tabs = [
    { id: 'all', label: 'All', count: stats.all },
    { id: 'active', label: 'Active', count: stats.active },
    { id: 'failing', label: 'Failing', count: stats.failing },
    { id: 'nodata', label: 'No Data', count: stats.nodata },
  ];

  const getHealthIndicator = (health: {
    consecutiveFailures: number;
    successRate: number;
    needsRegeneration: boolean;
  }) => {
    if (health.needsRegeneration || health.consecutiveFailures >= 5) {
      return { color: 'red', label: 'Critical' };
    }
    if (health.consecutiveFailures >= 3) {
      return { color: 'orange', label: 'Degraded' };
    }
    if (health.successRate >= 0.9) {
      return { color: 'green', label: 'Healthy' };
    }
    if (health.successRate >= 0.7) {
      return { color: 'yellow', label: 'Fair' };
    }
    return { color: 'gray', label: 'Unknown' };
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-700 mb-1 block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                &larr; Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Sources
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Manage scraping configurations and monitor health
              </p>
            </div>
            <Link
              href="/admin/growth"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              + Add Source
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <AdminTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* Stats Summary */}
        {filteredData?.counts && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Sources"
              value={stats.all}
            />
            <StatCard
              label="Active"
              value={stats.active}
              variant="success"
            />
            <StatCard
              label="Failing"
              value={stats.failing}
              variant={stats.failing > 0 ? 'error' : 'default'}
            />
            <StatCard
              label="No Data"
              value={stats.nodata}
              variant={stats.nodata > 0 ? 'warning' : 'default'}
            />
          </div>
        )}

        {/* Loading State */}
        {filteredData === undefined && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <div role="status" aria-live="polite" className="p-6 animate-pulse motion-reduce:animate-none space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4" aria-hidden="true">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                </div>
              ))}
              <span className="sr-only">Loading scrape sources...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredData !== undefined && filteredSources.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
            <div className="text-slate-400 mb-4">
              <EmptyIcon />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {activeTab === 'all' ? 'No scrape sources found' : `No ${activeTab} sources`}
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {activeTab === 'all'
                ? 'Scrape sources will appear here when they are created.'
                : activeTab === 'failing'
                ? 'Great news! No sources are currently failing.'
                : activeTab === 'nodata'
                ? 'All active sources have produced data.'
                : 'No sources match this filter.'}
            </p>
          </div>
        )}

        {/* Sources List */}
        {filteredData !== undefined && filteredSources.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Health
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Last Scraped
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSources.map((source) => {
                  const health = getHealthIndicator(source.scraperHealth);
                  return (
                    <tr key={source._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Organization Logo */}
                          {source.organizationLogoUrl ? (
                            <img
                              src={source.organizationLogoUrl}
                              alt={source.organizationName || source.name}
                              className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 dark:border-slate-600 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-slate-400">
                                {(source.organizationName || source.name).slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {source.name}
                            </p>
                            {source.organizationName && source.organizationName !== source.name && (
                              <p className="text-xs text-slate-500">{source.organizationName}</p>
                            )}
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-700 line-clamp-1"
                            >
                              {source.url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              health.color === 'green'
                                ? 'bg-green-500'
                                : health.color === 'yellow'
                                ? 'bg-yellow-500'
                                : health.color === 'orange'
                                ? 'bg-orange-500'
                                : health.color === 'red'
                                ? 'bg-red-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {health.label}
                          </span>
                        </div>
                        {source.scraperHealth.lastError && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-1">
                            {source.scraperHealth.lastError}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {source.lastScrapedAt
                          ? formatTimestamp(source.lastScrapedAt)
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                source.scraperHealth.successRate >= 0.9
                                  ? 'bg-green-500'
                                  : source.scraperHealth.successRate >= 0.7
                                  ? 'bg-yellow-500'
                                  : source.scraperHealth.successRate >= 0.5
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                              }`}
                              style={{
                                width: `${Math.round(source.scraperHealth.successRate * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {Math.round(source.scraperHealth.successRate * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {source.scraperHealth.totalRuns} runs
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(source._id, source.isActive)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            source.isActive
                              ? 'bg-green-500'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              source.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTriggerScrape(source._id)}
                            disabled={triggeringSource === source._id || !source.isActive}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                              triggeringSource === source._id || !source.isActive
                                ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {triggeringSource === source._id ? (
                              <span className="flex items-center gap-1">
                                <SpinnerIcon />
                                Running...
                              </span>
                            ) : (
                              'Trigger Scrape'
                            )}
                          </button>
                          <Link
                            href={`/admin/sources/${source._id}`}
                            className="px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
            {/* Pagination info */}
            {filteredData && filteredData.totalCount > filteredSources.length && (
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
                Showing {filteredSources.length} of {filteredData.totalCount} sources
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Helper functions
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

// Icons
function EmptyIcon() {
  return (
    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin motion-reduce:animate-none h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
