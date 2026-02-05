'use client';

import { useRouter } from 'next/navigation';
import { usePricingVariant } from '../../hooks/usePricingVariant';

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
  const priceDisplay = pricing
    ? `${pricing.price}${pricing.period}`
    : '$4.99/week';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-indigo-600 p-6 text-white text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-xl font-bold">
            You've saved {savedCount} camps!
          </h2>
          <p className="text-white/80 text-sm mt-1">
            Nice planning! You're on a roll.
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
            Upgrade to Premium to save unlimited camps and plan your complete summer.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/upgrade')}
              className="w-full py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
            >
              Upgrade — {priceDisplay}
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 px-4 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>

          {/* Features list */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">
              Premium includes:
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                Unlimited camps
              </span>
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                All 12 weeks
              </span>
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                Deadline alerts
              </span>
            </div>
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
