'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Authenticated, Unauthenticated } from 'convex/react';
import { ChildCoverageCard } from '../../../../components/planner/ChildCoverageCard';
import { AddEventModal } from '../../../../components/planner/AddEventModal';
import { EditEventModal } from '../../../../components/planner/EditEventModal';
import { BottomNav } from '../../../../components/shared/BottomNav';
import { calculateAge, isAgeInRange, isGradeInRange, doDateRangesOverlap } from '../../../../convex/lib/helpers';

export default function WeekDetailPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <BackIcon />
            <span className="font-medium">Back to Planner</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <span className="font-bold text-lg">PDX Camps</span>
            </div>
          </div>
        </div>
      </header>
      <main className="p-4 md:p-8 pb-24">
        <Authenticated>
          <WeekDetailContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">
              Please sign in to view week details.
            </p>
            <a href="/sign-in">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                Sign in
              </button>
            </a>
          </div>
        </Unauthenticated>
      </main>

      <BottomNav />
    </div>
  );
}

function WeekDetailContent() {
  const params = useParams();
  const router = useRouter();
  const weekStart = params.weekStart as string;

  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Keyboard shortcuts: left/right arrows for week navigation, 'e' for add event
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // Don't trigger in form inputs
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      router.push(`/planner/week/${getPreviousMonday(weekStart)}`);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      router.push(`/planner/week/${getNextMonday(weekStart)}`);
    } else if ((e.key === 'e' || e.key === 'E') && !showAddEventModal) {
      e.preventDefault();
      setShowAddEventModal(true);
    } else if (e.key === 'Escape' && showAddEventModal) {
      e.preventDefault();
      setShowAddEventModal(false);
    }
  }, [router, weekStart, showAddEventModal]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  const [editingEvent, setEditingEvent] = useState<{
    _id: Id<'familyEvents'>;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    eventType: 'vacation' | 'family_visit' | 'day_camp' | 'summer_school' | 'other';
    location?: string;
    notes?: string;
    color?: string;
    childIds: Id<'children'>[];
  } | null>(null);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [savingForChild, setSavingForChild] = useState<{
    childId: Id<'children'>;
    childName: string;
    sessionId: Id<'sessions'>;
  } | null>(null);

  // Get family's primary city
  const family = useQuery(api.families.queries.getCurrentFamily);

  // Calculate week end for the search query
  const weekEnd = useMemo(() => {
    const start = new Date(weekStart + 'T00:00:00');
    start.setDate(start.getDate() + 4);
    return start.toISOString().split('T')[0];
  }, [weekStart]);

  // Fetch week detail
  const weekDetail = useQuery(
    api.planner.queries.getWeekDetail,
    family?.primaryCityId
      ? { weekStartDate: weekStart, cityId: family.primaryCityId }
      : 'skip'
  );

  // Fetch all available sessions for this week (for filter chips and camp suggestions)
  const allAvailableSessions = useQuery(
    api.planner.queries.searchSessionsByWeek,
    family?.primaryCityId
      ? { cityId: family.primaryCityId, weekStartDate: weekStart, weekEndDate: weekEnd }
      : 'skip'
  );

  // Children query for the add event modal
  const children = useQuery(api.children.queries.listChildren);

  // Registration mutations
  const markInterested = useMutation(api.registrations.mutations.markInterested);
  const registerMutation = useMutation(api.registrations.mutations.register);

  // Extract unique organizations from available sessions
  const organizations = useMemo(() => {
    if (!allAvailableSessions) return [];
    const orgMap = new Map<string, { id: string; name: string }>();
    for (const session of allAvailableSessions) {
      if (session.organization && !orgMap.has(session.organization._id)) {
        orgMap.set(session.organization._id, {
          id: session.organization._id,
          name: session.organization.name,
        });
      }
    }
    return Array.from(orgMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allAvailableSessions]);

  // Extract unique locations from sessions (filtered by organization if selected)
  const locations = useMemo(() => {
    if (!allAvailableSessions) return [];

    // First filter by selected organizations if any
    let sessionsForLocations = allAvailableSessions;
    if (selectedOrganizations.length > 0) {
      sessionsForLocations = allAvailableSessions.filter(
        (s) => s.organization && selectedOrganizations.includes(s.organization._id)
      );
    }

    const locationMap = new Map<string, { id: string; name: string }>();
    for (const session of sessionsForLocations) {
      if (session.location && !locationMap.has(session.location._id)) {
        locationMap.set(session.location._id, {
          id: session.location._id,
          name: session.location.name,
        });
      }
    }
    return Array.from(locationMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allAvailableSessions, selectedOrganizations]);

  // Build available camps per child, filtered by selected organizations
  // NOTE: This must be before early returns to maintain hooks order
  type SessionType = NonNullable<typeof allAvailableSessions>[number];
  const availableCampsPerChild = useMemo(() => {
    if (!allAvailableSessions || !weekDetail) return new Map<string, SessionType[]>();

    const result = new Map<string, SessionType[]>();

    for (const childData of weekDetail.children) {
      const childAge = childData.age;
      const childGrade = childData.child.currentGrade;

      // Get sessions the child is already registered for
      const registeredSessionIds = new Set(
        childData.registrations.map((r) => r.session._id)
      );

      // Collect all covered date ranges for this child (from registrations and events)
      const coveredDateRanges: { start: string; end: string }[] = [];

      // Add date ranges from registrations (registered, interested, waitlisted)
      for (const reg of childData.registrations) {
        if (reg.status !== 'cancelled') {
          coveredDateRanges.push({
            start: reg.session.startDate,
            end: reg.session.endDate,
          });
        }
      }

      // Add date ranges from family events
      for (const event of childData.events) {
        coveredDateRanges.push({
          start: event.startDate,
          end: event.endDate,
        });
      }

      // Filter sessions for this child
      let eligibleSessions = allAvailableSessions.filter((session) => {
        // Skip already registered sessions
        if (registeredSessionIds.has(session._id)) return false;

        // Skip sessions that overlap with already-covered dates
        for (const range of coveredDateRanges) {
          if (doDateRangesOverlap(session.startDate, session.endDate, range.start, range.end)) {
            return false;
          }
        }

        // Check age requirements
        if (!isAgeInRange(childAge, session.ageRequirements)) return false;

        // Check grade requirements if child has a grade
        if (childGrade !== undefined && childGrade !== null) {
          if (!isGradeInRange(childGrade, session.ageRequirements)) return false;
        }

        // Check spots available
        if (session.spotsLeft <= 0) return false;

        return true;
      });

      // Apply organization filter if any selected
      if (selectedOrganizations.length > 0) {
        eligibleSessions = eligibleSessions.filter(
          (s) => s.organization && selectedOrganizations.includes(s.organization._id)
        );
      }

      // Apply location filter if any selected
      if (selectedLocations.length > 0) {
        eligibleSessions = eligibleSessions.filter(
          (s) => s.location && selectedLocations.includes(s.location._id)
        );
      }

      result.set(childData.child._id, eligibleSessions);
    }

    return result;
  }, [allAvailableSessions, weekDetail, selectedOrganizations, selectedLocations]);

  const totalCamps = useMemo(() => {
    return Array.from(availableCampsPerChild.values()).reduce(
      (sum, camps) => sum + camps.length,
      0
    );
  }, [availableCampsPerChild]);

  // Toggle organization filter (and clear locations when orgs change)
  const handleOrganizationToggle = (orgId: string) => {
    setSelectedOrganizations((prev) => {
      const newOrgs = prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId];
      // Clear location selection when organization filter changes
      setSelectedLocations([]);
      return newOrgs;
    });
  };

  // Toggle location filter
  const handleLocationToggle = (locationId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    );
  };

  // Handle save for child
  const handleSaveForChild = async (childId: Id<'children'>, sessionId: Id<'sessions'>) => {
    try {
      await markInterested({ childId, sessionId });
      setSavingForChild(null);
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('Failed to save session. Please try again.');
    }
  };

  // Handle marking as registered
  const handleMarkRegistered = async (childId: Id<'children'>, sessionId: Id<'sessions'>) => {
    try {
      await registerMutation({ childId, sessionId });
    } catch (error) {
      console.error('Failed to register:', error);
      alert('Failed to register. Please try again.');
    }
  };

  // Loading state
  if (weekDetail === undefined || family === undefined) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!weekDetail) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Week not found</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Could not load details for this week.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          Back to Planner
        </Link>
      </div>
    );
  }

  // Format week date range
  const weekStartDate = new Date(weekDetail.weekStartDate + 'T00:00:00');
  const weekEndDate = new Date(weekDetail.weekEndDate + 'T00:00:00');
  const dateRangeStr = `${weekStartDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })} - ${weekEndDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`;

  // Calculate summary
  const childrenWithGaps = weekDetail.children.filter((c) => c.hasGap);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {dateRangeStr}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {weekDetail.children.length} child{weekDetail.children.length === 1 ? '' : 'ren'}
            {childrenWithGaps.length > 0 ? (
              <span className="text-red-600 dark:text-red-400">
                {' '}&bull; {childrenWithGaps.length} need{childrenWithGaps.length === 1 ? 's' : ''} coverage
              </span>
            ) : (
              <span className="text-green-600 dark:text-green-400">
                {' '}&bull; All covered
              </span>
            )}
            {allAvailableSessions && (
              <span className="text-slate-500">
                {' '}&bull; {allAvailableSessions.length} camp{allAvailableSessions.length === 1 ? '' : 's'} available
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddEventModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          title="Add family event (E key)"
        >
          <PlusIcon />
          Add Event
          <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 bg-blue-700 rounded text-[10px]">E</kbd>
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/planner/week/${getPreviousMonday(weekDetail.weekStartDate)}`}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          title="Previous week (← arrow key)"
        >
          <ChevronLeftIcon />
          Previous Week
        </Link>
        <span className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">→</kbd>
          <span>navigate</span>
          <span className="mx-1">·</span>
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">E</kbd>
          <span>add event</span>
        </span>
        <Link
          href={`/planner/week/${getNextMonday(weekDetail.weekStartDate)}`}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          title="Next week (→ arrow key)"
        >
          Next Week
          <ChevronRightIcon />
        </Link>
      </div>

      {/* Organization Filter Chips - only show when there are gaps to fill */}
      {childrenWithGaps.length > 0 && organizations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Find camps to fill gaps
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {childrenWithGaps.map(c => c.child.firstName).join(', ')} need{childrenWithGaps.length === 1 ? 's' : ''} coverage
              </p>
            </div>
            {(selectedOrganizations.length > 0 || selectedLocations.length > 0) && (
              <button
                onClick={() => {
                  setSelectedOrganizations([]);
                  setSelectedLocations([]);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Organization chips */}
          <div>
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">Organizations</p>
            <div className="flex flex-wrap gap-2">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleOrganizationToggle(org.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedOrganizations.includes(org.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {org.name}
                  {selectedOrganizations.includes(org.id) && <span className="ml-1">✕</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Location chips - only show when organizations are selected and there are multiple locations */}
          {selectedOrganizations.length > 0 && locations.length > 1 && (
            <div>
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">Locations</p>
              <div className="flex flex-wrap gap-2">
                {locations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationToggle(location.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedLocations.includes(location.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {location.name}
                    {selectedLocations.includes(location.id) && <span className="ml-1">✕</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedOrganizations.length > 0 || selectedLocations.length > 0) && (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Showing {totalCamps} camp{totalCamps === 1 ? '' : 's'}
              {selectedOrganizations.length > 0 && ` from ${selectedOrganizations.length} organization${selectedOrganizations.length > 1 ? 's' : ''}`}
              {selectedLocations.length > 0 && ` at ${selectedLocations.length} location${selectedLocations.length > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      )}

      {/* Message when there are gaps but no camps available */}
      {childrenWithGaps.length > 0 && organizations.length === 0 && allAvailableSessions !== undefined && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
            {childrenWithGaps.map(c => c.child.firstName).join(', ')} need{childrenWithGaps.length === 1 ? 's' : ''} coverage
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            No camps found for this week. Try browsing all camps or add a family event.
          </p>
        </div>
      )}

      {/* Child Coverage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {weekDetail.children.map((childData) => {
          // Get filtered available camps for this child
          const filteredCamps = availableCampsPerChild.get(childData.child._id) ?? [];
          const availableCampsForCard = filteredCamps.slice(0, 25).map((s) => ({
            sessionId: s._id,
            campName: s.camp?.name ?? 'Unknown Camp',
            organizationName: s.organization?.name ?? 'Unknown',
            startDate: s.startDate,
            endDate: s.endDate,
            dropOffTime: s.dropOffTime,
            pickUpTime: s.pickUpTime,
            price: s.price,
            currency: s.currency,
            spotsLeft: s.spotsLeft,
            locationName: s.location?.name ?? 'Unknown Location',
          }));

          // Enrich events with childIds for the edit modal
          const enrichedEvents = childData.events.map(e => ({
            ...e,
            childIds: weekDetail.children
              .filter(c => c.events.some(ev => ev._id === e._id))
              .map(c => c.child._id),
          }));

          return (
            <ChildCoverageCard
              key={childData.child._id}
              child={childData.child}
              age={childData.age}
              registrations={childData.registrations}
              events={enrichedEvents}
              coveredDays={childData.coveredDays}
              hasGap={childData.hasGap}
              availableCamps={availableCampsForCard}
              onSaveForChild={(sessionId) => {
                handleSaveForChild(childData.child._id, sessionId);
              }}
              onMarkRegistered={(registrationId, sessionId) => {
                handleMarkRegistered(childData.child._id, sessionId);
              }}
              onEditEvent={(event) => setEditingEvent(event)}
            />
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          <GridIcon />
          Back to Overview
        </Link>
        <Link
          href="/discover/portland"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          <SearchIcon />
          Browse All Camps
        </Link>
      </div>

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        defaultStartDate={weekDetail.weekStartDate}
        defaultEndDate={weekDetail.weekEndDate}
        defaultChildIds={children?.map((c) => c._id) ?? []}
      />

      {/* Edit Event Modal */}
      {editingEvent && (
        <EditEventModal
          isOpen={true}
          onClose={() => setEditingEvent(null)}
          event={editingEvent}
        />
      )}
    </div>
  );
}

// Helper functions
function getPreviousMonday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
}

function getNextMonday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}

// Icons
function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
