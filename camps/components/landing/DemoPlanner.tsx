'use client';

import { useMemo } from 'react';
import { Id } from '../../convex/_generated/dataModel';
import { PlannerGrid } from '../planner/PlannerGrid';
import { OrgFilterChip } from '../shared/OrgFilterChip';
import type { WeekData, ChildCoverage } from '../../lib/types';

/**
 * Demo planner for the landing page.
 * Builds fake WeekData[] from real session data and feeds it to
 * the real PlannerGrid component. No separate grid to keep in sync.
 */

// ─── Types ────────────────────────────────────────────────────────

interface DemoSession {
  _id: string;
  campName: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  startDate: string;
  endDate: string;
  categories: string[];
}

interface DemoOrg {
  _id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

interface DemoPlannerProps {
  sessions?: DemoSession[] | null;
  organizations?: DemoOrg[] | null;
}

// ─── Fake children ────────────────────────────────────────────────

const FAKE_CHILDREN = [
  {
    _id: 'demo-child-emma' as Id<'children'>,
    firstName: 'Emma',
    color: '#5B9BD5',
    currentGrade: 2,
  },
  {
    _id: 'demo-child-liam' as Id<'children'>,
    firstName: 'Liam',
    color: '#7CB887',
    currentGrade: 4,
  },
];

// ─── 13 summer weeks ──────────────────────────────────────────────

const SUMMER_WEEKS = [
  { weekNumber: 1, startDate: '2025-06-02', endDate: '2025-06-06', monthName: 'June', label: 'Week 1 Jun 2-6' },
  { weekNumber: 2, startDate: '2025-06-09', endDate: '2025-06-13', monthName: 'June', label: 'Week 2 Jun 9-13' },
  { weekNumber: 3, startDate: '2025-06-16', endDate: '2025-06-20', monthName: 'June', label: 'Week 3 Jun 16-20' },
  { weekNumber: 4, startDate: '2025-06-23', endDate: '2025-06-27', monthName: 'June', label: 'Week 4 Jun 23-27' },
  { weekNumber: 5, startDate: '2025-06-30', endDate: '2025-07-03', monthName: 'July', label: 'Week 5 Jun 30-Jul 3' },
  { weekNumber: 6, startDate: '2025-07-07', endDate: '2025-07-11', monthName: 'July', label: 'Week 6 Jul 7-11' },
  { weekNumber: 7, startDate: '2025-07-14', endDate: '2025-07-18', monthName: 'July', label: 'Week 7 Jul 14-18' },
  { weekNumber: 8, startDate: '2025-07-21', endDate: '2025-07-25', monthName: 'July', label: 'Week 8 Jul 21-25' },
  { weekNumber: 9, startDate: '2025-07-28', endDate: '2025-08-01', monthName: 'August', label: 'Week 9 Jul 28-Aug 1' },
  { weekNumber: 10, startDate: '2025-08-04', endDate: '2025-08-08', monthName: 'August', label: 'Week 10 Aug 4-8' },
  { weekNumber: 11, startDate: '2025-08-11', endDate: '2025-08-15', monthName: 'August', label: 'Week 11 Aug 11-15' },
  { weekNumber: 12, startDate: '2025-08-18', endDate: '2025-08-22', monthName: 'August', label: 'Week 12 Aug 18-22' },
  { weekNumber: 13, startDate: '2025-08-25', endDate: '2025-08-29', monthName: 'August', label: 'Week 13 Aug 25-29' },
];

// ─── Coverage patterns ────────────────────────────────────────────

// Each entry defines what coverage status a child has for that week.
// 'registered'/'waitlisted'/'interested' slots will be filled with real sessions.
type SlotType = 'registered' | 'gap' | 'event' | 'waitlisted' | 'interested';

const EMMA_PATTERN: SlotType[] = [
  'registered', 'registered', 'gap', 'interested', 'registered',
  'gap', 'event', 'registered', 'registered', 'gap',
  'waitlisted', 'registered', 'gap',
];

const LIAM_PATTERN: SlotType[] = [
  'gap', 'registered', 'registered', 'gap', 'interested',
  'registered', 'event', 'gap', 'registered', 'registered',
  'gap', 'waitlisted', 'registered',
];

// Gap counts to show in gap cells (how many camps are available)
const GAP_COUNTS: Record<string, number[]> = {
  emma: [12, 8, 5, 3],
  liam: [15, 10, 7, 4],
};

// ─── Build WeekData[] from real sessions ──────────────────────────

function buildDemoCoverage(sessions: DemoSession[]): WeekData[] {
  // Dedupe sessions by camp name
  const seen = new Set<string>();
  const unique: DemoSession[] = [];
  for (const s of sessions) {
    if (!seen.has(s.campName)) {
      seen.add(s.campName);
      unique.push(s);
    }
  }

  // Session pickers — different offsets per child so grids don't mirror
  const emmaIdx = { current: 0 };
  const liamIdx = { current: unique.length > 5 ? 5 : 0 };

  function pickSession(counter: { current: number }): DemoSession | undefined {
    if (unique.length === 0) return undefined;
    const s = unique[counter.current % unique.length];
    counter.current++;
    return s;
  }

  function buildChildCoverage(
    childId: Id<'children'>,
    childName: string,
    pattern: SlotType[],
    gapCounts: number[],
    counter: { current: number },
    weekIdx: number
  ): ChildCoverage {
    const slot = pattern[weekIdx];

    if (slot === 'event') {
      return {
        childId,
        childName,
        status: 'event',
        coveredDays: 5,
        registrations: [],
        events: [{ eventId: 'demo-event' as Id<'familyEvents'>, title: 'Beach Vacation' }],
      };
    }

    if (slot === 'gap') {
      const gapIdx = pattern.slice(0, weekIdx + 1).filter((s) => s === 'gap').length - 1;
      return {
        childId,
        childName,
        status: 'gap',
        coveredDays: 0,
        registrations: [],
        events: [],
        // Gap counts are communicated via sessionCounts prop, not here
      };
    }

    // registered, waitlisted, or interested — use a real session
    const session = pickSession(counter);
    const regStatus = slot === 'registered' ? 'registered' : slot === 'waitlisted' ? 'waitlisted' : 'interested';

    return {
      childId,
      childName,
      status: slot === 'registered' ? 'full' : 'tentative',
      coveredDays: slot === 'registered' ? 5 : 0,
      registrations: session
        ? [
            {
              registrationId: `demo-reg-${childName}-${weekIdx}`,
              sessionId: session._id,
              campName: session.campName,
              organizationName: session.organizationName,
              organizationLogoUrl: session.organizationLogoUrl,
              status: regStatus,
            },
          ]
        : [
            {
              registrationId: `demo-reg-${childName}-${weekIdx}`,
              sessionId: `demo-session-${weekIdx}`,
              campName: 'Summer Camp',
              status: regStatus,
            },
          ],
      events: [],
    };
  }

  return SUMMER_WEEKS.map((week, wi) => {
    const emmaCov = buildChildCoverage(
      FAKE_CHILDREN[0]._id, 'Emma', EMMA_PATTERN, GAP_COUNTS.emma, emmaIdx, wi
    );
    const liamCov = buildChildCoverage(
      FAKE_CHILDREN[1]._id, 'Liam', LIAM_PATTERN, GAP_COUNTS.liam, liamIdx, wi
    );

    return {
      week,
      childCoverage: [emmaCov, liamCov],
      hasGap: emmaCov.status === 'gap' || liamCov.status === 'gap',
      hasFamilyEvent: emmaCov.status === 'event' || liamCov.status === 'event',
    };
  });
}

/** Build sessionCounts for gap cells (shows "N camps available") */
function buildSessionCounts(): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {};
  let emmaGapIdx = 0;
  let liamGapIdx = 0;

