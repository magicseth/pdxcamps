'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useState } from 'react';

export default function PartnerDashboardPage() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link
          href="/"
          className="font-semibold hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          PDX Camps
        </Link>
        <h1 className="text-lg font-semibold">Partner Dashboard</h1>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <DashboardContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">Please sign in to access your partner dashboard.</p>
            <a href="/sign-in" className="bg-foreground text-background px-6 py-2 rounded-md">
              Sign in
            </a>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function DashboardContent() {
  const data = useQuery(api.partners.queries.getMyPartnerDashboard);
  const [copied, setCopied] = useState(false);

  if (data === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Not a Partner Yet?</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          We couldn't find a partner application for your account. Apply to join the PDX Camps Partner Program!
        </p>
        <Link
          href="/partners"
          className="inline-block bg-foreground text-background px-6 py-2 rounded-md hover:opacity-90"
        >
          Apply Now
        </Link>
      </div>
    );
  }

  if (data.status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Application Under Review</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Your partner application for <strong>{data.organizationName}</strong> is being reviewed. We'll email you once a decision has been made.
        </p>
      </div>
    );
  }

  if (data.status === 'rejected') {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Application Not Approved</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Unfortunately, your partner application for <strong>{data.organizationName}</strong> was not approved at this time. If you have questions, please contact us.
        </p>
      </div>
    );
  }

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const balanceCents = data.totalEarningsCents - data.totalPaidOutCents;

  const handleCopyLink = () => {
    if (data.partnerLink) {
      navigator.clipboard.writeText(data.partnerLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{data.organizationName}</h2>
        <p className="text-slate-500 text-sm mt-1">
          Partner since {data.approvedAt ? new Date(data.approvedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}
        </p>
      </div>

      {/* Partner Link */}
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Your Partner Link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm text-sky-700 dark:text-sky-300 truncate">
            {data.partnerLink}
          </code>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 text-sm font-medium whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-500">Referrals</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.referredFamilyCount}</p>
          <p className="text-xs text-slate-400">families signed up</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-500">Total Earned</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCents(data.totalEarningsCents)}</p>
          <p className="text-xs text-slate-400">lifetime commissions</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-500">Paid Out</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCents(data.totalPaidOutCents)}</p>
          <p className="text-xs text-slate-400">total payouts</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-500">Balance</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCents(balanceCents)}</p>
          <p className="text-xs text-slate-400">unpaid earnings</p>
        </div>
      </div>

      {/* Commission History */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <h3 className="font-semibold text-slate-900 dark:text-white">Commission History</h3>
        </div>
        {data.commissions.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            <p>No commissions yet. Share your partner link to start earning!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Plan</th>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.commissions.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-3 text-slate-900 dark:text-white">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400 capitalize">{c.plan}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{c.period}</td>
                    <td className="px-6 py-3 text-right font-medium text-green-600 dark:text-green-400">
                      {formatCents(c.commissionCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
