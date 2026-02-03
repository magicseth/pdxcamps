'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useState } from 'react';

export default function CoveragePage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/admin" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Coverage Analysis</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <CoverageContent />
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

function CoverageContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const coverageStats = useQuery(api.scraping.coverage.getCoverageStats);
  const needsAttention = useQuery(api.scraping.coverage.getSourcesNeedingAttention);
  const cities = useQuery(api.cities.queries.listActiveCities);
  const addSource = useMutation(api.scraping.coverage.addSourceFromReference);

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newCityId, setNewCityId] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  if (isAdmin === undefined || coverageStats === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
          <span className="sr-only">Loading coverage data...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <Link
          href="/"
          className="inline-block mt-4 text-blue-600 hover:underline"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityId) {
      setAddError('Please select a market');
      return;
    }
    setAddingSource(true);
    setAddError(null);

    try {
      await addSource({
        name: newSourceName,
        url: newSourceUrl,
        cityId: newCityId as any // Cast to Id<"cities">
      });
      setNewSourceName('');
      setNewSourceUrl('');
      setNewCityId('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Coverage Analysis
        </h2>
        <p className="text-slate-500 mt-1">
          Track and improve data coverage across camp sources
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Sources"
          value={coverageStats.totalSources}
          subtext={`${coverageStats.activeSources} active`}
        />
        <StatCard
          label="With Data"
          value={coverageStats.sourcesWithData}
          subtext={`${coverageStats.dataSuccessRate}% success`}
          variant={coverageStats.dataSuccessRate >= 80 ? 'success' : coverageStats.dataSuccessRate >= 50 ? 'warning' : 'error'}
        />
        <StatCard
          label="High Quality"
          value={coverageStats.qualityBreakdown.high}
          variant="success"
        />
        <StatCard
          label="Medium Quality"
          value={coverageStats.qualityBreakdown.medium}
          variant="warning"
        />
        <StatCard
          label="Low Quality"
          value={coverageStats.qualityBreakdown.low}
          variant="error"
        />
      </div>

      {/* Sources Needing Attention */}
      {needsAttention && (
        <div className="space-y-4">
          {/* No Data Sources */}
          {needsAttention.noData.length > 0 && (
            <AttentionSection
              title="Sources Without Data"
              description="Active sources that have not produced any sessions"
              items={needsAttention.noData.map((s: { _id: string; name: string; url: string; lastScrapedAt?: number }) => ({
                id: s._id,
                name: s.name,
                detail: s.lastScrapedAt
                  ? `Last scraped: ${new Date(s.lastScrapedAt).toLocaleDateString()}`
                  : 'Never scraped',
                url: s.url,
              }))}
              variant="error"
            />
          )}

          {/* Failing Sources */}
          {needsAttention.failing.length > 0 && (
            <AttentionSection
              title="Failing Scrapers"
              description="Sources with consecutive scrape failures"
              items={needsAttention.failing.map((s: { _id: string; name: string; url: string; consecutiveFailures: number; lastError?: string }) => ({
                id: s._id,
                name: s.name,
                detail: `${s.consecutiveFailures} failures - ${s.lastError?.slice(0, 50)}...`,
                url: s.url,
              }))}
              variant="warning"
            />
          )}

          {/* URL Updates */}
          {needsAttention.urlUpdates.length > 0 && (
            <AttentionSection
              title="Suggested URL Updates"
              description="Sources where we found a better URL"
              items={needsAttention.urlUpdates.map((s: { _id: string; name: string; currentUrl: string; suggestedUrl?: string }) => ({
                id: s._id,
                name: s.name,
                detail: `${s.currentUrl} -> ${s.suggestedUrl}`,
                url: s.suggestedUrl || s.currentUrl,
              }))}
              variant="info"
            />
          )}
        </div>
      )}

      {/* Add New Source */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Add New Source</h3>
        <form onSubmit={handleAddSource} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Market *
              </label>
              <select
                value={newCityId}
                onChange={(e) => setNewCityId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900"
                required
              >
                <option value="">Select Market</option>
                {cities?.map((city) => (
                  <option key={city._id} value={city._id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Camp Name *
              </label>
              <input
                type="text"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900"
                placeholder="e.g., Portland Parks Summer Camps"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                URL *
              </label>
              <input
                type="url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900"
                placeholder="https://example.com/camps"
                required
              />
            </div>
          </div>
          {addError && (
            <p className="text-sm text-red-600">{addError}</p>
          )}
          <button
            type="submit"
            disabled={addingSource}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {addingSource ? 'Adding...' : 'Add Source'}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  variant = 'default',
}: {
  label: string;
  value: number;
  subtext?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const styles = {
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

  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${valueStyles[variant]}`}>{value}</p>
      {subtext && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
      )}
    </div>
  );
}

function AttentionSection({
  title,
  description,
  items,
  variant,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; name: string; detail: string; url: string }>;
  variant: 'error' | 'warning' | 'info';
}) {
  const headerStyles = {
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className={`px-6 py-4 border-b ${headerStyles[variant]}`}>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {items.map((item) => (
          <li key={item.id} className="px-6 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-slate-500">{item.detail}</p>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              View
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