  SUMMER_WEEKS.forEach((week, wi) => {
    const weekCounts: Record<string, number> = {};
    if (EMMA_PATTERN[wi] === 'gap') {
      weekCounts[FAKE_CHILDREN[0]._id] = GAP_COUNTS.emma[emmaGapIdx] ?? 5;
      emmaGapIdx++;
    }
    if (LIAM_PATTERN[wi] === 'gap') {
      weekCounts[FAKE_CHILDREN[1]._id] = GAP_COUNTS.liam[liamGapIdx] ?? 5;
      liamGapIdx++;
    }
    if (Object.keys(weekCounts).length > 0) {
      counts[week.startDate] = weekCounts;
    }
  });

  return counts;
}

// ─── Filter chips bar ─────────────────────────────────────────────

const CATEGORY_CHIPS = ['Sports', 'Arts', 'STEM', 'Nature'];
const noop = () => {};

function FilterChipsBar({ organizations }: { organizations: DemoOrg[] }) {
  const orgs = organizations.slice(0, 6);

  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
      <div className="flex items-center gap-2 overflow-x-auto">
        {orgs.map((org, i) => (
          <OrgFilterChip
            key={org._id}
            id={org._id}
            name={org.name}
            logoUrl={org.logoUrl}
            isSelected={i < 2}
            onClick={noop}
            showCount={false}
            size="sm"
          />
        ))}

        {orgs.length > 0 && <span className="w-px h-5 bg-slate-300 flex-shrink-0 mx-1" />}

        {CATEGORY_CHIPS.map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 bg-white text-slate-600 border border-slate-300"
          >
            {cat}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: 'bg-green-100', border: '', icon: '✓', label: 'Registered' },
    { color: 'bg-accent/10', border: '', icon: '5', label: 'Camps available' },
    { color: 'bg-surface/30', border: '', icon: '✈️', label: 'Family event' },
    { color: 'bg-yellow-100', border: '', icon: '⏳', label: 'Waitlisted' },
    { color: 'bg-amber-50', border: 'border-l-2 border-l-amber-400', icon: '○', label: 'Interested' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 text-xs text-slate-500">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] ${item.color} ${item.border}`}
          >
            {item.icon}
          </span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────

export function DemoPlanner({ sessions, organizations }: DemoPlannerProps) {
  const orgs = organizations ?? [];

  const coverage = useMemo(() => buildDemoCoverage(sessions ?? []), [sessions]);
  const sessionCounts = useMemo(() => buildSessionCounts(), []);

  return (
    <div className="mt-12 mb-4">
      <p className="text-center text-sm font-medium text-slate-500 mb-3 uppercase tracking-wider">
        Example summer plan
      </p>
      <div className="max-w-5xl mx-auto rounded-xl border border-slate-200 shadow-lg bg-white overflow-hidden hover:shadow-xl transition-shadow">
        {/* Filter chips bar */}
        {orgs.length > 0 && <FilterChipsBar organizations={orgs} />}

        {/* Real PlannerGrid with fake data */}
        <PlannerGrid
          coverage={coverage}
          children={FAKE_CHILDREN}
          sessionCounts={sessionCounts}
          onGapClick={noop}
          onRegistrationClick={noop}
          onEventClick={noop}
        />
      </div>
      <Legend />
      <p className="text-center text-sm text-slate-500 mt-3">
        Your whole summer at a glance — <span className="text-green-600 font-medium">green</span> means covered,{' '}
        <span className="text-accent-dark font-medium">orange</span> means find a camp
      </p>
    </div>
  );
}
