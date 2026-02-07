'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Id } from '../../../convex/_generated/dataModel';

export default function MarketSeedingPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <ArrowLeftIcon />
          </Link>
          <Link
            href="/"
            className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            PDX Camps
          </Link>
        </div>
        <h1 className="text-lg font-semibold">Market Seeding</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <MarketSeedingContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">Please sign in to access market seeding.</p>
            <a href="/sign-in" className="bg-foreground text-background px-6 py-2 rounded-md">
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function MarketSeedingContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const cities = useQuery(api.cities.queries.listActiveCities);
  const discoveryTasks = useQuery(api.scraping.marketDiscovery.listDiscoveryTasks, { limit: 20 });
  const createDiscoveryTask = useMutation(api.scraping.marketDiscovery.createDiscoveryTask);
  const resetDiscoveryTask = useMutation(api.scraping.marketDiscovery.resetDiscoveryTask);

  const [regionName, setRegionName] = useState('');
  const [createCity, setCreateCity] = useState(false);
  const [cityName, setCityName] = useState('');
  const [cityState, setCityState] = useState('');
  const [cityTimezone, setCityTimezone] = useState('');
  const [selectedCitySlug, setSelectedCitySlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Parse region name to pre-fill city fields
  useEffect(() => {
    if (regionName && createCity) {
      const parts = regionName.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        setCityName(parts[0]);
        setCityState(parts[1]);
      }
    }
  }, [regionName, createCity]);

  if (isAdmin === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const args: {
        regionName: string;
        citySlug?: string;
        createCity?: boolean;
        cityName?: string;
        cityState?: string;
        cityTimezone?: string;
      } = {
        regionName,
      };

      if (createCity) {
        if (!cityName || !cityState) {
          throw new Error('City name and state are required when creating a new city');
        }
        args.createCity = true;
        args.cityName = cityName;
        args.cityState = cityState;
        if (cityTimezone) {
          args.cityTimezone = cityTimezone;
        }
      } else if (selectedCitySlug) {
        args.citySlug = selectedCitySlug;
      } else {
        throw new Error('Please select an existing city or create a new one');
      }

      const result = await createDiscoveryTask(args);
      setSuccess(`Discovery task created! Task ID: ${result.taskId}`);
      setRegionName('');
      setCreateCity(false);
      setCityName('');
      setCityState('');
      setCityTimezone('');
      setSelectedCitySlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (taskId: Id<'marketDiscoveryTasks'>) => {
    try {
      await resetDiscoveryTask({ taskId });
    } catch (err) {
      console.error('Failed to reset task:', err);
    }
  };

  // Group tasks by status
  const activeTasks =
    discoveryTasks?.filter((t) => t.status === 'pending' || t.status === 'searching' || t.status === 'discovering') ||
    [];
  const completedTasks = discoveryTasks?.filter((t) => t.status === 'completed') || [];
  const failedTasks = discoveryTasks?.filter((t) => t.status === 'failed') || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Add New Market Form */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add New Market</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Region Name */}
          <div>
            <label htmlFor="regionName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Region Name (for search queries)
            </label>
            <input
              id="regionName"
              type="text"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="Phoenix, Arizona"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              This will be used in search queries like "{regionName || 'Phoenix, Arizona'} summer camps"
            </p>
          </div>

          {/* City Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cityOption"
                  checked={!createCity}
                  onChange={() => setCreateCity(false)}
                  className="text-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Use existing city</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cityOption"
                  checked={createCity}
                  onChange={() => setCreateCity(true)}
                  className="text-primary"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Create new city</span>
              </label>
            </div>

            {!createCity ? (
              <select
                value={selectedCitySlug}
                onChange={(e) => setSelectedCitySlug(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Select a city...</option>
                {cities?.map((city) => (
                  <option key={city._id} value={city.slug}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="City Name"
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={cityState}
                  onChange={(e) => setCityState(e.target.value)}
                  placeholder="State (e.g., AZ)"
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={cityTimezone}
                  onChange={(e) => setCityTimezone(e.target.value)}
                  placeholder="Timezone (optional)"
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Start Discovery'}
          </button>
        </form>

        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>How it works:</strong> The local daemon will search Google for camp organizations in this region,
            visit camp directories, extract URLs, and automatically create organizations, scrape sources, and queue
            scraper development requests.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Make sure the daemon is running:{' '}
            <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">npx tsx scripts/scraper-daemon.ts</code>
          </p>
        </div>
      </div>

      {/* Active Discovery Tasks */}
      {activeTasks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">Active Discovery Tasks</h3>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {activeTasks.map((task) => (
              <TaskRow key={task._id} task={task} onReset={handleReset} showReset />
            ))}
          </ul>
        </div>
      )}

      {/* Completed Discoveries */}
      {completedTasks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-white">Completed Discoveries</h3>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {completedTasks.map((task) => (
              <TaskRow key={task._id} task={task} onReset={handleReset} />
            ))}
          </ul>
        </div>
      )}

      {/* Failed Tasks */}
      {failedTasks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
            <h3 className="font-semibold text-red-800 dark:text-red-200">Failed Tasks</h3>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {failedTasks.map((task) => (
              <TaskRow key={task._id} task={task} onReset={handleReset} showReset />
            ))}
          </ul>
        </div>
      )}

      {/* Empty State */}
      {(!discoveryTasks || discoveryTasks.length === 0) && (
        <div className="text-center py-12 text-slate-500">
          <p>No discovery tasks yet. Add a new market above to get started.</p>
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: {
    _id: Id<'marketDiscoveryTasks'>;
    regionName: string;
    cityName?: string;
    status: string;
    searchesCompleted?: number;
    searchQueries: string[];
    directoriesFound?: number;
    urlsDiscovered?: number;
    orgsCreated?: number;
    orgsExisted?: number;
    sourcesCreated?: number;
    error?: string;
    createdAt: number;
    completedAt?: number;
  };
  onReset: (taskId: Id<'marketDiscoveryTasks'>) => void;
  showReset?: boolean;
}

function TaskRow({ task, onReset, showReset }: TaskRowProps) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    searching: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    discovering: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    searching: '🔄',
    discovering: '🔍',
    completed: '✓',
    failed: '✗',
  };

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <li className="px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h4 className="font-medium text-slate-900 dark:text-white">{task.regionName}</h4>
            <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[task.status]}`}>
              {statusIcons[task.status]} {task.status}
            </span>
          </div>

          {/* Progress Info */}
          <div className="mt-1 text-sm text-slate-500 flex items-center gap-3">
            {task.searchesCompleted !== undefined && (
              <span>
                {task.searchesCompleted}/{task.searchQueries.length} searches
              </span>
            )}
            {task.directoriesFound !== undefined && <span>{task.directoriesFound} directories</span>}
            {task.urlsDiscovered !== undefined && <span>{task.urlsDiscovered} URLs found</span>}
          </div>

          {/* Results for completed */}
          {task.status === 'completed' && (
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              <span className="text-green-600 dark:text-green-400">{task.orgsCreated} orgs created</span>
              {task.orgsExisted !== undefined && task.orgsExisted > 0 && (
                <span className="ml-2 text-slate-500">• {task.orgsExisted} existed</span>
              )}
              {task.sourcesCreated !== undefined && (
                <span className="ml-2">• {task.sourcesCreated} scraper requests queued</span>
              )}
            </div>
          )}

          {/* Error for failed */}
          {task.error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{task.error}</p>}

          {/* Timestamps */}
          <p className="mt-1 text-xs text-slate-400">
            Created: {timeAgo(task.createdAt)}
            {task.completedAt && ` • Completed: ${timeAgo(task.completedAt)}`}
          </p>
        </div>

        {/* Actions */}
        <div className="ml-4 flex-shrink-0">
          {showReset && (
            <button onClick={() => onReset(task._id)} className="text-sm text-primary hover:text-primary-dark">
              Retry
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
      <p className="text-slate-600 dark:text-slate-400">You don't have permission to access market seeding.</p>
      <Link href="/" className="inline-block mt-4 text-primary hover:underline">
        Return to Home
      </Link>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
