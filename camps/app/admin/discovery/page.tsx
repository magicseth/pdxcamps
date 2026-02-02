'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

type DiscoveredSourceStatus =
  | 'pending_analysis'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'scraper_generated'
  | 'duplicate';

export default function DiscoveryQueuePage() {
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

  return <DiscoveryQueueContent />;
}

function DiscoveryQueueContent() {
  const [statusFilter, setStatusFilter] = useState<DiscoveredSourceStatus | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<Id<'discoveredSources'> | null>(null);

  // Get the first active city for now
  const cities = useQuery(api.cities.queries.listActiveCities);
  const cityId = cities?.[0]?._id;

  // Fetch discovery queue
  const discoveryQueue = useQuery(
    api.discovery.queries.getDiscoveryQueue,
    cityId
      ? {
          cityId,
          status:
            statusFilter !== 'all' ? (statusFilter as DiscoveredSourceStatus) : undefined,
        }
      : 'skip'
  );

  // Mutations
  const reviewSource = useMutation(api.discovery.mutations.reviewSource);

  const handleApprove = async (sourceId: Id<'discoveredSources'>) => {
    try {
      await reviewSource({
        sourceId,
        status: 'approved',
      });
    } catch (error) {
      console.error('Failed to approve source:', error);
    }
  };

  const handleReject = async (sourceId: Id<'discoveredSources'>) => {
    try {
      await reviewSource({
        sourceId,
        status: 'rejected',
      });
    } catch (error) {
      console.error('Failed to reject source:', error);
    }
  };

  const statusFilters: Array<{ value: DiscoveredSourceStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Pending' },
    { value: 'pending_analysis', label: 'Pending Analysis' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-700 mb-1 block">
                &larr; Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Discovery Queue
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Review and approve newly discovered camp sources
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">
              Status:
            </span>
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {discoveryQueue === undefined && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <div role="status" aria-live="polite" className="p-6 animate-pulse motion-reduce:animate-none space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4" aria-hidden="true">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                </div>
              ))}
              <span className="sr-only">Loading discovery queue...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {discoveryQueue !== undefined && discoveryQueue.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
            <div className="text-slate-400 mb-4">
              <EmptyIcon />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No sources found
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {statusFilter !== 'all'
                ? `No sources with status "${statusFilter.replace(/_/g, ' ')}"`
                : 'No discovered sources in the queue'}
            </p>
          </div>
        )}

        {/* Discovery Queue List */}
        {discoveryQueue !== undefined && discoveryQueue.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm divide-y divide-slate-200 dark:divide-slate-700">
            {discoveryQueue.map((source) => (
              <div
                key={source._id}
                className={`p-6 ${
                  selectedSource === source._id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* URL and Domain */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClass(source.status)}`}>
                        {source.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {source.domain}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">
                      {source.title}
                    </h3>

                    {/* URL */}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 line-clamp-1 mb-2"
                    >
                      {source.url}
                    </a>

                    {/* Snippet */}
                    {source.snippet && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                        {source.snippet}
                      </p>
                    )}

                    {/* AI Analysis */}
                    {source.aiAnalysis && (
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-3 mb-3">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase mb-2">
                          AI Analysis
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Likely Camp:</span>
                            <span
                              className={`ml-1 font-medium ${
                                source.aiAnalysis.isLikelyCampSite
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {source.aiAnalysis.isLikelyCampSite ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Confidence:</span>
                            <span className="ml-1 font-medium text-slate-900 dark:text-white">
                              {Math.round(source.aiAnalysis.confidence * 100)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Page Type:</span>
                            <span className="ml-1 font-medium text-slate-900 dark:text-white">
                              {source.aiAnalysis.pageType.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">Schedule Info:</span>
                            <span
                              className={`ml-1 font-medium ${
                                source.aiAnalysis.hasScheduleInfo
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {source.aiAnalysis.hasScheduleInfo ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                        {source.aiAnalysis.detectedCampNames.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Detected camps:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {source.aiAnalysis.detectedCampNames.map((name, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {source.aiAnalysis.suggestedScraperApproach && (
                          <div className="mt-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Suggested approach:
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                              {source.aiAnalysis.suggestedScraperApproach}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Discovered: {new Date(source.discoveredAt).toLocaleDateString()}
                      </span>
                      <span>Query: &quot;{source.discoveryQuery}&quot;</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {(source.status === 'pending_review' || source.status === 'pending_analysis') && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(source._id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center gap-2"
                      >
                        <CheckIcon />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(source._id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 flex items-center gap-2"
                      >
                        <XIcon />
                        Reject
                      </button>
                      <button
                        onClick={() =>
                          setSelectedSource(selectedSource === source._id ? null : source._id)
                        }
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Helper functions
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending_analysis':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'pending_review':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'scraper_generated':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'duplicate':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
  }
}

// Icons
function EmptyIcon() {
  return (
    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
