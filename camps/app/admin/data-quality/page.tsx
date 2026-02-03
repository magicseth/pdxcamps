'use client';

import { useState, Suspense, useEffect } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTabs, StatCard } from '../../../components/admin';

export default function DataQualityPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/admin" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Data Quality</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <Suspense fallback={<LoadingState />}>
            <DataQualityContent />
          </Suspense>
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

function LoadingState() {
  return (
    <div className="max-w-6xl mx-auto py-8">
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <span className="sr-only">Loading data quality...</span>
      </div>
    </div>
  );
}

type TabType = 'pending' | 'locations' | 'stats';

function DataQualityContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = (searchParams.get('tab') as TabType) || 'pending';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const isAdmin = useQuery(api.admin.queries.isAdmin);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['pending', 'locations', 'stats'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'pending') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`/admin/data-quality${params.toString() ? '?' + params.toString() : ''}`);
  };

  if (isAdmin === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You don't have permission to access the admin dashboard.
        </p>
        <Link href="/" className="inline-block mt-4 text-blue-600 hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'pending', label: 'Pending Sessions' },
    { id: 'locations', label: 'Locations' },
    { id: 'stats', label: 'Coverage Stats' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Data Quality
        </h2>
        <p className="text-slate-500 mt-1">
          Review pending sessions, fix locations, and monitor coverage
        </p>
      </div>

      {/* Tabs */}
      <AdminTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content - Only render active tab */}
      {activeTab === 'pending' && <PendingSessionsTab />}
      {activeTab === 'locations' && <LocationsTab />}
      {activeTab === 'stats' && <CoverageStatsTab />}
    </div>
  );
}

// ============================================
// PENDING SESSIONS TAB
// ============================================

