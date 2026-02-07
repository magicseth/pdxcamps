'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTabs, StatCard } from '../../../components/admin';

export default function DevelopmentPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link
          href="/admin"
          className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Scraper Development</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <Suspense fallback={<LoadingState />}>
            <DevelopmentContent />
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
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" aria-hidden="true"></div>
        <span className="sr-only">Loading scraper development data...</span>
      </div>
    </div>
  );
}

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'testing' | 'needs_feedback' | 'completed' | 'failed';

function DevelopmentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const cities = useQuery(api.cities.queries.listActiveCities);

  const initialTab = (searchParams.get('tab') as StatusFilter) || 'all';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialTab);
  const [cityFilter, setCityFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limit, setLimit] = useState(100);

  const requests = useQuery(api.scraping.development.listRequests, {
    limit,
    sortOrder,
    status: statusFilter === 'all' ? undefined : (statusFilter as any),
    cityId: (cityFilter as any) || undefined,
  });

  // Pre-fill from query params (when coming from "Improve Scraper" link)
  const prefillSourceId = searchParams.get('sourceId');
  const prefillSourceName = searchParams.get('sourceName');
  const prefillSourceUrl = searchParams.get('sourceUrl');

  const [showNewForm, setShowNewForm] = useState(!!prefillSourceId);
  const [newSourceName, setNewSourceName] = useState(prefillSourceName || '');
  const [newSourceUrl, setNewSourceUrl] = useState(prefillSourceUrl || '');
  const [newSourceId, setNewSourceId] = useState(prefillSourceId || '');
  const [newCityId, setNewCityId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Update form when query params change
  useEffect(() => {
    if (prefillSourceId) {
      setShowNewForm(true);
      setNewSourceId(prefillSourceId);
    }
    if (prefillSourceName) setNewSourceName(prefillSourceName);
    if (prefillSourceUrl) setNewSourceUrl(prefillSourceUrl);
  }, [prefillSourceId, prefillSourceName, prefillSourceUrl]);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab') as StatusFilter;
    if (tab && ['all', 'pending', 'in_progress', 'testing', 'needs_feedback', 'completed', 'failed'].includes(tab)) {
      setStatusFilter(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setStatusFilter(tab as StatusFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.push(`/admin/development${params.toString() ? '?' + params.toString() : ''}`);
  };

  const requestDevelopment = useMutation(api.scraping.development.requestScraperDevelopment);

  if (isAdmin === undefined || requests === undefined) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2 text-red-600">Access Denied</h2>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityId) {
      alert('Please select a market');
      return;
    }
    setSubmitting(true);
    try {
      await requestDevelopment({
        sourceName: newSourceName,
        sourceUrl: newSourceUrl,
        cityId: newCityId as Id<'cities'>,
        sourceId: newSourceId ? (newSourceId as Id<'scrapeSources'>) : undefined,
        notes: newNotes || undefined,
      });
      setNewSourceName('');
      setNewSourceUrl('');
      setNewSourceId('');
      setNewCityId('');
      setNewNotes('');
      setShowNewForm(false);
      // Clear query params from URL
      window.history.replaceState({}, '', '/admin/development');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate counts for tabs
  const allRequests = requests;
  const counts = {
    all: allRequests.length,
    pending: allRequests.filter((r) => r.status === 'pending').length,
    in_progress: allRequests.filter((r) => r.status === 'in_progress').length,
    testing: allRequests.filter((r) => r.status === 'testing').length,
    needs_feedback: allRequests.filter((r) => r.status === 'needs_feedback').length,
    completed: allRequests.filter((r) => r.status === 'completed').length,
    failed: allRequests.filter((r) => r.status === 'failed').length,
  };

  const tabs = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { id: 'testing', label: 'Testing', count: counts.testing },
    { id: 'needs_feedback', label: 'Feedback', count: counts.needs_feedback },
    { id: 'completed', label: 'Done', count: counts.completed },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Scraper Development</h2>
          <p className="text-slate-500 mt-1">Queue sites for Claude Code to develop custom scrapers</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          {showNewForm ? 'Cancel' : '+ New Request'}
        </button>
      </div>

      {/* Daemon Status */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Daemon Required</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          To process requests, run the scraper daemon in a terminal:
        </p>
        <code className="block mt-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/40 rounded text-sm font-mono">
          npx tsx scripts/scraper-daemon.ts
        </code>
      </div>

      {/* Tabs */}
      <AdminTabs tabs={tabs} activeTab={statusFilter} onTabChange={handleTabChange} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="In Progress" value={counts.in_progress} variant="info" />
        <StatCard label="Needs Feedback" value={counts.needs_feedback} variant="warning" />
        <StatCard label="Completed" value={counts.completed} variant="success" />
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4">
            {newSourceId ? 'Improve Existing Scraper' : 'Request Scraper Development'}
          </h3>
          {newSourceId && (
            <div className="mb-4 p-3 bg-primary/10 dark:bg-primary-dark/20 border border-primary/30 dark:border-primary-dark rounded-lg">
              <p className="text-sm text-primary dark:text-white/70">
                This will improve the scraper for an existing source. Sessions will be deduplicated automatically.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Market *</label>
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
                  Camp/Organization Name *
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
                  Website URL *
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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes for Claude (optional)
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 min-h-[80px]"
                placeholder="Any helpful hints about the site structure, where to find camp data, etc."
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {/* Request List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold">Development Requests</h3>
          <div className="flex items-center gap-3">
            {/* City/Market Filter */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
            >
              <option value="">All Markets</option>
              {cities?.map((city) => (
                <option key={city._id} value={city._id}>
                  {city.name}
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
            >
              <option value="asc">Oldest First</option>
              <option value="desc">Newest First</option>
            </select>

            {/* Limit */}
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700"
            >
              <option value="50">Show 50</option>
              <option value="100">Show 100</option>
              <option value="200">Show 200</option>
              <option value="500">Show All</option>
            </select>

            <span className="text-sm text-slate-500">{requests.length} shown</span>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            No scraper development requests yet. Click "New Request" to get started.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {requests.map((request) => (
              <RequestRow key={request._id} request={request} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: any }) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isExtractingContact, setIsExtractingContact] = useState(false);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);
  const [outreachSent, setOutreachSent] = useState(false);
  const [contactResult, setContactResult] = useState<{
    success: boolean;
    email?: string;
    phone?: string;
    contactName?: string;
    error?: string;
  } | null>(null);

  const submitFeedback = useMutation(api.scraping.development.submitFeedback);
  const approveCode = useMutation(api.scraping.development.approveScraperCode);
  const markFailed = useMutation(api.scraping.development.markFailed);
  const forceRestart = useMutation(api.scraping.development.forceRestart);
  const extractContact = useAction(api.scraping.contactExtractor.extractContactInfo);
  const sendOutreach = useAction(api.email.sendContactOutreach);

  const handleExtractContact = async () => {
    setIsExtractingContact(true);
    setContactResult(null);
    setOutreachSent(false);
    try {
      const result = await extractContact({
        url: request.sourceUrl,
        organizationId: request.sourceId ? undefined : undefined, // We don't have org ID directly
      });
      setContactResult({
        success: result.success,
        email: result.contactInfo?.email,
        phone: result.contactInfo?.phone,
        contactName: result.contactInfo?.contactName,
        error: result.error,
      });
    } catch (error) {
      setContactResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExtractingContact(false);
    }
  };

  const handleSendOutreach = async () => {
    if (!contactResult?.email) return;
    setIsSendingOutreach(true);
    try {
      await sendOutreach({
        to: contactResult.email,
        organizationName: request.sourceName,
        contactName: contactResult.contactName,
      });
      setOutreachSent(true);
    } catch (error) {
      console.error('Failed to send outreach:', error);
    } finally {
      setIsSendingOutreach(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmittingFeedback(true);
    try {
      await submitFeedback({
        requestId: request._id,
        feedback: feedback.trim(),
      });
      setFeedback('');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveCode({ requestId: request._id });
    } finally {
      setIsApproving(false);
    }
  };

  const handleMarkFailed = async () => {
    await markFailed({ requestId: request._id });
  };

  const handleForceRestart = async (clearCode: boolean = false) => {
    await forceRestart({ requestId: request._id, clearCode });
  };

  // Parse sample data if available
  const parsedSessions = request.lastTestSampleData
    ? (() => {
        try {
          return JSON.parse(request.lastTestSampleData);
        } catch {
          return null;
        }
      })()
    : null;

  const needsReview = request.status === 'needs_feedback' || request.status === 'testing';
  const hasTestResults = request.lastTestRun && (request.lastTestSessionsFound ?? 0) > 0;

  // For needs_feedback status, show sample sessions inline
  if (needsReview && hasTestResults && parsedSessions) {
    return (
      <li className="px-6 py-4 bg-yellow-50/50 dark:bg-yellow-900/10 border-l-4 border-yellow-400">
        {/* Header row with info and actions */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <StatusBadge status={request.status} />
            {request.cityName && (
              <span className="px-1.5 py-0.5 text-xs bg-surface/30 dark:bg-purple-900/30 text-primary-dark dark:text-purple-300 rounded">
                {request.cityName}
              </span>
            )}
            <h4 className="font-medium truncate">{request.sourceName}</h4>
            <span className="text-xs text-slate-500">v{request.scraperVersion}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-slate-500">{request.lastTestSessionsFound} sessions</span>
            <button
              onClick={handleExtractContact}
              disabled={isExtractingContact}
              className="px-2 py-1.5 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded text-sm"
              title="Get contact info"
            >
              {isExtractingContact ? '⟳' : '📧'}
            </button>
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {isApproving ? '...' : 'Approve'}
            </button>
            <button
              onClick={handleMarkFailed}
              className="px-2 py-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-sm"
              title="Mark as failed"
            >
              ✕
            </button>
            <button onClick={() => setExpanded(!expanded)} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">
              {expanded ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Contact info result */}
        {contactResult && (
          <div
            className={`mb-3 px-3 py-2 rounded text-sm ${contactResult.success ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}
          >
            {contactResult.success ? (
              <div className="flex flex-wrap items-center gap-3">
                {contactResult.email && (
                  <>
                    <a href={`mailto:${contactResult.email}`} className="hover:underline">
                      📧 {contactResult.email}
                    </a>
                    {!outreachSent ? (
                      <button
                        onClick={handleSendOutreach}
                        disabled={isSendingOutreach}
                        className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isSendingOutreach ? 'Sending...' : 'Send Outreach'}
                      </button>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">✓ Sent</span>
                    )}
                  </>
                )}
                {contactResult.phone && (
                  <a href={`tel:${contactResult.phone}`} className="hover:underline">
                    📞 {contactResult.phone}
                  </a>
                )}
                {contactResult.contactName && <span>👤 {contactResult.contactName}</span>}
                {!contactResult.email && !contactResult.phone && (
                  <span className="text-slate-500">No contact info found on website</span>
                )}
              </div>
            ) : (
              <span>Error: {contactResult.error}</span>
            )}
          </div>
        )}

        {/* Sample sessions table - always visible for needs_feedback */}
        <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden mb-3">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">Camp Name</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">Dates</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">Times</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">Ages</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">Price</th>
                <th className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {(Array.isArray(parsedSessions) ? parsedSessions.slice(0, 5) : []).map((session: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={session.campName}>
                    {session.campName || <span className="text-red-400">Missing</span>}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {session.startDate && session.endDate ? (
                      `${session.startDate} - ${session.endDate}`
                    ) : (
                      <span className="text-red-400">Missing</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {session.dropOffTime && session.pickUpTime ? (
                      `${formatTime(session.dropOffTime)} - ${formatTime(session.pickUpTime)}`
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {session.ageMin || session.ageMax || session.gradeMin || session.gradeMax ? (
                      formatAgeRange(session)
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {session.price ? `$${(session.price / 100).toFixed(0)}` : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-2 py-1.5 max-w-[150px] truncate" title={session.locationName}>
                    {session.locationName || <span className="text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Array.isArray(parsedSessions) && parsedSessions.length > 5 && (
            <div className="px-2 py-1 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 text-center">
              +{parsedSessions.length - 5} more sessions
            </div>
          )}
        </div>

        {/* Inline feedback input */}
        {request.status === 'needs_feedback' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900"
              placeholder="Feedback: what's wrong or missing?"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitFeedback()}
            />
            <button
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback || !feedback.trim()}
              className="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark disabled:opacity-50"
            >
              {submittingFeedback ? '...' : 'Send'}
            </button>
          </div>
        )}

        {/* Expanded section for additional details */}
        {expanded && (
          <div className="mt-4 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <a
              href={request.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline block"
            >
              {request.sourceUrl}
            </a>

            {request.lastTestError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{request.lastTestError}</p>
            )}

            {request.generatedScraperCode && (
              <details>
                <summary className="text-sm text-primary cursor-pointer">View Generated Code</summary>
                <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto max-h-64 font-mono">
                  {request.generatedScraperCode}
                </pre>
              </details>
            )}

            {request.feedbackHistory && request.feedbackHistory.length > 0 && (
              <details>
                <summary className="text-sm text-primary cursor-pointer">
                  Feedback History ({request.feedbackHistory.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {request.feedbackHistory.map((fb: any, i: number) => (
                    <div key={i} className="text-sm bg-slate-50 dark:bg-slate-900 rounded p-2">
                      <span className="text-slate-500 text-xs">v{fb.scraperVersionBefore}: </span>
                      {fb.feedback}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details>
              <summary className="text-sm text-primary cursor-pointer">Raw JSON</summary>
              <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-auto max-h-48">
                {request.lastTestSampleData}
              </pre>
            </details>
          </div>
        )}
      </li>
    );
  }

  // Default compact row for other statuses
  return (
    <li className="px-6 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} />
            {request.cityName && (
              <span className="px-1.5 py-0.5 text-xs bg-surface/30 dark:bg-purple-900/30 text-primary-dark dark:text-purple-300 rounded">
                {request.cityName}
              </span>
            )}
            <h4 className="font-medium truncate">{request.sourceName}</h4>
          </div>
          <a
            href={request.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate block mt-1"
          >
            {request.sourceUrl}
          </a>
          <p className="text-xs text-slate-500 mt-1">
            Requested {new Date(request.requestedAt).toLocaleString()}
            {request.scraperVersion > 0 && ` • Version ${request.scraperVersion}`}
            {request.testRetryCount > 0 && ` • Retries: ${request.testRetryCount}/${request.maxTestRetries ?? 3}`}
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="ml-4 text-slate-500 hover:text-slate-700">
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Notes */}
          {request.notes && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Initial Notes</p>
              <p className="text-sm text-slate-500 mt-1">{request.notes}</p>
            </div>
          )}

          {/* Test Results */}
          {request.lastTestRun && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded p-4">
              <p className="text-sm font-medium">Last Test: {new Date(request.lastTestRun).toLocaleString()}</p>
              <p className="text-sm text-slate-500">Sessions found: {request.lastTestSessionsFound ?? 0}</p>
              {request.lastTestError && <p className="text-sm text-red-500 mt-1">{request.lastTestError}</p>}
              {request.lastTestSampleData && (
                <details className="mt-2">
                  <summary className="text-sm text-primary cursor-pointer">View Sample Data</summary>
                  <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-auto max-h-48">
                    {request.lastTestSampleData}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Generated Code */}
          {request.generatedScraperCode && (
            <details>
              <summary className="text-sm text-primary cursor-pointer">View Generated Code</summary>
              <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto max-h-64 font-mono">
                {request.generatedScraperCode}
              </pre>
            </details>
          )}

          {/* Feedback History */}
          {request.feedbackHistory && request.feedbackHistory.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Feedback History</p>
              <div className="space-y-2">
                {request.feedbackHistory.map((fb: any, i: number) => (
                  <div key={i} className="text-sm bg-slate-50 dark:bg-slate-900 rounded p-3">
                    <p className="text-slate-500 text-xs">
                      {new Date(fb.feedbackAt).toLocaleString()} (v{fb.scraperVersionBefore})
                    </p>
                    <p className="mt-1">{fb.feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Force Restart - available for stuck or completed requests */}
          {(request.status === 'in_progress' || request.status === 'testing') && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Request appears stuck?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleForceRestart(false)}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                >
                  Force Restart
                </button>
                <button
                  onClick={() => handleForceRestart(true)}
                  className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Restart & Clear Code
                </button>
              </div>
            </div>
          )}

          {(request.status === 'failed' || request.status === 'completed') && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => handleForceRestart(false)}
                  className="px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700"
                >
                  Restart (Keep Code)
                </button>
                <button
                  onClick={() => handleForceRestart(true)}
                  className="px-3 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                >
                  Restart (Clear Code)
                </button>
              </div>

              {/* Contact Extraction */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExtractContact}
                    disabled={isExtractingContact}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isExtractingContact ? (
                      <>
                        <span className="animate-spin">⟳</span> Extracting...
                      </>
                    ) : (
                      <>📧 Get Contact Info</>
                    )}
                  </button>
                  {contactResult && (
                    <div className={`text-sm ${contactResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {contactResult.success ? (
                        <span className="flex items-center gap-2 flex-wrap">
                          {contactResult.email && (
                            <>
                              <span>📧 {contactResult.email}</span>
                              {!outreachSent ? (
                                <button
                                  onClick={handleSendOutreach}
                                  disabled={isSendingOutreach}
                                  className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50"
                                >
                                  {isSendingOutreach ? '...' : 'Send Outreach'}
                                </button>
                              ) : (
                                <span className="text-green-600 text-xs">✓ Sent</span>
                              )}
                            </>
                          )}
                          {contactResult.phone && <span>📞 {contactResult.phone}</span>}
                          {contactResult.contactName && <span>👤 {contactResult.contactName}</span>}
                          {!contactResult.email && !contactResult.phone && (
                            <span className="text-slate-500">No contact info found</span>
                          )}
                        </span>
                      ) : (
                        <span>Error: {contactResult.error}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// Helper functions for formatting
function formatTime(time: { hour: number; minute: number } | string): string {
  if (typeof time === 'string') return time;
  const hour = time.hour % 12 || 12;
  const ampm = time.hour >= 12 ? 'pm' : 'am';
  const min = time.minute > 0 ? `:${time.minute.toString().padStart(2, '0')}` : '';
  return `${hour}${min}${ampm}`;
}

function formatAgeRange(session: any): string {
  const parts = [];
  if (session.ageMin || session.ageMax) {
    if (session.ageMin && session.ageMax) {
      parts.push(`${session.ageMin}-${session.ageMax}y`);
    } else if (session.ageMin) {
      parts.push(`${session.ageMin}+y`);
    } else {
      parts.push(`≤${session.ageMax}y`);
    }
  }
  if (session.gradeMin || session.gradeMax) {
    if (session.gradeMin && session.gradeMax) {
      parts.push(`G${session.gradeMin}-${session.gradeMax}`);
    } else if (session.gradeMin) {
      parts.push(`G${session.gradeMin}+`);
    } else {
      parts.push(`≤G${session.gradeMax}`);
    }
  }
  return parts.join(' / ');
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    in_progress: 'bg-primary/20 dark:bg-primary-dark/30 text-primary-dark dark:text-white/60',
    testing: 'bg-surface/30 dark:bg-purple-900/30 text-primary-dark dark:text-purple-300',
    needs_feedback: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    testing: 'Testing',
    needs_feedback: 'Needs Feedback',
    completed: 'Completed',
    failed: 'Failed',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}
