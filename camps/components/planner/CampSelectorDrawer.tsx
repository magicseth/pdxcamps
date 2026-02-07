'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import Link from 'next/link';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { OrgLogo } from '../shared/OrgLogo';
import { CATEGORIES } from '../../lib/constants';
import confetti from 'canvas-confetti';

interface CampSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: string;
  weekEnd: string;
  childId: Id<'children'>;
  childName: string;
  childAge?: number;
  childGrade?: number;
  cityId: Id<'cities'>;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (start.getMonth() === end.getMonth()) {
    return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
  }
  return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}`;
}

function formatTime(time: { hour: number; minute: number }): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? 'am' : 'pm';
  if (time.minute === 0) {
    return `${hour12}${ampm}`;
  }
  return `${hour12}:${time.minute.toString().padStart(2, '0')}${ampm}`;
}

export function CampSelectorDrawer({
  isOpen,
  onClose,
  weekStart,
  weekEnd,
  childId,
  childName,
  childAge,
  childGrade,
  cityId,
}: CampSelectorDrawerProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [savingSessionId, setSavingSessionId] = useState<Id<'sessions'> | null>(null);

  const saveMutation = useMutation(api.registrations.mutations.markInterested);

  // Query sessions for this week and child
  const sessionsResult = useQuery(
    api.sessions.queries.searchSessions,
    isOpen
      ? {
          cityId,
          startDateAfter: weekStart,
          startDateBefore: weekEnd,
          childAge,
          childGrade,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          organizationIds: selectedOrg ? [selectedOrg as Id<'organizations'>] : undefined,
          locationIds: selectedLocation ? [selectedLocation as Id<'locations'>] : undefined,
          excludeSoldOut: true,
          limit: 50,
        }
      : 'skip'
  );

  const sessions = sessionsResult?.sessions ?? [];
  const totalCount = sessionsResult?.totalCount ?? 0;

  // Get unique organizations from sessions for filter chips
  const organizations = useMemo(() => {
    const orgs = new Map<string, { id: string; name: string; logoUrl?: string; count: number }>();
    for (const session of sessions) {
      if (!orgs.has(session.organizationId)) {
        orgs.set(session.organizationId, {
          id: session.organizationId,
          name: session.organizationName || 'Unknown',
          logoUrl: undefined, // Will fetch separately if needed
          count: 0,
        });
      }
      orgs.get(session.organizationId)!.count++;
    }
    return Array.from(orgs.values()).sort((a, b) => b.count - a.count);
  }, [sessions]);

  // Get unique locations from sessions (only when org is selected)
  const locations = useMemo(() => {
    if (!selectedOrg) return [];
    const locs = new Map<string, { id: string; name: string; count: number }>();
    for (const session of sessions) {
      if (!locs.has(session.locationId)) {
        locs.set(session.locationId, {
          id: session.locationId,
          name: session.locationName || 'Unknown',
          count: 0,
        });
      }
      locs.get(session.locationId)!.count++;
    }
    return Array.from(locs.values()).sort((a, b) => b.count - a.count);
  }, [sessions, selectedOrg]);

  // Get available categories from sessions
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const session of sessions) {
      if (session.campCategories) {
        for (const cat of session.campCategories) {
          if (cat !== 'General' && cat !== 'camp') {
            cats.add(cat);
          }
        }
      }
    }
    return CATEGORIES.filter(cat => cats.has(cat));
  }, [sessions]);

  const handleSave = async (sessionId: Id<'sessions'>, campName: string) => {
    setSavingSessionId(sessionId);
    try {
      await saveMutation({ sessionId, childId });
      confetti({
        particleCount: 60,
        spread: 50,
        origin: { y: 0.7 },
        zIndex: 9999,
      });
    } catch (error) {
      console.error('Failed to save session:', error);
    } finally {
      setSavingSessionId(null);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between p-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Find a Camp
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatDateRange(weekStart, weekEnd)} for {childName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Category filters */}
          {availableCategories.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategories.includes(cat)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Organization filters */}
          {organizations.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {organizations.slice(0, 8).map(org => (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectedOrg(selectedOrg === org.id ? null : org.id);
                    setSelectedLocation(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedOrg === org.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span className="truncate max-w-[100px]">{org.name}</span>
                  <span className="opacity-60">{org.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Location filters (when org selected) */}
          {selectedOrg && locations.length > 1 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-400 mr-1">Location:</span>
              {locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(selectedLocation === loc.id ? null : loc.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedLocation === loc.id
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50">
          {sessionsResult === undefined ? (
            'Loading...'
          ) : totalCount === 0 ? (
            'No camps available'
          ) : (
            `${sessions.length}${totalCount > sessions.length ? ` of ${totalCount}` : ''} camp${totalCount === 1 ? '' : 's'} available`
          )}
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-4">
          {sessionsResult === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-600 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🏕️</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No camps found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Try adjusting your filters or check another week
              </p>
              <Link
                href={`/discover/portland?from=${weekStart}&to=${weekEnd}&childId=${childId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
                onClick={onClose}
              >
                Browse all camps
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <CompactSessionCard
                  key={session._id}
                  session={session}
                  onSave={() => handleSave(session._id, session.campName || 'Camp')}
                  isSaving={savingSessionId === session._id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with link to full discover */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700">
          <Link
            href={`/discover/portland?from=${weekStart}&to=${weekEnd}&childId=${childId}`}
            className="flex items-center justify-center gap-2 w-full py-3 text-primary hover:text-primary-dark font-medium"
            onClick={onClose}
          >
            See all options in Discover
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </>
  );
}

// Compact session card for the drawer
function CompactSessionCard({
  session,
  onSave,
  isSaving,
}: {
  session: {
    _id: Id<'sessions'>;
    campName?: string;
    organizationName?: string;
    startDate: string;
    endDate: string;
    dropOffTime: { hour: number; minute: number };
    pickUpTime: { hour: number; minute: number };
    price: number;
    capacity: number;
    enrolledCount: number;
    locationName?: string;
    externalRegistrationUrl?: string;
    campCategories?: string[];
  };
  onSave: () => void;
  isSaving: boolean;
}) {
  const spotsLeft = session.capacity - session.enrolledCount;
  const hasAvailability = !(session.capacity === 20 && session.enrolledCount === 0);

  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/session/${session._id}`}
            className="font-medium text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary-light line-clamp-1"
          >
            {session.campName || 'Camp'}
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
            {session.organizationName}
          </p>
        </div>
        <span className="text-lg font-bold text-green-600 dark:text-green-400 flex-shrink-0">
          ${(session.price / 100).toFixed(0)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>{formatDateRange(session.startDate, session.endDate)}</span>
        <span>•</span>
        <span>{formatTime(session.dropOffTime)} - {formatTime(session.pickUpTime)}</span>
        {session.locationName && (
          <>
            <span>•</span>
            <span className="truncate max-w-[120px]">{session.locationName}</span>
          </>
        )}
      </div>

      {/* Categories */}
      {session.campCategories && session.campCategories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.campCategories.slice(0, 3).map(cat => (
            <span
              key={cat}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Availability and actions */}
      <div className="mt-3 flex items-center justify-between">
        {hasAvailability && (
          <span className={`text-xs font-medium ${
            spotsLeft <= 3 ? 'text-red-600' : spotsLeft <= 5 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {session.externalRegistrationUrl && (
            <a
              href={session.externalRegistrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary-light"
            >
              Register →
            </a>
          )}
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : '+ Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
