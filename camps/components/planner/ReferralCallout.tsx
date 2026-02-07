'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { CheckIcon } from '../shared/icons';

/**
 * Compact referral callout for the planner page.
 * Shows a dismissible banner encouraging users to share their referral link.
 */
export function ReferralCallout() {
  const referralInfo = useQuery(api.referrals.queries.getReferralInfo);
  const generateCode = useMutation(api.referrals.mutations.generateReferralCode);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Don't show if dismissed or user already has max credits
  if (isDismissed) return null;
  if (referralInfo === undefined) return null;
  if (referralInfo === null) return null;
  if (referralInfo.creditsEarned >= referralInfo.maxCredits) return null;

  const handleGenerateAndCopy = async () => {
    setIsGenerating(true);
    try {
      let code = referralInfo.referralCode;
      if (!code) {
        code = await generateCode();
      }
      const referralUrl = `${window.location.origin}/r/${code}`;
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!referralInfo.referralCode) return;
    const referralUrl = `${window.location.origin}/r/${referralInfo.referralCode}`;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-4 relative">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 text-green-400 hover:text-green-600 dark:text-green-600 dark:hover:text-green-400 p-1"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center justify-between gap-4 pr-6">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎁</span>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">Invite friends, earn free months</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {referralInfo.creditsEarned > 0
                ? `${referralInfo.creditsEarned}/${referralInfo.maxCredits} earned - share more to max out!`
                : `Get 1 free month for each friend who signs up (max ${referralInfo.maxCredits})`}
            </p>
          </div>
        </div>

        {referralInfo.hasCode ? (
          <button
            onClick={handleCopy}
            className="flex-shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <CheckIcon />
                Copied!
              </>
            ) : (
              'Copy Link'
            )}
          </button>
        ) : (
          <button
            onClick={handleGenerateAndCopy}
            disabled={isGenerating}
            className="flex-shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isGenerating ? 'Getting...' : 'Get Link'}
          </button>
        )}
      </div>
    </div>
  );
}
