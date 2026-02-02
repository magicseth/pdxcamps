'use client';

import Link from 'next/link';
import { Id } from '../../convex/_generated/dataModel';
import { CoverageStatus } from './CoverageIndicator';

interface Registration {
  registrationId: Id<'registrations'>;
  status: 'interested' | 'waitlisted' | 'registered' | 'cancelled';
  session: {
    _id: Id<'sessions'>;
    startDate: string;
    endDate: string;
    dropOffTime: { hour: number; minute: number };
    pickUpTime: { hour: number; minute: number };
    extendedCareAvailable: boolean;
    extendedCareDetails?: {
      earlyDropOffTime?: { hour: number; minute: number };
      latePickUpTime?: { hour: number; minute: number };
      additionalCost?: number;
    };
  };
  camp: {
    name: string;
    categories: string[];
  } | null;
  location: {
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  } | null;
  organization: {
    name: string;
    logoUrl?: string | null;
  } | null;
}

interface FamilyEvent {
  _id: Id<'familyEvents'>;
  title: string;
  eventType: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  color?: string;
}

interface AvailableCamp {
  sessionId: Id<'sessions'>;
  campName: string;
  organizationName: string;
  startDate: string;
  endDate: string;
  dropOffTime: { hour: number; minute: number };
  pickUpTime: { hour: number; minute: number };
  price: number;
  currency: string;
  spotsLeft: number;
  locationName: string;
}

interface ChildCoverageCardProps {
  child: {
    _id: Id<'children'>;
    firstName: string;
    lastName?: string;
    avatarStorageId?: Id<'_storage'>;
  };
  age: number;
  registrations: Registration[];
  events: FamilyEvent[];
  coveredDays: number;
  hasGap: boolean;
  availableCamps: AvailableCamp[];
  onSaveForChild?: (sessionId: Id<'sessions'>) => void;
  onMarkRegistered?: (registrationId: Id<'registrations'>, sessionId: Id<'sessions'>) => void;
}

export function ChildCoverageCard({
  child,
  age,
  registrations,
  events,
  coveredDays,
  hasGap,
  availableCamps,
  onSaveForChild,
  onMarkRegistered,
}: ChildCoverageCardProps) {
  const status: CoverageStatus = hasGap ? 'gap' : events.length > 0 ? 'event' : 'full';

  const statusColors = {
    full: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    partial: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    gap: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    tentative: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    event: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
  };

  const registeredCamps = registrations.filter((r) => r.status === 'registered');
  const tentativeCamps = registrations.filter((r) => r.status === 'interested' || r.status === 'waitlisted');

  return (
    <div className={`rounded-lg border-l-4 ${statusColors[status]} overflow-hidden`}>
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
            {child.firstName[0]}
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">{child.firstName}</span>
          <span className="text-xs text-slate-500">({age})</span>
        </div>
        {!hasGap && registeredCamps.length > 0 && (
          <span className="text-xs text-green-700 dark:text-green-300 font-medium flex items-center gap-1.5">
            {registeredCamps[0].organization?.logoUrl && (
              <img
                src={registeredCamps[0].organization.logoUrl}
                alt=""
                className="w-4 h-4 object-contain rounded-sm"
              />
            )}
            {registeredCamps[0].camp?.name}
          </span>
        )}
        {events.length > 0 && (
          <span className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1">
            <span>✈</span> {events[0].title}
          </span>
        )}
      </div>

      {/* Content - only show if there's a gap */}
      {hasGap && (
        <div className="px-3 py-2 bg-white dark:bg-slate-800 max-h-64 overflow-y-auto">
          {/* Tentative registrations - compact */}
          {tentativeCamps.length > 0 && (
            <div className="mb-2 pb-2 border-b border-slate-200 dark:border-slate-700 space-y-1">
              {tentativeCamps.map((reg) => (
                <div key={reg.registrationId} className="flex items-center gap-2 text-xs py-1">
                  {reg.organization?.logoUrl && (
                    <img
                      src={reg.organization.logoUrl}
                      alt=""
                      className="w-5 h-5 object-contain rounded-sm flex-shrink-0"
                    />
                  )}
                  <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">{reg.camp?.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${
                    reg.status === 'waitlisted' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {reg.status === 'waitlisted' ? 'WL' : 'Int'}
                  </span>
                  {reg.status === 'interested' && onMarkRegistered && (
                    <button
                      onClick={() => onMarkRegistered(reg.registrationId, reg.session._id)}
                      className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex-shrink-0"
                    >
                      Register
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Available camps - compact table */}
          {availableCamps.length > 0 ? (
            <div className="space-y-1">
              {availableCamps.map((camp) => (
                <div
                  key={camp.sessionId}
                  className="flex items-center gap-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded text-xs group"
                >
                  <a
                    href={`/session/${camp.sessionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 cursor-pointer"
                    title="Open in new tab"
                  >
                    <div className="font-medium text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {camp.campName}
                      <span className="ml-1 opacity-0 group-hover:opacity-100 text-blue-500">↗</span>
                    </div>
                    <div className="text-slate-500 truncate">
                      {formatTime(camp.dropOffTime)}-{formatTime(camp.pickUpTime)} · {camp.locationName}
                    </div>
                  </a>
                  <div className="text-right shrink-0">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {formatPrice(camp.price, camp.currency)}
                    </div>
                    <div className="text-slate-500">{camp.spotsLeft} left</div>
                  </div>
                  {onSaveForChild && (
                    <button
                      onClick={() => onSaveForChild(camp.sessionId)}
                      className="shrink-0 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-2">No camps match filters</div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatTime(time: { hour: number; minute: number }): string {
  const hour = time.hour % 12 || 12;
  const ampm = time.hour >= 12 ? 'p' : 'a';
  return `${hour}${ampm}`;
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  return '$' + amount.toFixed(0);
}
