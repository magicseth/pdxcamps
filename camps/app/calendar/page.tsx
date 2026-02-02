'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import Link from 'next/link';
import { Authenticated, Unauthenticated } from 'convex/react';
import { BottomNav } from '../../components/shared/BottomNav';

type ViewMode = 'month' | 'list';
type RegistrationStatus = 'interested' | 'waitlisted' | 'registered' | 'cancelled';

const STATUS_COLORS: Record<RegistrationStatus, { bg: string; text: string; border: string }> = {
  interested: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  registered: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  waitlisted: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700 line-through', border: 'border-red-300' },
};

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  interested: 'Interested',
  registered: 'Registered',
  waitlisted: 'Waitlisted',
  cancelled: 'Cancelled',
};

// Date helpers
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  if (startDate === endDate) {
    return formatDate(startDate);
  }

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}`;
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatTime(time: { hour: number; minute: number }): string {
  const hour = time.hour % 12 || 12;
  const ampm = time.hour >= 12 ? 'PM' : 'AM';
  const minute = time.minute.toString().padStart(2, '0');
  return `${hour}:${minute} ${ampm}`;
}

function getMonthDates(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.ceil((diff / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7);
}

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: Date[] = [];

  // Add days from previous month to fill the first week
  const prevMonthLastDay = new Date(year, month, 0);
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthLastDay.getDate() - i));
  }

  // Add days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Add days from next month to fill the last week
  const remainingDays = 42 - days.length; // 6 rows x 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
              <BackIcon />
              <span className="text-sm font-medium hidden sm:inline">Planner</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">My Camps</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <span className="font-bold hidden sm:inline">PDX Camps</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="p-4 md:p-8">
        <Authenticated>
          <CalendarContent />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-slate-600 dark:text-slate-400">Please sign in to view your calendar.</p>
            <a href="/sign-in">
              <button className="bg-foreground text-background px-6 py-2 rounded-md">Sign in</button>
            </a>
          </div>
        </Unauthenticated>
      </main>

      <BottomNav />
    </div>
  );
}

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

function CalendarContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedChildId, setSelectedChildId] = useState<Id<'children'> | 'all'>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<RegistrationStatus>>(
    new Set(['interested', 'registered', 'waitlisted'])
  );
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [editingNotesId, setEditingNotesId] = useState<Id<'registrations'> | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { startDate, endDate } = getMonthDates(year, month);

  // Queries
  const children = useQuery(api.children.queries.listChildren);
  const registrations = useQuery(api.registrations.queries.getFamilyCalendar, {
    startDate,
    endDate,
    statuses: Array.from(selectedStatuses),
  });

  // Mutations
  const cancelRegistration = useMutation(api.registrations.mutations.cancelRegistration);
  const updateNotes = useMutation(api.registrations.mutations.updateRegistrationNotes);

  // Filter registrations by selected child
  const filteredRegistrations = useMemo(() => {
    if (!registrations) return [];
    if (selectedChildId === 'all') return registrations;
    return registrations.filter((r) => r.childId === selectedChildId);
  }, [registrations, selectedChildId]);

  // Group registrations by week for list view
  const groupedByWeek = useMemo(() => {
    const groups: Map<number, typeof filteredRegistrations> = new Map();

    for (const reg of filteredRegistrations) {
      if (!reg.session) continue;
      const weekNum = getWeekNumber(reg.session.startDate);
      if (!groups.has(weekNum)) {
        groups.set(weekNum, []);
      }
      groups.get(weekNum)!.push(reg);
    }

    // Sort each group by start date
    for (const regs of groups.values()) {
      regs.sort((a, b) => {
        if (!a.session || !b.session) return 0;
        return a.session.startDate.localeCompare(b.session.startDate);
      });
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a - b);
  }, [filteredRegistrations]);

  // Group registrations by date for month view
  const registrationsByDate = useMemo(() => {
    const map: Map<string, typeof filteredRegistrations> = new Map();

    for (const reg of filteredRegistrations) {
      if (!reg.session) continue;

      // Add to each date the session spans
      const start = new Date(reg.session.startDate + 'T00:00:00');
      const end = new Date(reg.session.endDate + 'T00:00:00');

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        // Avoid duplicates
        const existing = map.get(dateKey)!;
        if (!existing.some(r => r._id === reg._id)) {
          existing.push(reg);
        }
      }
    }

    return map;
  }, [filteredRegistrations]);

  const handlePrevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
  }, [year, month]);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
  }, [year, month]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Keyboard shortcuts: left/right arrows for month navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't trigger in form inputs
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevMonth();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextMonth();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleToday();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevMonth, handleNextMonth, handleToday]);

  const handleCancelRegistration = async (registrationId: Id<'registrations'>) => {
    if (!confirm('Are you sure you want to cancel this registration?')) return;
    try {
      await cancelRegistration({ registrationId });
    } catch (error) {
      console.error('Failed to cancel registration:', error);
      alert('Failed to cancel registration. Please try again.');
    }
  };

  const handleSaveNotes = async (registrationId: Id<'registrations'>) => {
    try {
      await updateNotes({ registrationId, notes: notesValue || undefined });
      setEditingNotesId(null);
      setNotesValue('');
    } catch (error) {
      console.error('Failed to update notes:', error);
      alert('Failed to update notes. Please try again.');
    }
  };

  const toggleStatus = (status: RegistrationStatus) => {
    const newStatuses = new Set(selectedStatuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    setSelectedStatuses(newStatuses);
  };

  if (registrations === undefined || children === undefined) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const calendarDays = getCalendarDays(year, month);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            aria-label="Previous month"
            title="Previous month (← arrow key)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold min-w-[180px] text-center">{monthName}</h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            aria-label="Next month"
            title="Next month (→ arrow key)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={handleToday}
            className="ml-2 px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Jump to today (T key)"
          >
            Today
          </button>
          <span className="hidden sm:flex items-center gap-2 ml-3 text-xs text-slate-400">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">→</kbd>
            <span>navigate</span>
            <span className="mx-1">·</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">T</kbd>
            <span>today</span>
          </span>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              viewMode === 'list'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              viewMode === 'month'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Child Filter */}
        {children.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Child:</label>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value as Id<'children'> | 'all')}
              className="border rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
            >
              <option value="all">All children</option>
              {children.map((child) => (
                <option key={child._id} value={child._id}>
                  {child.firstName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Status:</label>
          {(['interested', 'registered', 'waitlisted', 'cancelled'] as RegistrationStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                selectedStatuses.has(status)
                  ? `${STATUS_COLORS[status].bg} ${STATUS_COLORS[status].text} ${STATUS_COLORS[status].border}`
                  : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredRegistrations.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold mb-2">No camps scheduled</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            {selectedStatuses.size === 0
              ? 'Select at least one status filter to see registrations.'
              : 'You haven\'t registered for any camps yet. Discover amazing summer camps for your kids!'}
          </p>
          <Link
            href="/discover/portland"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700"
          >
            Discover Camps
          </Link>
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && filteredRegistrations.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((date, index) => {
              const dateKey = date.toISOString().split('T')[0];
              const isCurrentMonth = date.getMonth() === month;
              const isToday = dateKey === new Date().toISOString().split('T')[0];
              const dayRegistrations = registrationsByDate.get(dateKey) || [];

              return (
                <div
                  key={index}
                  className={`min-h-[100px] border-b border-r p-1 ${
                    isCurrentMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`text-sm mb-1 ${
                    isToday
                      ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                      : isCurrentMonth
                        ? 'text-slate-900 dark:text-slate-100'
                        : 'text-slate-400'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayRegistrations.slice(0, 3).map((reg) => (
                      <div
                        key={reg._id}
                        className={`text-xs px-1 py-0.5 rounded truncate ${STATUS_COLORS[reg.status].bg} ${STATUS_COLORS[reg.status].text}`}
                        title={`${reg.session?.camp?.name || 'Camp'} - ${reg.child?.firstName || 'Child'}`}
                      >
                        {reg.session?.camp?.name || 'Camp'}
                      </div>
                    ))}
                    {dayRegistrations.length > 3 && (
                      <div className="text-xs text-slate-500 px-1">
                        +{dayRegistrations.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filteredRegistrations.length > 0 && (
        <div className="space-y-8">
          {groupedByWeek.map(([weekNum, regs]) => (
            <div key={weekNum}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Week {weekNum}
              </h3>
              <div className="space-y-4">
                {regs.map((reg) => (
                  <RegistrationCard
                    key={reg._id}
                    registration={reg}
                    onCancel={() => handleCancelRegistration(reg._id)}
                    isEditingNotes={editingNotesId === reg._id}
                    notesValue={notesValue}
                    onStartEditNotes={() => {
                      setEditingNotesId(reg._id);
                      setNotesValue(reg.notes || '');
                    }}
                    onCancelEditNotes={() => {
                      setEditingNotesId(null);
                      setNotesValue('');
                    }}
                    onNotesChange={setNotesValue}
                    onSaveNotes={() => handleSaveNotes(reg._id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RegistrationCardProps {
  registration: {
    _id: Id<'registrations'>;
    status: RegistrationStatus;
    notes?: string;
    waitlistPosition?: number;
    child: { firstName: string; lastName?: string } | null;
    session: {
      startDate: string;
      endDate: string;
      dropOffTime: { hour: number; minute: number };
      pickUpTime: { hour: number; minute: number };
      camp: { name: string } | null;
      organization: { name: string } | null;
      location: {
        name: string;
        address: { street: string; city: string; state: string; zip: string };
      } | null;
    } | null;
  };
  onCancel: () => void;
  isEditingNotes: boolean;
  notesValue: string;
  onStartEditNotes: () => void;
  onCancelEditNotes: () => void;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
}

function RegistrationCard({
  registration,
  onCancel,
  isEditingNotes,
  notesValue,
  onStartEditNotes,
  onCancelEditNotes,
  onNotesChange,
  onSaveNotes,
}: RegistrationCardProps) {
  const { status, child, session, notes, waitlistPosition } = registration;
  const statusColors = STATUS_COLORS[status];

  if (!session) {
    return null;
  }

  return (
    <div className={`border rounded-lg p-4 ${statusColors.border}`}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Main Info */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className={`font-semibold text-lg ${status === 'cancelled' ? 'line-through text-slate-500' : ''}`}>
                {session.camp?.name || 'Unknown Camp'}
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {session.organization?.name || 'Unknown Organization'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
              {STATUS_LABELS[status]}
              {status === 'waitlisted' && waitlistPosition && ` #${waitlistPosition}`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDateRange(session.startDate, session.endDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatTime(session.dropOffTime)} - {formatTime(session.pickUpTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>
                {session.location?.name || 'Unknown Location'}
                {session.location?.address && `, ${session.location.address.city}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{child?.firstName || 'Unknown Child'}</span>
            </div>
          </div>

          {/* Notes */}
          {isEditingNotes ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={notesValue}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add notes about this registration..."
                className="w-full border rounded-md p-2 text-sm resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={onSaveNotes}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={onCancelEditNotes}
                  className="px-3 py-1 text-sm border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : notes ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic mt-2">
              Note: {notes}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        {status !== 'cancelled' && (
          <div className="flex gap-2 md:flex-col">
            <button
              onClick={onStartEditNotes}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {notes ? 'Edit Notes' : 'Add Notes'}
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
