'use client';

import { useState, Suspense } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { StatCard } from '../../../components/admin';

export default function PartnersPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link
          href="/admin"
          className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Admin Dashboard
        </Link>
        <h1 className="text-lg font-semibold">Partner Management</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <Suspense fallback={<LoadingState />}>
            <PartnersContent />
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
        <span className="sr-only">Loading partner data...</span>
      </div>
    </div>
  );
}

type TabFilter = 'pending' | 'approved' | 'rejected';

function PartnersContent() {
  const isAdmin = useQuery(api.admin.queries.isAdmin);
  const stats = useQuery(api.partners.queries.getPartnerStats);
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const applications = useQuery(api.partners.queries.listPartnerApplications, {
    statusFilter: activeTab,
  });

  const approvePartner = useMutation(api.partners.admin.approvePartnerApplication);
  const rejectPartner = useMutation(api.partners.admin.rejectPartnerApplication);

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

  const handleApprove = async (id: Id<'partnerApplications'>) => {
    setProcessing(id);
    setMessage(null);
    try {
      const result = await approvePartner({ applicationId: id });
      setMessage({ type: 'success', text: `Approved! Partner code: ${result.partnerCode}` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to approve' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: Id<'partnerApplications'>) => {
    setProcessing(id);
    setMessage(null);
    try {
      await rejectPartner({ applicationId: id });
      setMessage({ type: 'success', text: 'Application rejected.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to reject' });
    } finally {
      setProcessing(null);
    }
  };

  const tabs: Array<{ value: TabFilter; label: string }> = [
    { value: 'pending', label: `Pending${stats ? ` (${stats.pending})` : ''}` },
    { value: 'approved', label: `Approved${stats ? ` (${stats.approved})` : ''}` },
    { value: 'rejected', label: `Rejected${stats ? ` (${stats.rejected})` : ''}` },
  ];

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Partner Program</h2>
        <p className="text-slate-500 mt-1">Manage PTA/school partner applications and track commissions</p>
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
          <StatCard label="Total Applications" value={stats.totalApplications} />
          <StatCard label="Pending" value={stats.pending} variant="warning" />
          <StatCard label="Approved" value={stats.approved} variant="success" />
          <StatCard label="Rejected" value={stats.rejected} />
          <StatCard label="Total Commissions" value={stats.totalCommissionsCents} subtext={formatCents(stats.totalCommissionsCents)} variant="success" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.value
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Applications Table */}
      {applications === undefined ? (
        <LoadingState />
      ) : applications.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <p className="text-slate-500">No {activeTab} applications.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Organization
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                    Applied
                  </th>
                  {activeTab === 'approved' && (
                    <>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Partner Link
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Referrals
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Earnings
                      </th>
                    </>
                  )}
                  {activeTab === 'pending' && (
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {applications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{app.organizationName}</p>
                        {app.message && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{app.message}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{app.contactName}</p>
                      <p className="text-xs text-slate-400">{app.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {app.organizationType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    {activeTab === 'approved' && (
                      <>
                        <td className="px-4 py-3">
                          {app.partnerCode && (
                            <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                              /p/{app.partnerCode}
                            </code>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                          {app.referredFamilyCount}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
                          {formatCents(app.totalCommissionsCents)}
                        </td>
                      </>
                    )}
                    {activeTab === 'pending' && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(app._id)}
                            disabled={processing === app._id}
                            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {processing === app._id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(app._id)}
                            disabled={processing === app._id}
                            className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
            Showing {applications.length} applications
          </div>
        </div>
      )}
    </div>
  );
}
