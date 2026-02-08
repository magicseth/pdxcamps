'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';

export default function OrgDashboardPage() {
  const [email, setEmail] = useState('');
  const [storedEmail, setStoredEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orgDashboardEmail') || '';
    }
    return '';
  });

  const claimedOrgs = useQuery(
    api.orgDashboard.queries.getMyClaimedOrgs,
    storedEmail ? { email: storedEmail } : 'skip',
  );

  const [searchSlug, setSearchSlug] = useState('');
  const [claimOrgId, setClaimOrgId] = useState<string | null>(null);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimSent, setClaimSent] = useState(false);
  const [claimError, setClaimError] = useState('');

  const claimOrg = useMutation(api.orgDashboard.mutations.claimOrganization);
  const searchOrg = useQuery(
    api.organizations.queries.getOrganizationBySlug,
    searchSlug ? { slug: searchSlug } : 'skip',
  );

  const handleLogin = () => {
    if (email) {
      localStorage.setItem('orgDashboardEmail', email.toLowerCase());
      setStoredEmail(email.toLowerCase());
    }
  };

  const handleClaim = async () => {
    if (!claimOrgId || !claimEmail) return;
    setClaimError('');
    try {
      await claimOrg({ organizationId: claimOrgId as any, email: claimEmail });
      setClaimSent(true);
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Failed to claim');
    }
  };

  // Not logged in - show login
  if (!storedEmail) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-bold mb-2">Organization Dashboard</h1>
        <p className="text-gray-600 mb-8">
          Manage your camp listings, view analytics, and connect with families.
        </p>

        <div className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Sign in with your verified email</h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.com"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button
              onClick={handleLogin}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Use the email you used to verify your organization claim.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Claim your organization</h2>
          <p className="text-sm text-gray-600 mb-4">
            Search for your organization to get started.
          </p>
          <input
            type="text"
            value={searchSlug}
            onChange={(e) => setSearchSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="Organization name or slug"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 mb-3"
          />
          {searchOrg && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="font-medium">{searchOrg.name}</p>
              {searchOrg.website && <p className="text-sm text-gray-600">{searchOrg.website}</p>}
              <button
                onClick={() => setClaimOrgId(searchOrg._id)}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Claim this organization
              </button>
            </div>
          )}
          {searchSlug && searchOrg === null && (
            <p className="text-sm text-gray-500">No organization found. Try a different name.</p>
          )}
        </div>

        {claimOrgId && !claimSent && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h3 className="font-semibold mb-2">Verify your ownership</h3>
            <p className="text-sm text-gray-600 mb-3">
              We'll send a verification email to confirm you represent this organization.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                placeholder="your@organization.com"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
              />
              <button
                onClick={handleClaim}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700"
              >
                Send verification
              </button>
            </div>
            {claimError && <p className="text-sm text-red-600 mt-2">{claimError}</p>}
          </div>
        )}
        {claimSent && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-6">
            <p className="font-medium text-green-800">Verification email sent!</p>
            <p className="text-sm text-green-700 mt-1">Check your inbox and click the verification link.</p>
          </div>
        )}
      </main>
    );
  }

  // Logged in - show claimed orgs
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Organization Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{storedEmail}</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('orgDashboardEmail');
            setStoredEmail('');
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>

      {claimedOrgs && claimedOrgs.length > 0 ? (
        <div className="space-y-4">
          {claimedOrgs.map((org: any) => (
            <Link
              key={org._id}
              href={`/org-dashboard/${org.slug}`}
              className="block rounded-xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-sm transition-colors"
            >
              <h2 className="text-xl font-semibold">{org.name}</h2>
              {org.website && <p className="text-sm text-gray-500 mt-1">{org.website}</p>}
              <p className="text-sm text-blue-600 mt-2">View dashboard &rarr;</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No verified organizations found for this email.</p>
          <button
            onClick={() => {
              localStorage.removeItem('orgDashboardEmail');
              setStoredEmail('');
            }}
            className="mt-4 text-blue-600 hover:underline"
          >
            Try a different email or claim an organization
          </button>
        </div>
      )}
    </main>
  );
}
