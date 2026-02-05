'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMarket } from '../../hooks/useMarket';
import { usePricingVariant } from '../../hooks/usePricingVariant';

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled') === 'true';
  const market = useMarket();
  const pricing = usePricingVariant();

  const subscription = useQuery(api.subscriptions.getSubscription);
  const createCheckout = useAction(api.subscriptions.createCheckoutSession);

  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!pricing) return;
    setLoading(true);
    try {
      const result = await createCheckout({ plan: pricing.stripePlan });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Already premium
  if (subscription?.isPremium) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            You're a Premium Member!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            You have full access to all features. Thank you for supporting {market.tagline}!
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark"
          >
            Go to Planner
          </Link>
        </div>
      </div>
    );
  }

  // Loading state while determining variant
  if (!pricing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-primary hover:text-primary-dark text-sm mb-4 inline-block">
            &larr; Back to Planner
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Unlock Your Summer
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Plan your entire summer with unlimited camps and deadline reminders.
          </p>

          {canceled && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-accent/30 dark:border-accent/40 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
              Checkout was canceled. No worries—you can try again when you're ready.
            </div>
          )}
        </div>

        {/* Single Pricing Card */}
        <div className="bg-gradient-to-br from-primary to-surface-dark rounded-2xl shadow-lg p-8 text-white">
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold">{pricing.price}</span>
              {pricing.period && (
                <span className="text-white/70 text-xl">{pricing.period}</span>
              )}
            </div>
            <p className="text-white/70 mt-2">
              {pricing.description}
            </p>
          </div>

          <ul className="space-y-3 mb-8">
            <FeatureItem>Unlimited children</FeatureItem>
            <FeatureItem>All 12 weeks of summer</FeatureItem>
            <FeatureItem>Unlimited saved camps</FeatureItem>
            <FeatureItem>Registration deadline alerts</FeatureItem>
            <FeatureItem>Export to calendar</FeatureItem>
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 px-4 bg-white text-primary-dark rounded-lg font-semibold text-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : pricing.ctaText}
          </button>
        </div>

        {/* Free tier comparison */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Free plan includes:
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
              Browse all camps
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
              4 weeks visible
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
              5 saved camps
            </span>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 text-center">
            Questions?
          </h3>
          <div className="space-y-3">
            {pricing.variant === 'weekly' ? (
              <FAQItem question="Can I cancel anytime?">
                Yes! You can cancel your subscription anytime from your account settings.
                You'll retain access until the end of your current billing period.
              </FAQItem>
            ) : (
              <FAQItem question="How long does my access last?">
                Your Summer Pass gives you full access for the entire summer season,
                from now through August.
              </FAQItem>
            )}
            <FAQItem question="Do I need Premium to browse camps?">
              No! Browsing and searching camps is completely free. Premium unlocks unlimited
              planning features and deadline alerts.
            </FAQItem>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <div className="flex justify-center gap-4">
            <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300">Terms</Link>
            <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-white">
      <CheckIcon className="w-5 h-5 flex-shrink-0 text-white/70" />
      <span>{children}</span>
    </li>
  );
}

function FAQItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <h4 className="font-medium text-slate-900 dark:text-white mb-2">{question}</h4>
      <p className="text-sm text-slate-600 dark:text-slate-400">{children}</p>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
