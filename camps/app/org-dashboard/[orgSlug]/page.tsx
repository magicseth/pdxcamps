'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function OrgDashboardDetailPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const storedEmail =
    typeof window !== 'undefined' ? localStorage.getItem('orgDashboardEmail') || '' : '';

  const org = useQuery(api.organizations.queries.getOrganizationBySlug, { slug: orgSlug });
  const stats = useQuery(
    api.orgDashboard.queries.getOrgDashboardStats,
    org ? { organizationId: org._id } : 'skip',
  );
  const camps = useQuery(
    api.orgDashboard.queries.getOrgCamps,
    org ? { organizationId: org._id } : 'skip',
  );
  const hasAccess = useQuery(
    api.orgDashboard.queries.checkOrgAccess,
    org && storedEmail ? { organizationId: org._id, email: storedEmail } : 'skip',
  );

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const updateProfile = useMutation(api.orgDashboard.mutations.updateOrgProfile);

  if (!org) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-gray-500">Loading organization...</p>
      </main>
    );
  }

  if (hasAccess === false) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don't have verified access to this organization's dashboard.
        </p>
        <Link href="/org-dashboard" className="text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const handleSaveProfile = async () => {
    if (!org) return;
    await updateProfile({
      organizationId: org._id,
      email: storedEmail,
      name: editName || undefined,
      description: editDesc || undefined,
      website: editWebsite || undefined,
      phone: editPhone || undefined,
    });
    setEditing(false);
  };

  const startEditing = () => {
    setEditName(org.name || '');
    setEditDesc(org.description || '');
    setEditWebsite(org.website || '');
    setEditPhone(org.phone || '');
    setEditing(true);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/org-dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <span>{org.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{org.name}</h1>
          {org.website && (
            <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">
              {org.website}
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/organization/${orgSlug}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            View public page
          </Link>
          {!editing && (
            <button
              onClick={startEditing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Edit profile
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Active Camps" value={stats.activeCampCount} />
          <StatCard label="Upcoming Sessions" value={stats.upcomingSessions} />
          <StatCard label="Family Saves" value={stats.totalSaves} subtext={`${stats.recentSaves} this week`} />
          <StatCard label="Fill Rate" value={`${stats.fillRate}%`} subtext={`${stats.availableSpots} spots left`} />
        </div>
      )}

      {/* Edit profile form */}
      {editing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 mb-8">
          <h2 className="font-semibold mb-4">Edit Organization Profile</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Website</label>
              <input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Phone</label>
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 mt-1" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveProfile} className="rounded-lg bg-blue-600 px-6 py-2 text-white text-sm font-medium hover:bg-blue-700">Save</button>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Camps list */}
      <h2 className="text-xl font-semibold mb-4">Your Camps</h2>
      {camps && camps.length > 0 ? (
        <div className="space-y-3 mb-8">
          {camps.map((camp: any) => (
            <div key={camp._id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{camp.name}</h3>
                  {camp.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{camp.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {camp.categories?.map((cat: string) => (
                      <span key={cat} className="text-xs bg-gray-100 px-2 py-0.5 rounded">{cat}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{camp.upcomingSessionCount} sessions</p>
                  <p>{camp.totalSaves} saves</p>
                  {camp.priceRange && (
                    <p>
                      ${(camp.priceRange.min / 100).toFixed(0)}
                      {camp.priceRange.min !== camp.priceRange.max && `-$${(camp.priceRange.max / 100).toFixed(0)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 mb-8">No camps found for this organization.</p>
      )}

      {/* Featured listing CTA */}
      <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-6 text-center">
        <h3 className="font-semibold text-lg mb-2">Get more visibility</h3>
        <p className="text-gray-600 text-sm mb-4">
          Feature your camps at the top of search results and landing pages. Starting at $15/week.
        </p>
        <button className="rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700">
          Upgrade to Featured
        </button>
      </div>
    </main>
  );
}

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}
