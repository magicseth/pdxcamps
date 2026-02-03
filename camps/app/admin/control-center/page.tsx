'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTabs, StatCard } from '../../../components/admin';

export default function ControlCenterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ControlCenterContent />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="animate-pulse">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </header>
      <main className="max-w-full mx-auto px-4 py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-4">
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
          <div className="flex gap-4 h-[calc(100vh-280px)]">
            <div className="w-2/5 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            <div className="w-3/5 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          </div>
          <span className="sr-only">Loading control center...</span>
        </div>
      </main>
    </div>
  );
}

type TabFilter = 'all' | 'healthy' | 'failing' | 'nodata';

function ControlCenterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial values from URL
  const initialTab = (searchParams.get('tab') as TabFilter) || 'all';
  const initialSourceId = searchParams.get('source') || null;
  const initialSearch = searchParams.get('search') || '';
  const initialCityId = searchParams.get('city') || null;

  const [activeTab, setActiveTab] = useState<TabFilter>(initialTab);
  const [selectedSourceId, setSelectedSourceId] = useState<Id<'scrapeSources'> | null>(
    initialSourceId as Id<'scrapeSources'> | null
  );
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [triggeringSource, setTriggeringSource] = useState<Id<'scrapeSources'> | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<Id<'cities'> | null>(
    initialCityId as Id<'cities'> | null
  );

  // Query cities for filter
  const cities = useQuery(api.cities.queries.listActiveCities, {});

  // Query sources
  const filteredData = useQuery(api.scraping.queries.listSourcesFiltered, {
    filter: activeTab === 'healthy' ? 'active' : activeTab,
    limit: 100,
    cityId: selectedCityId ?? undefined,
  });

  // Query daemon tasks (scraper development requests)
  const daemonTasks = useQuery(api.scraping.development.listRequests, {
    limit: 50,
  });

  // Query selected source detail
  const selectedSource = useQuery(
    api.scraping.queries.getScrapeSource,
    selectedSourceId ? { sourceId: selectedSourceId } : 'skip'
  );

  // Query sessions for selected source
  const sourceSessions = useQuery(
    api.scraping.queries.getSessionsBySource,
    selectedSourceId ? { sourceId: selectedSourceId, limit: 10 } : 'skip'
  );

  // Query data quality issues
  const dataQualityIssues = useQuery(
    api.scraping.queries.getSourceDataQualityIssues,
    selectedSourceId ? { sourceId: selectedSourceId } : 'skip'
  );

  // Query pending sessions count
  const pendingSessions = useQuery(api.scraping.queries.getPendingSessions, {
    status: 'pending_review',
    limit: 1000,
  });

  // Mutations
  const toggleSourceActive = useMutation(api.scraping.mutations.toggleSourceActive);
  const createScrapeJob = useMutation(api.scraping.mutations.createScrapeJob);
  const updateSourceDetails = useMutation(api.scraping.mutations.updateSourceDetails);
  const deleteSourceWithData = useMutation(api.scraping.mutations.deleteSourceWithData);

  // Update URL when state changes
  const updateUrl = (tab: TabFilter, sourceId: string | null, search: string, cityId: string | null) => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('tab', tab);
    if (sourceId) params.set('source', sourceId);
    if (search) params.set('search', search);
    if (cityId) params.set('city', cityId);
    router.push(`/admin/control-center${params.toString() ? '?' + params.toString() : ''}`);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabFilter);
    updateUrl(tab as TabFilter, selectedSourceId, searchQuery, selectedCityId);
  };

  const handleSourceSelect = (sourceId: Id<'scrapeSources'>) => {
    setSelectedSourceId(sourceId);
    updateUrl(activeTab, sourceId, searchQuery, selectedCityId);
  };

  const handleSearchChange = (search: string) => {
    setSearchQuery(search);
  };

  const handleCityChange = (cityId: string | null) => {
    setSelectedCityId(cityId as Id<'cities'> | null);
    setSelectedSourceId(null); // Clear selection when changing city
    updateUrl(activeTab, null, searchQuery, cityId);
  };

  // Sync with URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') as TabFilter;
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const city = searchParams.get('city');

    if (tab && ['all', 'healthy', 'failing', 'nodata'].includes(tab)) {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab('all');
    }

    if (source) {
      setSelectedSourceId(source as Id<'scrapeSources'>);
    }

    if (search !== null) {
      setSearchQuery(search);
    }

    if (city) {
      setSelectedCityId(city as Id<'cities'>);
    } else {
      setSelectedCityId(null);
    }
  }, [searchParams]);

  const handleTriggerScrape = async (sourceId: Id<'scrapeSources'>) => {
    try {
      setTriggeringSource(sourceId);
      await createScrapeJob({
        sourceId,
        triggeredBy: 'admin-control-center',
      });
    } catch (error) {
      console.error('Failed to trigger scrape:', error);
      alert(error instanceof Error ? error.message : 'Failed to trigger scrape');
    } finally {
      setTriggeringSource(null);
    }
  };

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

  // Stats from query
  const stats = filteredData?.counts ?? { all: 0, active: 0, failing: 0, nodata: 0 };
  const pendingReviewCount = pendingSessions?.length ?? 0;

  // Calculate total sessions across all sources
  const totalSessions = filteredData?.sources?.reduce(
    (sum, s) => sum + (s.sessionCount ?? 0), 0
  ) ?? 0;

  // Filter sources by search
  const filteredSources = (filteredData?.sources ?? []).filter(source => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      source.name.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query) ||
      source.organizationName?.toLowerCase().includes(query)
    );
  });

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

  const tabs = [
    { id: 'all', label: 'All', count: stats.all },
    { id: 'healthy', label: 'Healthy', count: stats.active },
    { id: 'failing', label: 'Failing', count: stats.failing },
    { id: 'nodata', label: 'No Data', count: stats.nodata },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-700 mb-1 block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                &larr; Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Control Center
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* City Filter */}
              <select
                value={selectedCityId ?? ''}
                onChange={(e) => handleCityChange(e.target.value || null)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Markets</option>
                {cities?.map((city) => (
                  <option key={city._id} value={city._id}>
                    {city.name}
                  </option>
                ))}
              </select>
              {/* Search */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sources..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 pr-4 py-2 w-64 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Link
                href="/admin/growth"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                + Add Source
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <StatCard label="Sources" value={stats.all} small />
          <StatCard label="Healthy" value={stats.active} variant="success" small />
          <StatCard label="Failing" value={stats.failing} variant={stats.failing > 0 ? 'error' : 'default'} small />
          <StatCard label="Sessions" value={totalSessions} variant="info" small />
          <StatCard
            label="Review"
            value={pendingReviewCount}
            variant={pendingReviewCount > 0 ? 'warning' : 'default'}
            href="/admin/data-quality"
            small
          />
        </div>

        {/* Daemon Tasks */}
        <DaemonTasksPanel tasks={daemonTasks ?? []} />

        {/* Tabs */}
        <div className="mb-4">
          <AdminTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* Master-Detail Layout */}
        <div className="flex gap-4" style={{ height: 'calc(100vh - 300px)' }}>
          {/* Source List Panel (40%) */}
          <div className="w-2/5 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {filteredSources.length} source{filteredSources.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredData === undefined ? (
                <div role="status" aria-live="polite" className="p-4 space-y-3 animate-pulse motion-reduce:animate-none">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
                  ))}
                  <span className="sr-only">Loading sources...</span>
                </div>
              ) : filteredSources.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No sources match your search.' : 'No sources found.'}
                </div>
              ) : (
                filteredSources.map((source) => {
                  const health = getHealthIndicator(source.scraperHealth);
                  const isSelected = selectedSourceId === source._id;
                  return (
                    <div
                      key={source._id}
                      onClick={() => handleSourceSelect(source._id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSourceSelect(source._id);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Logo */}
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
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {source.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {new URL(source.url).hostname}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  health.color === 'green' ? 'bg-green-500' :
                                  health.color === 'yellow' ? 'bg-yellow-500' :
                                  health.color === 'orange' ? 'bg-orange-500' :
                                  health.color === 'red' ? 'bg-red-500' :
                                  'bg-slate-400'
                                }`}
                              />
                              <span className="text-xs text-slate-600 dark:text-slate-400">{health.label}</span>
                            </div>
                            <span className="text-xs text-slate-500">
                              {source.sessionCount ?? 0} sessions
                            </span>
                            <span className="text-xs text-slate-500">
                              {source.lastScrapedAt ? formatTimestamp(source.lastScrapedAt) : 'Never'}
                            </span>
                          </div>
                        </div>
                        {/* Quick trigger button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerScrape(source._id);
                          }}
                          disabled={triggeringSource === source._id || !source.isActive}
                          className={`px-2 py-1 text-xs rounded ${
                            triggeringSource === source._id || !source.isActive
                              ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 cursor-not-allowed'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                          }`}
                          title={!source.isActive ? 'Source is inactive' : 'Trigger scrape'}
                        >
                          {triggeringSource === source._id ? (
                            <SpinnerIcon />
                          ) : (
                            <RefreshIcon className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail Panel (60%) */}
          <div className="w-3/5 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
            {!selectedSourceId ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <DatabaseIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a source to view details</p>
                </div>
              </div>
            ) : selectedSource === undefined ? (
              <div role="status" aria-live="polite" className="p-6 animate-pulse motion-reduce:animate-none space-y-4">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <span className="sr-only">Loading source details...</span>
              </div>
            ) : selectedSource === null ? (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                Source not found
              </div>
            ) : (
              <SourceDetailPanel
                source={selectedSource}
                sessions={sourceSessions?.sessions ?? []}
                sessionCount={sourceSessions?.totalCount ?? 0}
                dataQualityIssues={dataQualityIssues ?? []}
                onTriggerScrape={handleTriggerScrape}
                onToggleActive={handleToggleActive}
                onUpdateDetails={updateSourceDetails}
                onDelete={deleteSourceWithData}
                isTriggeringScrape={triggeringSource === selectedSource._id}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Session type with all details
interface SessionDetail {
  _id: string;
  campName: string;
  campCategories?: string[];
  startDate: string;
  endDate: string;
  dropOffTime: { hour: number; minute: number };
  pickUpTime: { hour: number; minute: number };
  price: number;
  currency: string;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  ageRequirements?: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
  status: 'draft' | 'active' | 'sold_out' | 'cancelled' | 'completed';
  externalRegistrationUrl?: string;
  locationName?: string;
  completenessScore?: number;
  missingFields?: string[];
}

// Source Detail Panel Component
interface SourceDetailPanelProps {
  source: NonNullable<ReturnType<typeof useQuery<typeof api.scraping.queries.getScrapeSource>>>;
  sessions: SessionDetail[];
  sessionCount: number;
  dataQualityIssues: { type: string; count: number; sessionIds: string[] }[];
  onTriggerScrape: (sourceId: Id<'scrapeSources'>) => Promise<void>;
  onToggleActive: (sourceId: Id<'scrapeSources'>, currentActive: boolean) => Promise<void>;
  onUpdateDetails: (args: { sourceId: Id<'scrapeSources'>; name?: string; url?: string }) => Promise<Id<'scrapeSources'>>;
  onDelete: (args: { sourceId: Id<'scrapeSources'>; deleteJobs?: boolean; deleteSessions?: boolean }) => Promise<{ deleted: boolean }>;
  isTriggeringScrape: boolean;
}

function SourceDetailPanel({
  source,
  sessions,
  sessionCount,
  dataQualityIssues,
  onTriggerScrape,
  onToggleActive,
  onUpdateDetails,
  onDelete,
  isTriggeringScrape,
}: SourceDetailPanelProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editName, setEditName] = useState(source.name);
  const [editUrl, setEditUrl] = useState(source.url);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const submitFeedback = useMutation(api.scraping.development.submitScraperFeedbackFromSource);
  const refreshLogo = useMutation(api.scraping.mutations.refreshSourceLogo);

  const health = getHealthIndicatorFn(source.scraperHealth);

  const handleSaveName = async () => {
    if (editName !== source.name) {
      await onUpdateDetails({ sourceId: source._id, name: editName });
    }
    setIsEditingName(false);
  };

  const handleSaveUrl = async () => {
    if (editUrl !== source.url) {
      await onUpdateDetails({ sourceId: source._id, url: editUrl });
    }
    setIsEditingUrl(false);
  };

  const handleRefreshLogo = async () => {
    try {
      await refreshLogo({ sourceId: source._id });
    } catch (error) {
      console.error('Failed to refresh logo:', error);
      alert(error instanceof Error ? error.message : 'Failed to refresh logo');
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete({ sourceId: source._id, deleteJobs: true, deleteSessions: false });
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete source:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete source');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;

    setIsSubmittingFeedback(true);
    try {
      await submitFeedback({
        sourceId: source._id,
        feedback: feedbackText,
        requestRescan: true,
      });
      setFeedbackText('');
      alert('Feedback submitted successfully');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Editable Name */}
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xl font-bold px-2 py-1 border border-blue-500 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setEditName(source.name);
                      setIsEditingName(false);
                    }
                  }}
                />
                <button onClick={handleSaveName} className="text-blue-600 hover:text-blue-700">
                  <CheckIcon className="w-5 h-5" />
                </button>
                <button onClick={() => { setEditName(source.name); setIsEditingName(false); }} className="text-slate-400 hover:text-slate-600">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h2
                className="text-xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 inline-flex items-center gap-2"
                onClick={() => setIsEditingName(true)}
              >
                {source.name}
                <PencilIcon className="w-4 h-4 opacity-0 group-hover:opacity-100" />
              </h2>
            )}

            {/* Editable URL */}
            {isEditingUrl ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="text-sm px-2 py-1 border border-blue-500 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-md"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveUrl();
                    if (e.key === 'Escape') {
                      setEditUrl(source.url);
                      setIsEditingUrl(false);
                    }
                  }}
                />
                <button onClick={handleSaveUrl} className="text-blue-600 hover:text-blue-700">
                  <CheckIcon className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditUrl(source.url); setIsEditingUrl(false); }} className="text-slate-400 hover:text-slate-600">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1 group"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  setIsEditingUrl(true);
                }}
              >
                {source.url}
                <ExternalLinkIcon className="w-3 h-3 opacity-0 group-hover:opacity-100" />
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshLogo}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
              title="Refresh logo"
            >
              Refresh Logo
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Health Section */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Health Status</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    health.color === 'green' ? 'bg-green-500' :
                    health.color === 'yellow' ? 'bg-yellow-500' :
                    health.color === 'orange' ? 'bg-orange-500' :
                    health.color === 'red' ? 'bg-red-500' :
                    'bg-slate-400'
                  }`}
                />
                <span className="font-medium text-slate-900 dark:text-white">{health.label}</span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {Math.round(source.scraperHealth.successRate * 100)}% success rate
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Last: {source.lastScrapedAt ? formatTimestamp(source.lastScrapedAt) : 'Never'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleActive(source._id, source.isActive)}
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
              <button
                onClick={() => onTriggerScrape(source._id)}
                disabled={isTriggeringScrape || !source.isActive}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  isTriggeringScrape || !source.isActive
                    ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isTriggeringScrape ? (
                  <span className="flex items-center gap-1">
                    <SpinnerIcon />
                    Running...
                  </span>
                ) : (
                  'Trigger Scrape Now'
                )}
              </button>
            </div>
          </div>
          {source.scraperHealth.lastError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Last error: {source.scraperHealth.lastError}
            </p>
          )}
        </div>

        {/* Sessions Preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Sessions ({sessionCount})
            </h3>
            <Link
              href={`/admin/sources/${source._id}`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all sessions &rarr;
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No sessions found</p>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 10).map((session) => (
                <SessionDetailCard key={session._id} session={session} />
              ))}
              {sessionCount > 10 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  +{sessionCount - 10} more sessions
                </p>
              )}
            </div>
          )}
        </div>

        {/* Data Quality Issues */}
        {dataQualityIssues && dataQualityIssues.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Data Issues
            </h3>
            <div className="space-y-2">
              {dataQualityIssues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                >
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    {issue.count} {issue.type.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scraper Feedback */}
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Scraper Feedback
          </h3>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Describe issues with the scraper or data quality..."
            className="w-full h-24 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || isSubmittingFeedback}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                !feedbackText.trim() || isSubmittingFeedback
                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <span className="text-xs text-slate-500">
              Creates a development request for the scraper daemon
            </span>
          </div>
        </div>

        {/* Recent Jobs */}
        {source.recentJobs && source.recentJobs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Recent Jobs
            </h3>
            <div className="space-y-2">
              {source.recentJobs.map((job) => (
                <div
                  key={job._id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        job.status === 'completed' ? 'bg-green-500' :
                        job.status === 'running' ? 'bg-blue-500 animate-pulse' :
                        job.status === 'pending' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                      {job.status}
                    </span>
                    {job.sessionsFound !== undefined && (
                      <span className="text-xs text-slate-500">
                        {job.sessionsFound} sessions
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {job.completedAt ? formatTimestamp(job.completedAt) :
                     job.startedAt ? formatTimestamp(job.startedAt) : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Delete Source?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              This will delete the source &quot;{source.name}&quot; and all associated scrape jobs.
              Sessions will be preserved but unlinked from this source.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Delete Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Session Detail Card Component
function SessionDetailCard({ session }: { session: SessionDetail }) {
  const formatTime = (time: { hour: number; minute: number }) => {
    const h = time.hour % 12 || 12;
    const m = time.minute.toString().padStart(2, '0');
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  };

  const formatAgeRange = (req?: SessionDetail['ageRequirements']) => {
    if (!req) return null;
    const parts: string[] = [];
    if (req.minAge !== undefined || req.maxAge !== undefined) {
      if (req.minAge !== undefined && req.maxAge !== undefined) {
        parts.push(`Ages ${req.minAge}-${req.maxAge}`);
      } else if (req.minAge !== undefined) {
        parts.push(`Ages ${req.minAge}+`);
      } else if (req.maxAge !== undefined) {
        parts.push(`Ages up to ${req.maxAge}`);
      }
    }
    if (req.minGrade !== undefined || req.maxGrade !== undefined) {
      if (req.minGrade !== undefined && req.maxGrade !== undefined) {
        parts.push(`Grades ${req.minGrade}-${req.maxGrade}`);
      } else if (req.minGrade !== undefined) {
        parts.push(`Grade ${req.minGrade}+`);
      } else if (req.maxGrade !== undefined) {
        parts.push(`Up to grade ${req.maxGrade}`);
      }
    }
    return parts.length > 0 ? parts.join(' / ') : null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'sold_out': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'cancelled': return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
      case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const ageRange = formatAgeRange(session.ageRequirements);
  const hasAge = ageRange !== null;
  const spotsLeft = session.capacity - session.enrolledCount;
  const availability = session.capacity > 0
    ? `${spotsLeft}/${session.capacity} spots`
    : 'Unknown capacity';

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header row: Name + Status + Price */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {session.campName}
          </p>
          {session.campCategories && session.campCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {session.campCategories.slice(0, 3).map((cat, i) => (
                <span key={i} className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusBadge(session.status)}`}>
            {session.status}
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            ${(session.price / 100).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {/* Dates */}
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">
            {session.startDate} → {session.endDate}
          </span>
        </div>

        {/* Times */}
        <div className="flex items-center gap-1.5">
          <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">
            {formatTime(session.dropOffTime)} - {formatTime(session.pickUpTime)}
          </span>
        </div>

        {/* Age/Grade */}
        <div className="flex items-center gap-1.5">
          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
          {hasAge ? (
            <span className="text-slate-600 dark:text-slate-400">{ageRange}</span>
          ) : (
            <span className="text-red-500 dark:text-red-400 font-medium">Missing age/grade</span>
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center gap-1.5">
          <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
          <span className={`${spotsLeft <= 5 && spotsLeft > 0 ? 'text-orange-600 dark:text-orange-400' : spotsLeft === 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
            {availability}
            {session.waitlistCount > 0 && ` (${session.waitlistCount} waitlist)`}
          </span>
        </div>

        {/* Location */}
        {session.locationName && (
          <div className="flex items-center gap-1.5 col-span-2">
            <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400 truncate">{session.locationName}</span>
          </div>
        )}

        {/* Registration URL */}
        {session.externalRegistrationUrl ? (
          <div className="flex items-center gap-1.5 col-span-2">
            <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
            <a
              href={session.externalRegistrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 truncate"
            >
              {session.externalRegistrationUrl}
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 col-span-2">
            <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-red-500 dark:text-red-400 font-medium">Missing registration URL</span>
          </div>
        )}
      </div>

      {/* Completeness score if available */}
      {session.completenessScore !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Data completeness:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    session.completenessScore >= 80 ? 'bg-green-500' :
                    session.completenessScore >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${session.completenessScore}%` }}
                />
              </div>
              <span className={`font-medium ${
                session.completenessScore >= 80 ? 'text-green-600 dark:text-green-400' :
                session.completenessScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {session.completenessScore}%
              </span>
            </div>
          </div>
          {session.missingFields && session.missingFields.length > 0 && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              Missing: {session.missingFields.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Daemon Tasks Panel Component
interface DaemonTask {
  _id: string;
  sourceName: string;
  sourceUrl: string;
  status: 'pending' | 'in_progress' | 'testing' | 'needs_feedback' | 'completed' | 'failed';
  requestedAt: number;
  lastTestRun?: number;
  lastTestSessionsFound?: number;
  lastTestError?: string;
  lastTestSampleData?: string;
  testRetryCount?: number;
  cityName?: string;
  claudeSessionStartedAt?: number;
}

function DaemonTasksPanel({ tasks }: { tasks: DaemonTask[] }) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const activeTasks = tasks.filter(t =>
    t.status === 'pending' || t.status === 'in_progress' || t.status === 'testing' || t.status === 'needs_feedback'
  );

  if (activeTasks.length === 0) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'testing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'needs_feedback': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_progress': return 'Working';
      case 'testing': return 'Testing';
      case 'needs_feedback': return 'Review';
      default: return status;
    }
  };

  const parseSampleData = (data?: string): { name: string; startDate?: string; price?: number }[] => {
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="mb-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <CpuIcon className="w-4 h-4" />
          Daemon Tasks ({activeTasks.length})
        </h3>
        <Link
          href="/admin/development"
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          View all &rarr;
        </Link>
      </div>
      <div className="space-y-2">
        {activeTasks.slice(0, 6).map((task) => {
          const isExpanded = expandedTask === task._id;
          const sampleData = parseSampleData(task.lastTestSampleData);
          const lastRan = task.lastTestRun || task.claudeSessionStartedAt;

          return (
            <div
              key={task._id}
              className="bg-slate-50 dark:bg-slate-900/50 rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50"
                onClick={() => setExpandedTask(isExpanded ? null : task._id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {task.status === 'in_progress' && <SpinnerIcon />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {task.sourceName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {task.cityName && <span>{task.cityName}</span>}
                      {lastRan && <span>{formatTimestamp(lastRan)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {task.lastTestSessionsFound !== undefined && task.lastTestSessionsFound > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">
                      {task.lastTestSessionsFound} sessions
                    </span>
                  )}
                  {task.testRetryCount !== undefined && task.testRetryCount > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                      Retry {task.testRetryCount}/3
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                  <ChevronIcon className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">URL:</span>
                    <a href={task.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 truncate">
                      {task.sourceUrl}
                    </a>
                  </div>
                  {task.lastTestError && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300">
                      {task.lastTestError}
                    </div>
                  )}
                  {sampleData.length > 0 && (
                    <div>
                      <p className="text-slate-500 mb-1">Sample data:</p>
                      <div className="space-y-1">
                        {sampleData.map((item, i) => (
                          <div key={i} className="p-1.5 bg-white dark:bg-slate-800 rounded flex justify-between">
                            <span className="truncate">{item.name}</span>
                            <span className="text-slate-500 flex-shrink-0 ml-2">
                              {item.startDate && item.startDate}
                              {item.price && ` $${(item.price / 100).toFixed(0)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {activeTasks.length > 6 && (
          <div className="text-center text-sm text-slate-500 py-1">
            +{activeTasks.length - 6} more tasks
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function (duplicated to avoid circular dependency)
function getHealthIndicatorFn(health: {
  consecutiveFailures: number;
  successRate: number;
  needsRegeneration: boolean;
}) {
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
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin motion-reduce:animate-none h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}
