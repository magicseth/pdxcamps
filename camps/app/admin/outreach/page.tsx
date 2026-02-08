'use client';

import { useState, Suspense } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { StatCard } from '../../../components/admin';

export default function OutreachPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link
          href="/admin"
          className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Org Outreach</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <Suspense fallback={<LoadingState />}>
            <OutreachContent />
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
    <div className="max-w-6xl mx-auto py-8">
      <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" aria-hidden="true"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <span className="sr-only">Loading outreach data...</span>
      </div>
    </div>
  );
}

type StatusFilter = 'all' | 'no_outreach' | 'pending' | 'sent' | 'opened' | 'replied' | 'bounced';

function OutreachContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const cities = useQuery(api.cities.queries.listActiveCities);

  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [batchSending, setBatchSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const stats = useQuery(api.orgOutreach.queries.getOutreachStats, {
    cityId: selectedCityId ? (selectedCityId as Id<'cities'>) : undefined,
  });

  const queue = useQuery(api.orgOutreach.queries.getOutreachQueue, {
    cityId: selectedCityId ? (selectedCityId as Id<'cities'>) : undefined,
    statusFilter: statusFilter !== 'all' ? (statusFilter as Exclude<StatusFilter, 'all'>) : undefined,
  });

  const queueOutreach = useMutation(api.orgOutreach.mutations.queueOrgOutreach);
  const batchQueue = useMutation(api.orgOutreach.mutations.batchQueueOutreach);
  const queueFollowUp = useMutation(api.orgOutreach.mutations.queueFollowUp);
  const sendOutreach = useAction(api.orgOutreach.actions.sendOrgOutreach);
  const sendAllPending = useAction(api.orgOutreach.actions.sendAllPendingOutreach);

  if (isAdmin === undefined) return <LoadingState />;

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">You don&apos;t have permission to access this page.</p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  const handleQueueOutreach = async (orgId: Id<'organizations'>) => {
    try {
      await queueOutreach({ organizationId: orgId });
      setMessage({ type: 'success', text: 'Outreach queued successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to queue outreach' });
    }
  };

  const handleSendOutreach = async (outreachId: Id<'orgOutreach'>) => {
    setSending(outreachId);
    setMessage(null);
    try {
      await sendOutreach({ outreachId });
      setMessage({ type: 'success', text: 'Email sent successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send email' });
    } finally {
      setSending(null);
    }
  };

  const handleBatchQueue = async () => {
    if (selectedOrgs.size === 0) return;
    try {
      const result = await batchQueue({
        organizationIds: Array.from(selectedOrgs) as Id<'organizations'>[],
      });
      setMessage({
        type: 'success',
        text: `Queued ${result.queued}, skipped ${result.skipped}${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`,
      });
      setSelectedOrgs(new Set());
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to batch queue' });
    }
  };

  const handleSendAllPending = async () => {
    setBatchSending(true);
    setMessage(null);
    try {
      const result = await sendAllPending({});
      setMessage({
        type: 'success',
        text: `Sent ${result.sent} of ${result.total} emails${result.errors.length > 0 ? `. ${result.errors.length} errors.` : ''}`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send batch' });
    } finally {
      setBatchSending(false);
    }
  };

  const handleQueueFollowUp = async (orgId: Id<'organizations'>) => {
    try {
      await queueFollowUp({ organizationId: orgId });
      setMessage({ type: 'success', text: 'Follow-up queued' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to queue follow-up' });
    }
  };

  const toggleOrgSelection = (orgId: string) => {
    setSelectedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    if (!queue) return;
    const eligibleOrgs = queue.filter((o) => o.email && o.outreachStatus === 'no_outreach');
    setSelectedOrgs(new Set(eligibleOrgs.map((o) => o._id)));
  };

  const deselectAll = () => setSelectedOrgs(new Set());

  const statusFilters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'no_outreach', label: 'Not Contacted' },
    { value: 'pending', label: 'Pending' },
    { value: 'sent', label: 'Sent' },
    { value: 'replied', label: 'Replied' },
    { value: 'bounced', label: 'Bounced' },
  ];

  const pendingCount = queue?.filter((o) => o.outreachStatus === 'pending').length || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Org Outreach Pipeline</h2>
          <p className="text-slate-500 mt-1">Reach out to camp organizations to claim their listings</p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button
              onClick={handleSendAllPending}
              disabled={batchSending}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {batchSending ? 'Sending...' : `Send All Pending (${pendingCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-4 underline text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Orgs" value={stats.totalOrgs} />
          <StatCard label="With Email" value={stats.withEmail} />
          <StatCard label="Contacted" value={stats.contacted} variant="success" />
          <StatCard label="Not Contacted" value={stats.notContacted} variant="warning" />
          <StatCard label="Replied" value={stats.replied} variant="success" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Market:</label>
          <select
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
          >
            <option value="">All Markets</option>
            {cities?.map((city) => (
              <option key={city._id} value={city._id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status:</span>
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                statusFilter === filter.value
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions */}
      {selectedOrgs.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-primary/10 dark:bg-primary-dark/20 rounded-lg border border-primary/20">
          <span className="text-sm font-medium">{selectedOrgs.size} selected</span>
          <button
            onClick={handleBatchQueue}
            className="px-4 py-1.5 bg-primary text-white rounded-md hover:bg-primary-dark text-sm font-medium"
          >
            Queue Selected for Outreach
          </button>
          <button onClick={deselectAll} className="text-sm text-slate-600 dark:text-slate-400 hover:underline">
            Deselect All
          </button>
        </div>
      )}

      {/* Select All for "Not Contacted" view */}
      {statusFilter === 'no_outreach' && queue && queue.filter((o) => o.email).length > 0 && (
        <div className="flex items-center gap-4">
          <button onClick={selectAllVisible} className="text-sm text-primary hover:underline">
            Select all with email ({queue.filter((o) => o.email).length})
          </button>
        </div>
      )}

      {/* Queue Table */}
      {queue === undefined ? (
        <LoadingState />
      ) : queue.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <p className="text-slate-500">No organizations match this filter.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Organization
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Sessions
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {queue.map((org) => (
                  <tr key={org._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      {org.email && org.outreachStatus === 'no_outreach' && (
                        <input
                          type="checkbox"
                          checked={selectedOrgs.has(org._id)}
                          onChange={() => toggleOrgSelection(org._id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{org.name}</p>
                        {org.website && (
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {org.website}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {org.email ? (
                        <span className="text-sm text-slate-700 dark:text-slate-300">{org.email}</span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">No email</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{org.sessionCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <OutreachStatusBadge
                        status={org.outreachStatus}
                        sequenceStep={org.sequenceStep}
                        lastSentAt={org.lastSentAt}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {org.outreachStatus === 'no_outreach' && org.email && (
                          <button
                            onClick={() => handleQueueOutreach(org._id)}
                            className="px-3 py-1 text-xs font-medium bg-primary text-white rounded hover:bg-primary-dark"
                          >
                            Queue
                          </button>
                        )}
                        {org.outreachStatus === 'pending' && org.outreachId && (
                          <button
                            onClick={() => handleSendOutreach(org.outreachId!)}
                            disabled={sending === org.outreachId}
                            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {sending === org.outreachId ? 'Sending...' : 'Send'}
                          </button>
                        )}
                        {org.outreachStatus === 'sent' && org.sequenceStep < 3 && (
                          <button
                            onClick={() => handleQueueFollowUp(org._id)}
                            className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                          >
                            Queue Follow-up
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
            Showing {queue.length} organizations
          </div>
        </div>
      )}
    </div>
  );
}

function OutreachStatusBadge({
  status,
  sequenceStep,
  lastSentAt,
}: {
  status: string;
  sequenceStep: number;
  lastSentAt: number | null;
}) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    no_outreach: {
      bg: 'bg-slate-100 dark:bg-slate-700',
      text: 'text-slate-600 dark:text-slate-400',
      label: 'Not contacted',
    },
    pending: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: `Pending (Step ${sequenceStep})`,
    },
    sent: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      label: `Sent (Step ${sequenceStep})`,
    },
    opened: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-700 dark:text-purple-300',
      label: 'Opened',
    },
    replied: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Replied',
    },
    bounced: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      label: 'Bounced',
    },
  };

  const badge = badges[status] || badges.no_outreach;

  return (
    <div>
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
      {lastSentAt && (
        <p className="text-xs text-slate-400 mt-1">
          {new Date(lastSentAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
