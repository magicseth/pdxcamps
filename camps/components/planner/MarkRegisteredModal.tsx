'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import confetti from 'canvas-confetti';

interface MarkRegisteredModalProps {
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
    dateRange: string;
  } | null;
  remainingCount?: number;
}

export function MarkRegisteredModal({ isOpen, onClose, registration, remainingCount = 0 }: MarkRegisteredModalProps) {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const registerMutation = useMutation(api.registrations.mutations.register);

  useEffect(() => {
    if (!isOpen) {
      setConfirmationCode('');
      setShowSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !registration) return null;

  const fireConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await registerMutation({
        childId: registration.childId,
        sessionId: registration.sessionId,
        externalConfirmationCode: confirmationCode || undefined,
      });
      setShowSuccess(true);
      fireConfetti();

      // Auto-close after showing success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to mark as registered:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          ref={modalRef}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
        >
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-in zoom-in-75 duration-300">
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              You're all set!
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {registration.campName} is confirmed for {registration.childName}
            </p>
            {remainingCount > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-4 font-medium">
                {remainingCount} more camp{remainingCount === 1 ? '' : 's'} to register
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <circle cx="80" cy="20" r="30" fill="white" />
              <circle cx="20" cy="80" r="20" fill="white" />
            </svg>
          </div>
          <div className="relative">
            <div className="text-3xl mb-2">Confirm Registration</div>
            <p className="text-green-100 text-sm">Mark this camp as officially registered</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camp info card */}
        <div className="p-6">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-4">
              {registration.organizationLogoUrl ? (
                <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-600 p-2 flex-shrink-0 shadow-sm">
                  <img
                    src={registration.organizationLogoUrl}
                    alt={registration.organizationName || ''}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-surface-dark flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-2xl">🏕️</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                  {registration.campName}
                </h3>
                {registration.organizationName && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {registration.organizationName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {registration.dateRange}
                  </span>
                  <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-xs font-medium text-primary dark:text-primary-light">
                    {registration.childName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Confirmation code input */}
          <div className="mb-6">
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget.nextElementSibling as HTMLDivElement;
                input.classList.toggle('hidden');
              }}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add confirmation code (optional)
            </button>
            <div className="hidden mt-3 animate-in slide-in-from-top-2 duration-200">
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="e.g., ABC123"
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Save your confirmation number for easy reference
              </p>
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                All Set!
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
