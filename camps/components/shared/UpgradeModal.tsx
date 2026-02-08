'use client';

import { useRouter } from 'next/navigation';
import { usePricingVariant } from '../../hooks/usePricingVariant';
import { FREE_SAVED_CAMPS_LIMIT } from '../../lib/constants';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedCount?: number;
}

export function UpgradeModal({ isOpen, onClose, savedCount = 4 }: UpgradeModalProps) {
  const router = useRouter();
  const pricing = usePricingVariant();

  if (!isOpen) return null;

  // Format price display for button
  const priceDisplay = pricing ? `${pricing.price}${pricing.period}` : '$4.99/week';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white text-center">
          <div className="text-4xl mb-2" aria-hidden="true">⚠️</div>
          <h2 className="text-xl font-bold">You&apos;ve reached the free limit</h2>
          <p className="text-white/90 text-sm mt-1">{savedCount}/{FREE_SAVED_CAMPS_LIMIT} saved camps used</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-slate-700 dark:text-slate-300 text-center mb-4 font-medium">
            Upgrade to plan your complete summer
          </p>

          {/* Feature highlights */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">Save <strong>unlimited</strong> camps</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">See all <strong>12 weeks</strong> at a glance</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">Get <strong>deadline alerts</strong> so you never miss registration</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/upgrade')}
              className="w-full py-3 px-4 bg-gradient-to-r from-accent to-accent-dark text-white rounded-lg font-semibold hover:from-accent-dark hover:to-primary transition-colors shadow-md"
            >
              Upgrade — {priceDisplay}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Cancel anytime</p>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              Keep Free Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to check if an error is a paywall error
 */
export function isPaywallError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('PAYWALL:');
  }
  return false;
}

/**
 * Helper to get paywall type from error
 */
export function getPaywallType(error: unknown): 'CAMP_LIMIT' | 'UNKNOWN' {
  if (error instanceof Error) {
    if (error.message.includes('PAYWALL:CAMP_LIMIT')) {
      return 'CAMP_LIMIT';
    }
  }
  return 'UNKNOWN';
}
