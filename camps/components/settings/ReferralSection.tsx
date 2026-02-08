'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { CheckIcon } from '../shared/icons';
import posthog from 'posthog-js';

export function ReferralSection() {
  const referralInfo = useQuery(api.referrals.queries.getReferralInfo);
  const referralEvents = useQuery(api.referrals.queries.listReferralEvents);
  const generateCode = useMutation(api.referrals.mutations.generateReferralCode);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      await generateCode();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!referralInfo?.referralCode) return;

    const referralUrl = `${window.location.origin}/r/${referralInfo.referralCode}`;
    await navigator.clipboard.writeText(referralUrl);

    // Track referral link copy (growth/viral indicator)
    posthog.capture('referral_link_copied', {
      credits_earned: referralInfo.creditsEarned,
    });

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (referralInfo === undefined || referralInfo === null) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  const { hasCode, referralCode, creditsEarned, maxCredits } = referralInfo as {
    hasCode: boolean;
    referralCode: string | null;
    creditsEarned: number;
    creditsApplied: number;
    creditsAvailable: number;
    maxCredits: number;
  };
  const creditsRemaining = maxCredits - creditsEarned;
  const progressPercent = (creditsEarned / maxCredits) * 100;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Refer Friends</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Share your link, get 1 free week per friend who signs up (max {maxCredits}).
      </p>

      {!hasCode ? (
        <button
          type="button"
          onClick={handleGenerateCode}
          disabled={isGenerating}
          className="w-full px-4 py-3 bg-primary text-white font-medium rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? 'Generating...' : 'Get Your Referral Link'}
        </button>
      ) : (
        <div className="space-y-4">
          {/* Referral Link */}
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm text-slate-700 dark:text-slate-300 font-mono overflow-hidden">
              <span className="truncate block">
                {typeof window !== 'undefined' && `${window.location.origin}/r/${referralCode}`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors flex items-center gap-2 min-w-[80px] justify-center"
            >
              {copied ? (
                <>
                  <CheckIcon />
                  <span>Copied</span>
                </>
              ) : (
                'Copy'
              )}
            </button>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Your referrals</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {creditsEarned}/{maxCredits} weeks earned
              </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-accent-dark rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {creditsRemaining > 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Refer {creditsRemaining} more friend{creditsRemaining !== 1 ? 's' : ''} to maximize rewards!
              </p>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckIcon />
                You&apos;ve earned all available referral credits!
              </p>
            )}
          </div>

          {/* Referral Activity */}
          {referralEvents && referralEvents.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recent Activity</h3>
              <div className="space-y-2">
                {referralEvents.slice(0, 5).map((event, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${event.status === 'completed' ? 'bg-green-500' : 'bg-yellow-400'}`} />
                    <span className="text-slate-600 dark:text-slate-400">
                      {event.status === 'completed' ? 'Friend joined' : 'Pending signup'}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 text-xs ml-auto">
                      {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
