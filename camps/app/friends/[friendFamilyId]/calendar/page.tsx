'use client';

import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import Link from 'next/link';
import { BottomNav } from '../../../../components/shared/BottomNav';
import { useMarket } from '../../../../hooks/useMarket';
import { BackIcon } from '../../../../components/shared/icons';

export default function FriendCalendarPage() {
  const params = useParams();
  const market = useMarket();
  const friendFamilyId = params.friendFamilyId as Id<'families'>;

  const calendarData = useQuery(api.social.queries.getFriendCalendar, {
    friendFamilyId,
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <header className="sticky top-0 z-20 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/friends"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <BackIcon />
              <span className="text-sm font-medium hidden sm:inline">Friends</span>
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {calendarData?.family?.displayName
                ? `${calendarData.family.displayName}'s Calendar`
                : 'Friend Calendar'}
            </h1>
          </div>
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">☀️</span>
            <span className="font-bold hidden sm:inline">{market.tagline}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6 pb-24">
        {calendarData === undefined ? (
          <LoadingSkeleton />
        ) : calendarData === null ? (
          <NoAccess />
        ) : (
          <CalendarContent data={calendarData} />
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none space-y-6" role="status" aria-live="polite">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading calendar...</span>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-4xl mb-4">🔒</div>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Calendar not available</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        This friend hasn't shared their calendar with you yet, or the link is invalid.
      </p>
      <Link
        href="/friends"
        className="inline-block px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
      >
        Back to Friends
      </Link>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CalendarData = any;

function CalendarContent({ data }: { data: CalendarData }) {
  const isDetailed = data.permission === 'view_details';

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/20 dark:bg-primary-dark rounded-full flex items-center justify-center">
          <span className="text-primary dark:text-primary-light text-lg font-medium">
            {data.family.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {data.family.displayName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDetailed ? 'Full details' : 'Camp names & dates'}
          </p>
        </div>
      </div>

      {data.calendar.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">No camps saved yet</p>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
            When {data.family.displayName} saves camps, they'll appear here.
          </p>
        </div>
      ) : (
        data.calendar.map((childCalendar: CalendarData) => (
          <ChildCalendar
            key={childCalendar.child._id}
            childCalendar={childCalendar}
            isDetailed={isDetailed}
          />
        ))
      )}
    </>
  );
}

function ChildCalendar({
  childCalendar,
  isDetailed,
}: {
  childCalendar: CalendarData['calendar'][number];
  isDetailed: boolean;
}) {
  const { child, registrations } = childCalendar;

  // Sort registrations by start date
  const sorted = [...registrations].sort((a, b) => {
    const aDate = a?.session?.startDate || '';
    const bDate = b?.session?.startDate || '';
    return aDate.localeCompare(bDate);
  });

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" aria-labelledby={`child-${child._id}`}>
      <h3 id={`child-${child._id}`} className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
        {child.firstName}
        {'lastName' in child && child.lastName ? ` ${child.lastName}` : ''}
      </h3>

      {sorted.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">No camps saved for {child.firstName} yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((reg) => {
            if (!reg || !reg.session || !reg.camp) return null;
            return (
              <div
                key={reg.registrationId}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{reg.camp.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatDateRange(reg.session.startDate, reg.session.endDate)}
                  </p>
                  {reg.session.dropOffTime && reg.session.pickUpTime && (
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {formatTime(reg.session.dropOffTime)} – {formatTime(reg.session.pickUpTime)}
                    </p>
                  )}
                  {isDetailed && 'price' in reg.session && reg.session.price != null && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      ${reg.session.price}
                    </p>
                  )}
                  {isDetailed && 'notes' in reg && reg.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">
                      {reg.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={reg.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    registered: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    interested: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    waitlisted: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  };

  const labels: Record<string, string> = {
    registered: 'Registered',
    interested: 'Interested',
    waitlisted: 'Waitlisted',
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
    >
      {labels[status] || status}
    </span>
  );
}

function formatTime(time: { hour: number; minute: number } | string): string {
  if (typeof time === 'string') return time;
  const h = time.hour;
  const m = time.minute;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayH} ${period}` : `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', options)} – ${end.getDate()}`;
    }
    return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', options)}`;
  } catch {
    return `${startDate} – ${endDate}`;
  }
}
