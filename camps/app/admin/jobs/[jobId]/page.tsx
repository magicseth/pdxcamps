'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function JobDetailPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link
          href="/admin"
          className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Job Detail</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <JobDetailContent />
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

function JobDetailContent() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [showRawJson, setShowRawJson] = useState(false);

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const jobData = useQuery(api.scraping.queries.getJobSessions, {
    jobId: jobId as Id<'scrapeJobs'>,
  });

  if (isAdmin === undefined || jobData === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
          <span className="sr-only">Loading job details...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">You don't have permission to access the admin dashboard.</p>
        <Link
          href="/"
          className="inline-block mt-4 text-primary hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  if (jobData === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Job Not Found</h2>
        <p className="text-slate-600 dark:text-slate-400">The job you're looking for doesn't exist.</p>
        <Link
          href="/admin"
          className="inline-block mt-4 text-primary hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { job, source, sessions, parsed, organization, durationMs, logs, error } = jobData;

  // Calculate session stats
  const completeSessions = sessions.filter((s: SessionWithValidation) => s.validation.isComplete);
  const incompleteSessions = sessions.filter((s: SessionWithValidation) => !s.validation.isComplete);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span>Job {jobId.slice(-6)}</span>
      </div>

      {/* Job Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{source?.name ?? 'Unknown Source'}</h1>
            {source?.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {source.url}
              </a>
            )}
          </div>
          <JobStatusBadge status={job.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="font-medium">{job.status}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Sessions Found</p>
            <p className="font-medium">{sessions.length}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Complete</p>
            <p className="font-medium text-green-600">{completeSessions.length}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Incomplete</p>
            <p className="font-medium text-yellow-600">{incompleteSessions.length}</p>
          </div>
          {durationMs && (
            <div>
              <p className="text-sm text-slate-500">Duration</p>
              <p className="font-medium">{(durationMs / 1000).toFixed(1)}s</p>
            </div>
          )}
          {job.completedAt && (
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="font-medium">{new Date(job.completedAt).toLocaleString()}</p>
            </div>
          )}
        </div>

        {organization && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">Organization</p>
            <p className="font-medium">{organization.name}</p>
            {organization.description && <p className="text-sm text-slate-600 mt-1">{organization.description}</p>}
          </div>
        )}

        {job.errorMessage && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Error</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{job.errorMessage}</p>
          </div>
        )}
      </div>

      {/* Sessions Table */}
      {parsed && sessions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sessions ({sessions.length})</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600">{completeSessions.length} complete</span>
              <span className="text-slate-300">|</span>
              <span className="text-sm text-yellow-600">{incompleteSessions.length} incomplete</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">
                    Dates
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">
                    Times
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">
                    Price
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">
                    Ages
                  </th>
                  <th scope="col" className="text-left px-4 py-3 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {sessions.map((session: SessionWithValidation, index: number) => (
                  <SessionRow key={index} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No sessions */}
      {(!parsed || sessions.length === 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500">{error ? `Error parsing data: ${error}` : 'No sessions found in this job.'}</p>
        </div>
      )}

      {/* Raw JSON Toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
        >
          <span className="font-semibold">Raw Data & Logs</span>
          <span className="text-slate-400">{showRawJson ? '−' : '+'}</span>
        </button>
        {showRawJson && (
          <div className="px-6 pb-6 space-y-4">
            {logs && logs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Logs ({logs.length})</h3>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded text-xs overflow-auto max-h-48">
                  {logs.join('\n')}
                </pre>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-2">Sessions JSON</h3>
              <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(sessions, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ValidationInfo {
  isComplete: boolean;
  completenessScore: number;
  missingFields: string[];
  errors: Array<{ field: string; error: string; attemptedValue?: string }>;
}

interface SessionWithValidation {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  dateRaw?: string;
  timeRaw?: string;
  dropOffHour?: number;
  dropOffMinute?: number;
  pickUpHour?: number;
  pickUpMinute?: number;
  priceInCents?: number;
  priceRaw?: string;
  minAge?: number;
  maxAge?: number;
  minGrade?: number;
  maxGrade?: number;
  ageGradeRaw?: string;
  location?: string;
  registrationUrl?: string;
  imageUrls?: string[];
  isAvailable?: boolean;
  validation: ValidationInfo;
}

function SessionRow({ session }: { session: SessionWithValidation }) {
  const { validation } = session;

  const formatDates = () => {
    if (session.startDate) {
      if (session.endDate && session.endDate !== session.startDate) {
        return `${session.startDate} - ${session.endDate}`;
      }
      return session.startDate;
    }
    if (session.dateRaw) {
      return <span className="text-yellow-600 italic">{session.dateRaw}</span>;
    }
    return <span className="text-red-500">Missing</span>;
  };

  const formatTimes = () => {
    if (session.dropOffHour !== undefined && session.pickUpHour !== undefined) {
      const formatTime = (h: number, m: number = 0) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return m > 0 ? `${hour}:${String(m).padStart(2, '0')}${period}` : `${hour}${period}`;
      };
      return `${formatTime(session.dropOffHour, session.dropOffMinute)} - ${formatTime(session.pickUpHour, session.pickUpMinute)}`;
    }
    if (session.timeRaw) {
      return <span className="text-yellow-600 italic">{session.timeRaw}</span>;
    }
    return <span className="text-red-500">Missing</span>;
  };

  const formatPrice = () => {
    if (session.priceInCents !== undefined) {
      return `$${(session.priceInCents / 100).toFixed(2)}`;
    }
    if (session.priceRaw) {
      return <span className="text-yellow-600 italic">{session.priceRaw}</span>;
    }
    return <span className="text-red-500">Missing</span>;
  };

  const formatAges = () => {
    if (session.minAge !== undefined || session.maxAge !== undefined) {
      return `Ages ${session.minAge ?? '?'}-${session.maxAge ?? '?'}`;
    }
    if (session.minGrade !== undefined || session.maxGrade !== undefined) {
      const formatGrade = (g: number) => (g === 0 ? 'K' : g === -1 ? 'Pre-K' : `${g}`);
      return `Grades ${formatGrade(session.minGrade ?? 0)}-${formatGrade(session.maxGrade ?? 12)}`;
    }
    if (session.ageGradeRaw) {
      return <span className="text-yellow-600 italic">{session.ageGradeRaw}</span>;
    }
    return <span className="text-red-500">Missing</span>;
  };

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
      <td className="px-4 py-3">
        <div className="space-y-1">
          <p className="font-medium text-slate-900 dark:text-white">{session.name}</p>
          {session.location && <p className="text-xs text-slate-500">{session.location}</p>}
          {!session.location && validation.missingFields.includes('location') && (
            <p className="text-xs text-red-500">No location</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{formatDates()}</td>
      <td className="px-4 py-3 text-sm">{formatTimes()}</td>
      <td className="px-4 py-3 text-sm">{formatPrice()}</td>
      <td className="px-4 py-3 text-sm">{formatAges()}</td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <CompleteBadge score={validation.completenessScore} />
          {validation.missingFields.length > 0 && (
            <p className="text-xs text-slate-500">Missing: {validation.missingFields.join(', ')}</p>
          )}
        </div>
      </td>
    </tr>
  );
}

function CompleteBadge({ score }: { score: number }) {
  if (score === 100) {
    return (
      <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
        Complete
      </span>
    );
  }
  if (score >= 50) {
    return (
      <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
        {score}%
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
      {score}%
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    running: 'bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status] ?? styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
