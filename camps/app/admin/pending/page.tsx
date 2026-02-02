'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useState } from 'react';

export default function PendingSessionsPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link href="/admin" className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Pending Sessions</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <PendingSessionsContent />
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

function PendingSessionsContent() {
  const [statusFilter, setStatusFilter] = useState<'pending_review' | 'manually_fixed' | 'imported' | 'discarded' | undefined>('pending_review');

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const pendingSessions = useQuery(api.scraping.queries.getPendingSessions, {
    status: statusFilter,
  });

  const updateStatus = useMutation(api.scraping.importMutations.updatePendingSessionStatus);

  if (isAdmin === undefined || pendingSessions === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
          <span className="sr-only">Loading pending sessions...</span>
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Pending Sessions
          </h2>
          <p className="text-slate-500 mt-1">
            Sessions with incomplete data that need review
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500">Total Pending</p>
          <p className="text-2xl font-bold">{pendingSessions.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500">Sources</p>
          <p className="text-2xl font-bold">{Object.keys(bySource).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-slate-500">Avg Completeness</p>
          <p className="text-2xl font-bold">
            {pendingSessions.length > 0
              ? Math.round(pendingSessions.reduce((sum, s) => sum + s.completenessScore, 0) / pendingSessions.length)
              : 0}%
          </p>
        </div>
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
            {partialData.ageGradeRaw && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Ages:</span>
                <span className="text-yellow-600">{partialData.ageGradeRaw}</span>
              </div>
            )}
            {partialData.location && (
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Location:</span>
                <span className="text-slate-700 dark:text-slate-300">{partialData.location}</span>
              </div>
            )}
          </div>

          {/* Validation Errors */}
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
                      {err.attemptedValue && (
                        <span className="text-slate-500 ml-1">(tried: "{err.attemptedValue}")</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {session.status === 'pending_review' && (
            <>
              <button
                onClick={onDiscard}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                Discard
              </button>
            </>
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
