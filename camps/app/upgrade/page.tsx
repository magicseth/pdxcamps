'use client';

import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled') === 'true';

  const subscription = useQuery(api.subscriptions.getSubscription);
  const createCheckout = useAction(api.subscriptions.createCheckoutSession);

  const [loading, setLoading] = useState<'monthly' | 'summer' | null>(null);

  const handleUpgrade = async (plan: 'monthly' | 'summer') => {
    setLoading(plan);
    try {
      const result = await createCheckout({ plan });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
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
            You have full access to all features. Thank you for supporting PDX Camps!
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="text-primary hover:text-primary-dark text-sm mb-4 inline-block">
            &larr; Back to Planner
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Upgrade to Premium
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Plan your entire summer with unlimited children, all 12 weeks, and deadline reminders.
          </p>

          {canceled && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-accent/30 dark:border-accent/40 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
              Checkout was canceled. No worries—you can try again when you're ready.
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Monthly Plan */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Monthly
              </h2>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">$5</span>
                <span className="text-slate-500 dark:text-slate-400">/month</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Cancel anytime
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
              onClick={() => handleUpgrade('monthly')}
              disabled={loading !== null}
              className="w-full py-3 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'monthly' ? 'Loading...' : 'Subscribe Monthly'}
            </button>
          </div>

          {/* Summer Pass */}
          <div className="bg-gradient-to-br from-primary to-surface-dark rounded-2xl shadow-lg p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
              BEST VALUE
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Summer Pass
              </h2>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">$29</span>
                <span className="text-white/70">/summer</span>
              </div>
              <p className="text-sm text-white/70 mt-2">
                One-time payment • Full summer access
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              <FeatureItem light>Unlimited children</FeatureItem>
              <FeatureItem light>All 12 weeks of summer</FeatureItem>
              <FeatureItem light>Unlimited saved camps</FeatureItem>
              <FeatureItem light>Registration deadline alerts</FeatureItem>
              <FeatureItem light>Export to calendar</FeatureItem>
              <FeatureItem light>Priority support</FeatureItem>
            </ul>

            <button
              onClick={() => handleUpgrade('summer')}
              disabled={loading !== null}
              className="w-full py-3 px-4 bg-white text-primary-dark rounded-lg font-medium hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'summer' ? 'Loading...' : 'Get Summer Pass'}
            </button>
          </div>
        </div>

        {/* Free tier comparison */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Free Plan Includes
          </h3>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span>Browse all camps</span>
            <span>•</span>
            <span>1 child in planner</span>
            <span>•</span>
            <span>4 weeks visible</span>
            <span>•</span>
            <span>5 saved camps</span>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-6 text-center">
            Questions?
          </h3>
          <div className="space-y-4">
            <FAQItem question="Can I cancel anytime?">
              Yes! Monthly subscriptions can be canceled anytime from your account settings.
              You'll retain access until the end of your billing period.
            </FAQItem>
            <FAQItem question="What's the difference between Monthly and Summer Pass?">
              Monthly is a recurring subscription at $5/month. Summer Pass is a one-time $29
              payment that gives you full access for the entire summer season (May through August).
            </FAQItem>
            <FAQItem question="Do I need Premium to browse camps?">
              No! Browsing and searching camps is completely free. Premium unlocks unlimited
              planning features, more children, and deadline alerts.
            </FAQItem>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className={`flex items-center gap-3 ${light ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
      <CheckIcon className={`w-5 h-5 flex-shrink-0 ${light ? 'text-white/70' : 'text-green-500'}`} />
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
