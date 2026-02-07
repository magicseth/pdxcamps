'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import Link from 'next/link';
import confetti from 'canvas-confetti';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: {
    registrationId: Id<'registrations'>;
    sessionId: Id<'sessions'>;
    childId: Id<'children'>;
    childName: string;
    campName: string;
    organizationName?: string;
    organizationLogoUrl?: string | null;
    status: 'interested' | 'waitlisted' | 'registered' | 'cancelled';
    weekLabel: string;
    registrationUrl?: string | null;
    notes?: string;
  } | null;
  citySlug?: string;
}

export function RegistrationModal({ isOpen, onClose, registration, citySlug }: RegistrationModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const registerMutation = useMutation(api.registrations.mutations.register);
  const cancelMutation = useMutation(api.registrations.mutations.cancelRegistration);

  if (!isOpen || !registration) return null;

  const fireConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      zIndex: 9999,
    });
  };

  const handleMarkRegistered = async () => {
    setIsUpdating(true);
    try {
      await registerMutation({
        childId: registration.childId,
        sessionId: registration.sessionId,
      });
      fireConfetti();
      onClose();
    } catch (error) {
      console.error('Failed to update registration:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    setIsUpdating(true);
    try {
      await cancelMutation({
        registrationId: registration.registrationId,
      });
      onClose();
    } catch (error) {
      console.error('Failed to remove registration:', error);
    } finally {
      setIsUpdating(false);
      setShowConfirmRemove(false);
    }
  };

  const statusLabels = {
    interested: { label: 'Saved', color: 'bg-accent/20 text-accent-dark' },
    waitlisted: { label: 'Waitlisted', color: 'bg-yellow-100 text-yellow-800' },
    registered: { label: 'Registered', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600' },
  };

  const currentStatus = statusLabels[registration.status];

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header with camp info */}
        <div className="bg-gradient-to-br from-primary to-primary-dark p-6 text-white">
          <div className="flex items-start gap-4">
            {registration.organizationLogoUrl ? (
              <div className="w-14 h-14 rounded-xl bg-white p-2 flex-shrink-0">
                <img
                  src={registration.organizationLogoUrl}
                  alt={registration.organizationName || ''}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🏕️</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold truncate">{registration.campName}</h2>
              {registration.organizationName && (
                <p className="text-white/70 text-sm truncate">{registration.organizationName}</p>
              )}
              <p className="text-white/80 text-sm mt-1">{registration.weekLabel}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Child and status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-surface-dark flex items-center justify-center text-white text-sm font-bold">
                {registration.childName[0]}
              </div>
              <span className="font-medium text-slate-900 dark:text-white">{registration.childName}</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* View Details */}
            <Link
              href={`/session/${registration.sessionId}`}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Session Details
            </Link>

            {/* Register externally */}
            {registration.registrationUrl && (
              <a
                href={registration.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-white font-medium rounded-xl hover:bg-primary-dark transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Register for {registration.campName}
              </a>
            )}

            {/* Mark as Registered (if not already) */}
            {registration.status === 'interested' && (
              <button
                onClick={handleMarkRegistered}
                disabled={isUpdating}
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isUpdating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Mark as Registered
              </button>
            )}

            {/* Status indicator for registered */}
            {registration.status === 'registered' && (
              <div className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium rounded-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                You're Registered!
              </div>
            )}

            {/* Remove button */}
            {!showConfirmRemove ? (
              <button
                onClick={() => setShowConfirmRemove(true)}
                className="flex items-center justify-center gap-2 w-full py-3 px-4 text-red-600 border border-red-200 dark:border-red-800 font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove from Schedule
              </button>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                  Remove this camp from {registration.childName}'s schedule?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirmRemove(false)}
                    className="flex-1 py-2 px-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={isUpdating}
                    className="flex-1 py-2 px-3 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isUpdating ? 'Removing...' : 'Yes, Remove'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
