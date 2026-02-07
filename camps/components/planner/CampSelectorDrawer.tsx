'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';

// Animated count component with slide-up effect
function AnimatedCount({ count, className = '' }: { count: number; className?: string }) {
  const [displayCount, setDisplayCount] = useState(count);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down'>('up');
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      setSlideDirection(count > prevCount.current ? 'up' : 'down');
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayCount(count);
        setIsAnimating(false);
      }, 150);
      prevCount.current = count;
      return () => clearTimeout(timer);
    }
  }, [count]);

  return (
    <span className={`inline-flex items-center overflow-hidden min-w-[1.5ch] justify-center ${className}`}>
      <span
        className={`transition-all duration-200 ease-out tabular-nums ${
          isAnimating
            ? slideDirection === 'up'
              ? 'opacity-0 -translate-y-3 scale-90'
              : 'opacity-0 translate-y-3 scale-90'
            : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        {displayCount}
      </span>
    </span>
  );
}
import Link from 'next/link';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { CATEGORIES, DEFAULT_CHILD_COLORS } from '../../lib/constants';
import { SessionCard } from '../discover/SessionCard';
import { OrgFilterChip } from '../shared/OrgFilterChip';

interface CampSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: string;
  weekEnd: string;
  childId: Id<'children'>;
  childName: string;
  childColor?: string;
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

export function CampSelectorDrawer({
  isOpen,
  onClose,
  weekStart,
  weekEnd,
  childId,
  childName,
  childColor,
  childAge,
  childGrade,
  cityId,
}: CampSelectorDrawerProps) {
  const avatarColor = childColor || DEFAULT_CHILD_COLORS[0];
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  // Query ALL sessions for this week/child (for filter options)
  const allSessionsResult = useQuery(
    api.sessions.queries.searchSessions,
    isOpen
      ? {
          cityId,
          startDateAfter: weekStart,
          startDateBefore: weekEnd,
          childAge,
          childGrade,
          excludeSoldOut: true,
          limit: 200,
        }
      : 'skip'
  );

  const allSessions = allSessionsResult?.sessions ?? [];

  // Query FILTERED sessions for display
  const hasFilters = selectedCategories.length > 0 || selectedOrg !== null || selectedLocation !== null;
  const filteredSessionsResult = useQuery(
    api.sessions.queries.searchSessions,
    isOpen && hasFilters
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

  // Use filtered results if we have filters, otherwise use all sessions
  const sessions = hasFilters ? (filteredSessionsResult?.sessions ?? []) : allSessions;
  const totalCount = hasFilters ? (filteredSessionsResult?.totalCount ?? 0) : (allSessionsResult?.totalCount ?? 0);
  const isLoading = hasFilters ? filteredSessionsResult === undefined : allSessionsResult === undefined;

  // Get unique organizations from ALL sessions for filter chips
  const organizations = useMemo(() => {
    const orgs = new Map<string, { id: string; name: string; logoUrl?: string; count: number }>();
    for (const session of allSessions) {
      if (!orgs.has(session.organizationId)) {
        orgs.set(session.organizationId, {
          id: session.organizationId,
          name: session.organizationName || 'Unknown',
          logoUrl: (session as any).organizationLogoUrl,
          count: 0,
        });
      }
      orgs.get(session.organizationId)!.count++;
    }
    return Array.from(orgs.values()).sort((a, b) => b.count - a.count);
  }, [allSessions]);

  // Get unique locations from sessions for the selected org
  const locations = useMemo(() => {
    if (!selectedOrg) return [];
    const orgSessions = allSessions.filter(s => s.organizationId === selectedOrg);
    const locs = new Map<string, { id: string; name: string; count: number }>();
    for (const session of orgSessions) {
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
  }, [allSessions, selectedOrg]);

  // Get available categories from ALL sessions
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const session of allSessions) {
      if (session.campCategories) {
        for (const cat of session.campCategories) {
          if (cat !== 'General' && cat !== 'camp') {
            cats.add(cat);
          }
        }
      }
    }
    return CATEGORIES.filter(cat => cats.has(cat));
  }, [allSessions]);

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
            <div className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {childName[0]}
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Find a Camp for {childName}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatDateRange(weekStart, weekEnd)}
                </p>
              </div>
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
                <OrgFilterChip
                  key={org.id}
                  id={org.id}
                  name={org.name}
                  logoUrl={org.logoUrl}
                  count={org.count}
                  isSelected={selectedOrg === org.id}
                  onClick={() => {
                    setSelectedOrg(selectedOrg === org.id ? null : org.id);
                    setSelectedLocation(null);
                  }}
                  size="sm"
                />
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
          {isLoading ? (
            'Loading...'
          ) : totalCount === 0 ? (
            'No camps available'
          ) : (
            <span className="inline-flex items-center gap-1">
              <AnimatedCount
                count={sessions.length}
                className="font-semibold text-slate-700 dark:text-slate-200 min-w-[2ch]"
              />
              {totalCount > sessions.length && (
                <span>of {totalCount}</span>
              )}
              <span>camp{totalCount === 1 ? '' : 's'} available</span>
            </span>
          )}
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
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
            <div className="space-y-4">
              {sessions.map(session => (
                <SessionCard
                  key={session._id}
                  session={session as any}
                  cityId={cityId}
                  preSelectedChildId={childId}
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
