// Shared frontend types

import { Id } from '../convex/_generated/dataModel';

export type CoverageStatus = 'full' | 'partial' | 'gap' | 'tentative' | 'event' | 'school';

export interface ChildCoverage {
  childId: Id<'children'>;
  childName: string;
  status: CoverageStatus;
  coveredDays: number;
  registrations: {
    registrationId: string;
    sessionId: string;
    campName: string;
    organizationName?: string;
    organizationLogoUrl?: string | null;
    status: string;
    registrationUrl?: string | null;
  }[];
  events: {
    eventId: Id<'familyEvents'>;
    title: string;
  }[];
}

export interface WeekData {
  week: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    monthName: string;
    label: string;
  };
  childCoverage: ChildCoverage[];
  hasGap: boolean;
  hasFamilyEvent: boolean;
}

export interface RegistrationClickData {
  registrationId: string;
  sessionId: string;
  childId: Id<'children'>;
  childName: string;
  campName: string;
  organizationName?: string;
  organizationLogoUrl?: string | null;
  status: string;
  weekLabel: string;
  registrationUrl?: string | null;
}

export interface EventClickData {
  eventId: Id<'familyEvents'>;
  title: string;
  childId: Id<'children'>;
  childName: string;
  weekLabel: string;
}
