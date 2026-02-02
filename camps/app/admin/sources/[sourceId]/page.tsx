'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function SourceDetailPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/admin" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Source Detail</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <SourceDetailContent />
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

function SourceDetailContent() {
  const params = useParams();
  const sourceId = params.sourceId as string;

  const [parsingNotes, setParsingNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [rescanReason, setRescanReason] = useState('');
  const [flaggingRescan, setFlaggingRescan] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [newUrlLabel, setNewUrlLabel] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const source = useQuery(api.scraping.queries.getScrapeSource, {
    sourceId: sourceId as Id<"scrapeSources">,
  });
  const sessions = useQuery(api.scraping.queries.getSessionsBySource, {
    sourceId: sourceId as Id<"scrapeSources">,
    limit: 20,
  });

  const updateNotes = useMutation(api.scraping.mutations.updateParsingNotes);
  const flagForRescan = useMutation(api.scraping.mutations.flagForRescan);
  const addAdditionalUrl = useMutation(api.scraping.mutations.addAdditionalUrl);
  const removeAdditionalUrl = useMutation(api.scraping.mutations.removeAdditionalUrl);

  // Load notes when source loads
  if (source && !notesLoaded) {
    setParsingNotes(source.parsingNotes || '');
    setNotesLoaded(true);
  }

  if (isAdmin === undefined || source === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
          <span className="sr-only">Loading source details...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <Link href="/" className="inline-block mt-4 text-blue-600 hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  if (source === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Source Not Found</h2>
        <Link href="/admin" className="inline-block mt-4 text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateNotes({
        sourceId: sourceId as Id<"scrapeSources">,
        parsingNotes,
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleFlagRescan = async () => {
    setFlaggingRescan(true);
    try {
      await flagForRescan({
        sourceId: sourceId as Id<"scrapeSources">,
        reason: rescanReason || undefined,
      });
      setRescanReason('');
    } finally {
      setFlaggingRescan(false);
    }
  };

  const handleAddUrl = async () => {
    if (!newUrlInput) return;
    setAddingUrl(true);
    try {
      await addAdditionalUrl({
        sourceId: sourceId as Id<"scrapeSources">,
        url: newUrlInput,
        label: newUrlLabel || undefined,
      });
      setNewUrlInput('');
      setNewUrlLabel('');
    } finally {
      setAddingUrl(false);
    }
  };

  const handleRemoveUrl = async (url: string) => {
    await removeAdditionalUrl({
      sourceId: sourceId as Id<"scrapeSources">,
      url,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/admin/sources" className="hover:underline">Sources</Link>
        <span>/</span>
        <span>{source.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {source.name}
            </h1>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-1 inline-block"
            >
              {source.url}
            </a>
          </div>
          <div className="flex items-center gap-2">
            {source.isActive ? (
              <span className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                Active
              </span>
            ) : (
              <span className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                Inactive
              </span>
            )}
            {source.needsRescan && (
              <span className="px-3 py-1 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
                Rescan Requested
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <StatItem label="Sessions" value={source.sessionCount ?? 0} />
          <StatItem label="Active" value={source.activeSessionCount ?? 0} />
          <StatItem
            label="Quality"
            value={source.dataQualityScore !== undefined ? `${source.dataQualityScore}%` : '-'}
            variant={
              source.qualityTier === 'high' ? 'success' :
              source.qualityTier === 'medium' ? 'warning' :
              source.qualityTier === 'low' ? 'error' : 'default'
            }
          />
          <StatItem label="Success Rate" value={`${Math.round(source.scraperHealth.successRate * 100)}%`} />
          <StatItem label="Total Runs" value={source.scraperHealth.totalRuns} />
        </div>

        {/* Organization */}
        {source.organization && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">Organization</p>
            <p className="font-medium">{source.organization.name}</p>
          </div>
        )}
      </div>

      {/* URLs Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">URLs to Scrape</h2>
        <p className="text-sm text-slate-500 mb-4">
          Add multiple URLs for sites with different entry points (seasons, locations, program types).
        </p>

        {/* Primary URL */}
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Primary URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded text-sm truncate">
              {source.url}
            </code>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm text-blue-600 hover:underline"
            >
              Open
            </a>
          </div>
        </div>

        {/* Additional URLs */}
        {source.additionalUrls && source.additionalUrls.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Additional URLs</p>
            {source.additionalUrls.map((urlInfo: { url: string; label?: string }) => (
              <div key={urlInfo.url} className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded text-sm truncate">
                  {urlInfo.label && <span className="text-slate-500">[{urlInfo.label}] </span>}
                  {urlInfo.url}
                </code>
                <a
                  href={urlInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm text-blue-600 hover:underline"
                >
                  Open
                </a>
                <button
                  onClick={() => handleRemoveUrl(urlInfo.url)}
                  className="px-3 py-2 text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add URL Form */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Add URL</p>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="text"
              value={newUrlLabel}
              onChange={(e) => setNewUrlLabel(e.target.value)}
              className="w-full md:w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-sm"
              placeholder="Label (optional)"
            />
            <input
              type="url"
              value={newUrlInput}
              onChange={(e) => setNewUrlInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-sm"
              placeholder="https://example.com/camps?season=2026"
            />
            <button
              onClick={handleAddUrl}
              disabled={addingUrl || !newUrlInput}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {addingUrl ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Re-scan Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Request Re-scan</h2>
        <p className="text-sm text-slate-500 mb-4">
          Flag this source for priority re-scraping. The next scrape will use any parsing notes you've added.
        </p>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={rescanReason}
              onChange={(e) => setRescanReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900"
              placeholder="e.g., Site updated, trying new parsing approach"
            />
          </div>
          <button
            onClick={handleFlagRescan}
            disabled={flaggingRescan || source.needsRescan}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
          >
            {flaggingRescan ? 'Flagging...' : source.needsRescan ? 'Already Flagged' : 'Flag for Re-scan'}
          </button>
        </div>
        {source.needsRescan && source.rescanReason && (
          <p className="mt-2 text-sm text-orange-600">
            Flagged: {source.rescanReason}
          </p>
        )}
      </div>

      {/* Parsing Notes */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Parsing Notes</h2>
            <p className="text-sm text-slate-500">
              Add notes on how to parse this source. These will be used by the scraper on the next run.
            </p>
          </div>
          {source.parsingNotesUpdatedAt && (
            <p className="text-xs text-slate-400">
              Last updated: {new Date(source.parsingNotesUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <textarea
          value={parsingNotes}
          onChange={(e) => setParsingNotes(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 min-h-[150px] font-mono text-sm"
          placeholder={`Example notes:
- Dates are in format "June 10-14, 2025"
- Times are shown as "9:00 AM - 3:00 PM"
- Prices are per week, not per day
- Age ranges are in the session title
- Location is shared across all sessions: "Main Campus"
- The registration URL is in a "Register" button`}
        />
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingNotes ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>

      {/* Scraper Code */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Scraper Configuration</h2>

        {source.scraperModule && (
          <div className="mb-4">
            <p className="text-sm text-slate-500">Scraper Module</p>
            <p className="font-mono bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded mt-1">
              {source.scraperModule}
            </p>
          </div>
        )}

        {source.scraperCode && (
          <div>
            <p className="text-sm text-slate-500 mb-2">Scraper Code</p>
            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md overflow-auto max-h-96 text-xs font-mono">
              {source.scraperCode}
            </pre>
          </div>
        )}

        {!source.scraperModule && !source.scraperCode && (
          <div className="text-center py-8 text-slate-500">
            <p>No scraper configured. Using Stagehand AI extraction.</p>
            <p className="text-sm mt-2">
              Stagehand will use your parsing notes to guide extraction.
            </p>
          </div>
        )}

        {/* Scraper Config (legacy) */}
        {source.scraperConfig && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
              View Legacy Config
            </summary>
            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md overflow-auto max-h-48 text-xs font-mono mt-2">
              {JSON.stringify(source.scraperConfig, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Recent Jobs */}
      {source.recentJobs && source.recentJobs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold">Recent Jobs</h2>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {source.recentJobs.map((job) => (
              <li key={job._id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <JobStatusBadge status={job.status} />
                    <span className="text-sm text-slate-500">
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : 'In progress'}
                    </span>
                  </div>
                  {job.sessionsFound !== undefined && (
                    <p className="text-sm text-slate-500 mt-1">
                      Found {job.sessionsFound} sessions
                    </p>
                  )}
                  {job.errorMessage && (
                    <p className="text-sm text-red-500 mt-1 truncate max-w-md">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
                <Link
                  href={`/admin/jobs/${job._id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Details
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold">Sessions ({sessions.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">Dates</th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">Completeness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {sessions.map((session) => (
                  <tr key={session._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium">{session.campName}</td>
                    <td className="px-4 py-3">{session.startDate} - {session.endDate}</td>
                    <td className="px-4 py-3">
                      <SessionStatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3">
                      {session.completenessScore !== undefined ? (
                        <span className={`text-sm ${
                          session.completenessScore === 100 ? 'text-green-600' :
                          session.completenessScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {session.completenessScore}%
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const styles = {
    default: 'text-slate-900 dark:text-white',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${styles[variant]}`}>{value}</p>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    sold_out: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    completed: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}