function PendingSessionsTab() {
  const [statusFilter, setStatusFilter] = useState<'pending_review' | 'manually_fixed' | 'imported' | 'discarded' | undefined>('pending_review');

  const pendingSessions = useQuery(api.scraping.queries.getPendingSessions, {
    status: statusFilter,
  });
  const updateStatus = useMutation(api.scraping.importMutations.updatePendingSessionStatus);

  if (pendingSessions === undefined) {
    return <LoadingState />;
  }

  // Group by source
  const bySource = pendingSessions.reduce((acc, session) => {
    const key = session.sourceName;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(session);
    return acc;
  }, {} as Record<string, typeof pendingSessions>);

  const handleDiscard = async (id: Id<"pendingSessions">) => {
    await updateStatus({ pendingSessionId: id, status: 'discarded' });
  };

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-slate-500">Filter:</label>
        <select
          value={statusFilter ?? 'all'}
          onChange={(e) => setStatusFilter(e.target.value === 'all' ? undefined : e.target.value as typeof statusFilter)}
          className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
        >
          <option value="pending_review">Pending Review</option>
          <option value="manually_fixed">Manually Fixed</option>
          <option value="imported">Imported</option>
          <option value="discarded">Discarded</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Pending" value={pendingSessions.length} />
        <StatCard label="Sources" value={Object.keys(bySource).length} />
        <StatCard
          label="Avg Completeness"
          value={pendingSessions.length > 0
            ? Math.round(pendingSessions.reduce((sum, s) => sum + s.completenessScore, 0) / pendingSessions.length)
            : 0}
          subtext="%"
        />
      </div>

      {/* Sessions by Source */}
      {pendingSessions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500">No pending sessions found.</p>
        </div>
      ) : (
        Object.entries(bySource).map(([sourceName, sessions]) => (
          <div key={sourceName} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {sourceName}
                </h3>
                <span className="text-sm text-slate-500">{sessions.length} sessions</span>
              </div>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {sessions.map((session) => (
                <PendingSessionRow
                  key={session._id}
                  session={session}
                  onDiscard={() => handleDiscard(session._id)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

interface PendingSession {
  _id: Id<"pendingSessions">;
  sourceName: string;
  sourceUrl?: string;
  partialData: {
    name?: string;
    dateRaw?: string;
    priceRaw?: string;
    ageGradeRaw?: string;
    timeRaw?: string;
    location?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    registrationUrl?: string;
  };
  validationErrors: Array<{
    field: string;
    error: string;
    attemptedValue?: string;
  }>;
  completenessScore: number;
  status: 'pending_review' | 'manually_fixed' | 'imported' | 'discarded';
  createdAt: number;
}

function PendingSessionRow({ session, onDiscard }: { session: PendingSession; onDiscard: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { partialData, validationErrors, completenessScore } = session;

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {partialData.name ?? 'Unknown Session'}
            </span>
            <CompleteBadge score={completenessScore} />
            <StatusBadge status={session.status} />
          </div>

          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            {partialData.dateRaw && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Dates:</span>
                <span className={partialData.startDate ? 'text-green-600' : 'text-yellow-600'}>
                  {partialData.startDate ?? partialData.dateRaw}
                </span>
              </div>
            )}
            {partialData.timeRaw && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Times:</span>
                <span className="text-yellow-600">{partialData.timeRaw}</span>
              </div>
            )}
            {partialData.priceRaw && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Price:</span>
                <span className="text-yellow-600">{partialData.priceRaw}</span>
              </div>
            )}
          </div>

          {validationErrors.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-red-600 hover:underline"
              >
                {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''} {expanded ? '(hide)' : '(show)'}
              </button>
              {expanded && (
                <ul className="mt-1 space-y-1">
                  {validationErrors.map((err, i) => (
                    <li key={i} className="text-xs text-red-600">
                      <span className="font-medium">{err.field}:</span> {err.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {session.status === 'pending_review' && (
            <button
              onClick={onDiscard}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              Discard
            </button>
          )}
          {partialData.registrationUrl && (
            <a
              href={partialData.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            >
              View Page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CompleteBadge({ score }: { score: number }) {
  if (score >= 50) {
    return (
      <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
        {score}%
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
      {score}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending_review: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    manually_fixed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    imported: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    discarded: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
  };

  const labels: Record<string, string> = {
    pending_review: 'Pending',
    manually_fixed: 'Fixed',
    imported: 'Imported',
    discarded: 'Discarded',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status] ?? styles.pending_review}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ============================================
// LOCATIONS TAB
// ============================================

function LocationsTab() {
  const locationsData = useQuery(api.admin.queries.getLocationsNeedingFixes);
  const updateLocation = useMutation(api.admin.mutations.updateLocation);
  const geocodeLocation = useAction(api.admin.mutations.geocodeLocation);
  const bulkGeocode = useAction(api.admin.mutations.bulkGeocodeLocations);

  const [editingId, setEditingId] = useState<Id<'locations'> | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    latitude: '',
    longitude: '',
  });
  const [geocodingId, setGeocodingId] = useState<Id<'locations'> | null>(null);
  const [bulkGeocoding, setBulkGeocoding] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
  } | null>(null);

  if (locationsData === undefined || locationsData === null) {
    return <LoadingState />;
  }

  const { locations, summary } = locationsData;

  const startEdit = (location: (typeof locations)[number]) => {
    setEditingId(location._id);
    setEditForm({
      name: location.name,
      street: location.address.street,
      city: location.address.city,
      state: location.address.state,
      zip: location.address.zip,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', street: '', city: '', state: '', zip: '', latitude: '', longitude: '' });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateLocation({
      locationId: editingId,
      name: editForm.name,
      street: editForm.street,
      city: editForm.city,
      state: editForm.state,
      zip: editForm.zip,
      latitude: parseFloat(editForm.latitude) || undefined,
      longitude: parseFloat(editForm.longitude) || undefined,
    });
    cancelEdit();
  };

  const handleGeocode = async (locationId: Id<'locations'>) => {
    setGeocodingId(locationId);
    try {
      const result = await geocodeLocation({ locationId });
      if (!result.success) {
        alert(`Geocoding failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeocodingId(null);
    }
  };

  const handleBulkGeocode = async () => {
    setBulkGeocoding(true);
    setBulkResult(null);
    try {
      const result = await bulkGeocode({ limit: 10 });
      setBulkResult(result);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setBulkGeocoding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Locations" value={summary.total} />
        <StatCard label="Needing Fixes" value={summary.needingFixes} variant={summary.needingFixes > 0 ? 'error' : 'default'} />
        <StatCard label="Missing Street" value={summary.withPlaceholderStreet} variant={summary.withPlaceholderStreet > 0 ? 'warning' : 'default'} />
        <StatCard label="Default Coords" value={summary.withDefaultCoords} variant={summary.withDefaultCoords > 0 ? 'warning' : 'default'} />
      </div>

      {/* Bulk Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Bulk Actions</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handleBulkGeocode}
            disabled={bulkGeocoding || summary.needingFixes === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkGeocoding ? 'Geocoding...' : 'Geocode Next 10 Locations'}
          </button>
          <span className="text-sm text-slate-500">
            Uses OpenCage API (2,500 free/day)
          </span>
        </div>
        {bulkResult && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Results:</span>{' '}
              {bulkResult.succeeded} succeeded, {bulkResult.failed} failed
            </div>
          </div>
        )}
      </div>

      {/* Locations List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Locations Needing Fixes ({locations.length})
          </h3>
        </div>

        {locations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            All locations have valid addresses and coordinates!
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {locations.slice(0, 20).map((location) => (
              <div key={location._id} className="p-4">
                {editingId === location._id ? (
                  <LocationEditForm
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onGeocode={() => handleGeocode(location._id)}
                    geocoding={geocodingId === location._id}
                  />
                ) : (
                  <LocationDisplay
                    location={location}
                    onEdit={() => startEdit(location)}
                    onGeocode={() => handleGeocode(location._id)}
                    geocoding={geocodingId === location._id}
                  />
                )}
              </div>
            ))}
            {locations.length > 20 && (
              <div className="p-4 text-center text-slate-500 text-sm">
                Showing 20 of {locations.length} locations
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationEditForm({
  editForm,
  setEditForm,
  onSave,
  onCancel,
  onGeocode,
  geocoding,
}: {
  editForm: any;
  setEditForm: (form: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onGeocode: () => void;
  geocoding: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Street</label>
          <input
            type="text"
            value={editForm.street}
            onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-white text-sm rounded-lg">
          Cancel
        </button>
        <button onClick={onGeocode} disabled={geocoding} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg disabled:opacity-50">
          {geocoding ? '...' : 'Geocode'}
        </button>
      </div>
    </div>
  );
}

function LocationDisplay({
  location,
  onEdit,
  onGeocode,
  geocoding,
}: {
  location: any;
  onEdit: () => void;
  onGeocode: () => void;
  geocoding: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-slate-900 dark:text-white">{location.name}</h4>
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            {location.sessionCount} sessions
          </span>
        </div>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {location.address.street === 'TBD' ? (
            <span className="text-red-500">No street address</span>
          ) : (
            location.address.street
          )}
          {', '}
          {location.address.city}, {location.address.state}
        </div>
        <div className="mt-2 flex gap-2">
          {location.issues.hasPlaceholderStreet && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
              Missing Street
            </span>
          )}
          {location.issues.hasDefaultCoords && (
            <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
              Default Coords
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onGeocode}
          disabled={geocoding}
          className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-lg disabled:opacity-50"
        >
          {geocoding ? '...' : 'Geocode'}
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ============================================
// COVERAGE STATS TAB
// ============================================

function CoverageStatsTab() {
  const coverageStats = useQuery(api.scraping.coverage.getCoverageStats);

  if (coverageStats === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
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

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="font-semibold mb-4">Coverage Summary</h3>
        <p className="text-slate-600 dark:text-slate-400">
          {coverageStats.sourcesWithData} of {coverageStats.activeSources} active sources are producing data.
          {coverageStats.dataSuccessRate >= 80
            ? ' Data coverage is healthy.'
            : coverageStats.dataSuccessRate >= 50
            ? ' Some sources need attention.'
            : ' Many sources need fixing.'}
        </p>
        <div className="mt-4">
          <Link href="/admin/sources?tab=failing" className="text-blue-600 hover:underline text-sm">
            View failing sources &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
