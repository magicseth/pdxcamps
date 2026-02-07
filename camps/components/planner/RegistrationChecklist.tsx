'use client';

import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { DEFAULT_CHILD_COLORS } from '../../lib/constants';
import { MarkRegisteredModal } from './MarkRegisteredModal';

interface RegistrationChecklistProps {
  isOpen: boolean;
  onClose: () => void;
  children: { _id: Id<'children'>; firstName: string; color?: string }[];
}

interface PendingCamp {
  registrationId: Id<'registrations'>;
  sessionId: Id<'sessions'>;
  childId: Id<'children'>;
  childName: string;
  childColor: string;
  campName: string;
  organizationName?: string;
  organizationLogoUrl?: string | null;
  dateRange: string;
  price?: number | null;
  registrationUrl?: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RegistrationChecklist({ isOpen, onClose, children }: RegistrationChecklistProps) {
  const savedCamps = useQuery(api.registrations.queries.getSavedCamps);
  const [selectedCamp, setSelectedCamp] = useState<PendingCamp | null>(null);

  // Build child color map
  const childColors = useMemo(() => {
    const map: Record<string, string> = {};
    children.forEach((child, index) => {
      map[child._id] = child.color || DEFAULT_CHILD_COLORS[index % DEFAULT_CHILD_COLORS.length];
    });
    return map;
  }, [children]);

  // Transform saved camps into grouped data by child
  const groupedCamps = useMemo(() => {
    if (!savedCamps) return [];

    const groups: Map<string, { childName: string; childColor: string; camps: PendingCamp[] }> = new Map();

    for (const reg of savedCamps.interested) {
      if (!reg.child || !reg.session) continue;

      const childId = reg.child._id;
      if (!groups.has(childId)) {
        groups.set(childId, {
          childName: reg.child.firstName,
          childColor: childColors[childId] || DEFAULT_CHILD_COLORS[0],
          camps: [],
        });
      }

      groups.get(childId)!.camps.push({
        registrationId: reg._id,
        sessionId: reg.session._id,
        childId: reg.child._id,
        childName: reg.child.firstName,
        childColor: childColors[childId] || DEFAULT_CHILD_COLORS[0],
        campName: reg.session.camp?.name ?? 'Unknown Camp',
        organizationName: reg.session.organization?.name,
        organizationLogoUrl: undefined, // getSavedCamps doesn't return logo
        dateRange: `${formatDate(reg.session.startDate)} - ${formatDate(reg.session.endDate)}`,
        price: reg.session.price,
        registrationUrl: reg.session.externalRegistrationUrl,
      });
    }

    return Array.from(groups.values());
  }, [savedCamps, childColors]);

  const totalPending = savedCamps?.interested.length ?? 0;

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
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Registration Checklist
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {totalPending} camp{totalPending === 1 ? '' : 's'} need{totalPending === 1 ? 's' : ''} your action
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedCamps.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                All done!
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You've registered for all your saved camps
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedCamps.map((group) => (
                <div key={group.childName}>
                  {/* Child header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: group.childColor }}
                    >
                      {group.childName[0]}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {group.childName}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      ({group.camps.length})
                    </span>
                  </div>

                  {/* Camp cards */}
                  <div className="space-y-3 pl-9">
                    {group.camps.map((camp) => (
                      <div
                        key={camp.registrationId}
                        className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600"
                      >
                        <div className="flex items-start gap-3">
                          {/* Empty checkbox visual */}
                          <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-amber-400 dark:border-amber-500 flex-shrink-0" />

                          {/* Camp info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-white truncate">
                              {camp.campName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {camp.organizationName && (
                                <>
                                  <span className="truncate">{camp.organizationName}</span>
                                  <span className="text-slate-300 dark:text-slate-600">|</span>
                                </>
                              )}
                              <span>{camp.dateRange}</span>
                            </div>
                            {camp.price && (
                              <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                                ${(camp.price / 100).toFixed(0)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3 pl-8">
                          {camp.registrationUrl && (
                            <a
                              href={camp.registrationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
                            >
                              Register
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedCamp(camp)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Done
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mark Registered Modal */}
      <MarkRegisteredModal
        isOpen={selectedCamp !== null}
        onClose={() => setSelectedCamp(null)}
        registration={selectedCamp ? {
          registrationId: selectedCamp.registrationId,
          sessionId: selectedCamp.sessionId,
          childId: selectedCamp.childId,
          childName: selectedCamp.childName,
          campName: selectedCamp.campName,
          organizationName: selectedCamp.organizationName,
          organizationLogoUrl: selectedCamp.organizationLogoUrl,
          dateRange: selectedCamp.dateRange,
        } : null}
        remainingCount={totalPending - 1}
      />
    </>
  );
}

// Floating action button for quick access to checklist
interface ChecklistFABProps {
  pendingCount: number;
  onClick: () => void;
}

export function ChecklistFAB({ pendingCount, onClick }: ChecklistFABProps) {
  if (pendingCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-4 py-3 bg-amber-500 text-white font-medium rounded-full shadow-lg hover:bg-amber-600 transition-all hover:scale-105 active:scale-95"
    >
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
      </span>
      <span>{pendingCount} to register</span>
    </button>
  );
}
