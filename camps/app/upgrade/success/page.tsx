'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import posthog from 'posthog-js';

export default function UpgradeSuccessPage() {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Celebration confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Track upgrade completed (critical business event) - only once
    if (!hasTracked.current) {
      hasTracked.current = true;
      posthog.capture('upgrade_completed');

      // Reddit conversion tracking
      if (typeof window !== 'undefined' && (window as any).rdt) {
        (window as any).rdt('track', 'Purchase');
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-surface-dark flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Welcome to Premium!</h1>

        <p className="text-slate-600 dark:text-slate-400 mb-8">
          You now have full access to all features. Start planning your perfect summer!
        </p>

        <div className="space-y-4">
          <Link
            href="/"
            className="block w-full py-3 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
          >
            Go to Planner
          </Link>

          <Link
            href="/settings"
            className="block w-full py-3 px-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Manage Subscription
          </Link>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-6">A receipt has been sent to your email.</p>
      </div>
    </div>
  );
}
