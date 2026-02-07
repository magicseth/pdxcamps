'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { getChildAge, calculateDisplayAge } from '../../lib/dateUtils';
import { CloseIcon } from '../shared/icons';

export function SaveSessionModal({
  sessionId,
  campName,
  onClose,
  onPaywallHit,
  preSelectedChildId,
  ageRequirements,
}: {
  sessionId: Id<'sessions'>;
  campName: string;
  onClose: () => void;
  onPaywallHit: () => void;
  preSelectedChildId?: Id<'children'> | null;
  ageRequirements: {
    minAge?: number;
    maxAge?: number;
    minGrade?: number;
    maxGrade?: number;
  };
}) {
  const [selectedChildIds, setSelectedChildIds] = useState<Set<Id<'children'>>>(new Set());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const children = useQuery(api.children.queries.listChildren);
  const markInterested = useMutation(api.registrations.mutations.markInterested);

  // Check if a child is eligible based on age/grade requirements
  const checkEligibility = (child: { birthdate: string; currentGrade?: number }): { eligible: boolean; reason?: string } => {
    const age = getChildAge(child.birthdate);
    const grade = child.currentGrade;

    // Check age requirements
    if (age !== null) {
      if (ageRequirements.minAge !== undefined && age < ageRequirements.minAge) {
        return { eligible: false, reason: `Too young (${age}y, needs ${ageRequirements.minAge}+)` };
      }
      if (ageRequirements.maxAge !== undefined && age > ageRequirements.maxAge) {
        return { eligible: false, reason: `Too old (${age}y, max ${ageRequirements.maxAge})` };
      }
    }

    // Check grade requirements
    if (grade !== undefined) {
      if (ageRequirements.minGrade !== undefined && grade < ageRequirements.minGrade) {
        const minGradeLabel = ageRequirements.minGrade === 0 ? 'K' : `${ageRequirements.minGrade}`;
        const childGradeLabel = grade === 0 ? 'K' : grade < 0 ? 'Pre-K' : `${grade}`;
        return { eligible: false, reason: `Grade too low (${childGradeLabel}, needs ${minGradeLabel}+)` };
      }
      if (ageRequirements.maxGrade !== undefined && grade > ageRequirements.maxGrade) {
        const maxGradeLabel = ageRequirements.maxGrade === 0 ? 'K' : `${ageRequirements.maxGrade}`;
        const childGradeLabel = grade === 0 ? 'K' : `${grade}`;
        return { eligible: false, reason: `Grade too high (${childGradeLabel}, max ${maxGradeLabel})` };
      }
    }

    return { eligible: true };
  };

  // Initialize selection when children load - pre-select the filtered child if eligible
  useEffect(() => {
    if (children && !initialized) {
      const initialSelection = new Set<Id<'children'>>();

      // If there's a pre-selected child and they're eligible, select them
      if (preSelectedChildId) {
        const preSelectedChild = children.find(c => c._id === preSelectedChildId);
        if (preSelectedChild) {
          const { eligible } = checkEligibility(preSelectedChild);
          if (eligible) {
            initialSelection.add(preSelectedChildId);
          }
        }
      }

      setSelectedChildIds(initialSelection);
      setInitialized(true);
    }
  }, [children, preSelectedChildId, initialized]);

  const toggleChild = (childId: Id<'children'>) => {
    setSelectedChildIds(prev => {
      const next = new Set(prev);
      if (next.has(childId)) {
        next.delete(childId);
      } else {
        next.add(childId);
      }
      return next;
    });
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !success) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, success]);

  const handleSave = async () => {
    if (selectedChildIds.size === 0) {
      setError('Please select at least one child');
      return;
    }

    try {
      setError(null);
      setIsSaving(true);

      // Save for each selected child
      const childIdArray = Array.from(selectedChildIds);
      for (const childId of childIdArray) {
        await markInterested({
          childId,
          sessionId,
          notes: notes || undefined,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      // Check for paywall error - ConvexError has data property
      console.log('Save error:', err);

      // Handle ConvexError with structured data
      if (err instanceof ConvexError) {
        const data = err.data as { type?: string; code?: string } | undefined;
        console.log('ConvexError data:', data);
        if (data?.type === 'PAYWALL') {
          console.log('Paywall detected via ConvexError, showing upgrade modal');
          onClose();
          onPaywallHit();
          return;
        }
      }

      // Fallback: check error message for legacy support
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('PAYWALL:')) {
        console.log('Paywall detected via message, showing upgrade modal');
        onClose();
        onPaywallHit();
        return;
      }

      setError(errorMessage || 'Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !success) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-camp-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 id="save-camp-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Save {campName}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {success ? (
          <div role="status" className="text-center py-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <svg
                className="w-16 h-16 text-pink-500 animate-bounce motion-reduce:animate-none"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-pink-500/20 animate-ping motion-reduce:animate-none" />
              </div>
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-white">Saved!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This session has been added to your list.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                {error}
              </div>
            )}

            {children === undefined ? (
              <div className="py-8 text-center text-slate-500">Loading children...</div>
            ) : children.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  You need to add a child to your family first.
                </p>
                <Link
                  href="/onboarding"
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  Add a child
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Children
                  </label>
                  <div className="space-y-2">
                    {children.map((child) => {
                      const { eligible, reason } = checkEligibility(child);
                      const isSelected = selectedChildIds.has(child._id);

                      return (
                        <label
                          key={child._id}
                          className={`flex items-center gap-3 p-3 rounded-md border ${
                            !eligible
                              ? 'cursor-not-allowed opacity-60 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                              : isSelected
                                ? 'cursor-pointer border-primary bg-primary/10 dark:bg-primary-dark/30'
                                : 'cursor-pointer border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={child._id}
                            checked={isSelected}
                            disabled={!eligible}
                            onChange={() => eligible && toggleChild(child._id)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            !eligible
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700'
                              : isSelected
                                ? 'border-primary bg-primary'
                                : 'border-slate-300 dark:border-slate-500'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium flex-shrink-0">
                            {child.firstName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${!eligible ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                              {child.firstName} {child.lastName}
                            </p>
                            {child.birthdate && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {calculateDisplayAge(child.birthdate)}
                              </p>
                            )}
                            {!eligible && reason && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                {reason}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="save-session-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    id="save-session-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Check carpool options, ask about early drop-off..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

