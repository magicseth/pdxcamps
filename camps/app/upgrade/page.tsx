'use client';

import { useState, useEffect } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMarket } from '../../hooks/useMarket';
import { usePricingVariant, WINBACK_PRICING } from '../../hooks/usePricingVariant';
import posthog from 'posthog-js';

const TESTIMONIALS = [
  {
    quote: "Found camps for all 3 kids in one evening. Best money I spent all summer.",
    author: "Sarah M.",
    detail: "Mom of 3",
  },
  {
    quote: "The weekly digest alone is worth it. I always know when new camps open up.",
    author: "Mike T.",
    detail: "Dad of 2",
  },
  {
    quote: "Saved me hours of googling. My kids had their best summer ever.",
    author: "Jennifer L.",
    detail: "Mom of 2",
  },
  {
    quote: "I found camps I didn't even know existed and had our whole summer planned in one evening.",
    author: "Rachel K.",
    detail: "Mom of 1",
  },
];

const SUMMER_YEAR = new Date().getFullYear();

export default function UpgradePage() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled') === 'true';
  const isWinback = searchParams.get('offer') === 'winback';
  const market = useMarket();
  const defaultPricing = usePricingVariant();
  const pricing = isWinback ? WINBACK_PRICING : defaultPricing;

  const subscription = useQuery(api.subscriptions.getSubscription);
  const createCheckout = useAction(api.subscriptions.createCheckoutSession);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    posthog.capture('upgrade_page_viewed', {
      pricing_variant: pricing.variant,
      canceled,
      market: market.slug,
    });
  }, []);

  const handleUpgrade = async () => {
    setLoading(true);

    posthog.capture('upgrade_started', {
      pricing_variant: pricing.variant,
      price: pricing.price,
      plan: pricing.stripePlan,
    });

    try {
      const result = await createCheckout({
        plan: pricing.stripePlan,
        ...(pricing.couponId ? { couponId: pricing.couponId } : {}),
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      posthog.captureException(error);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">You&apos;re a Premium Member!</h1>
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-primary hover:text-primary-dark text-sm mb-4 inline-block">
            &larr; Back to Planner
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Unlock Your Summer</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Plan your entire summer with unlimited camps and deadline reminders.
          </p>

          {/* Urgency banner */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-full">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              Camps are filling up fast for Summer {SUMMER_YEAR}
            </span>
          </div>

          {isWinback && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700/40 rounded-lg text-green-800 dark:text-green-200 text-sm font-medium">
              Special offer: 40% off your monthly plan. Welcome back!
            </div>
          )}

          {canceled && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-accent/30 dark:border-accent/40 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
              Checkout was canceled. No worries — you can try again when you&apos;re ready.
            </div>
          )}
        </div>

        {/* Single Pricing Card */}
        <div className="relative bg-gradient-to-br from-primary to-surface-dark rounded-2xl shadow-lg p-8 text-white max-w-lg mx-auto">
          {/* Most Popular Badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-4 py-1 bg-accent text-white text-sm font-bold rounded-full shadow-md">
              {isWinback ? '40% Off — Welcome Back' : 'Most Popular'}
            </span>
          </div>

          <div className="text-center mb-6 mt-2">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold">{pricing.price}</span>
              {pricing.period && <span className="text-white/70 text-xl">{pricing.period}</span>}
            </div>
            <p className="text-white/70 mt-2">{pricing.description}</p>
          </div>

          <ul className="space-y-3 mb-6">
            <FeatureItem>Every week — see your complete summer at a glance</FeatureItem>
            <FeatureItem>Unlimited saved camps — bookmark every option</FeatureItem>
            <FeatureItem>Deadline alerts — never miss registration</FeatureItem>
            <FeatureItem>Unlimited children — plan for the whole family</FeatureItem>
            <FeatureItem>Calendar export — sync with Google, Apple, Outlook</FeatureItem>
            <FeatureItem>Weekly personalized digest — new camps delivered to you</FeatureItem>
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-4 px-4 bg-white text-primary-dark rounded-lg font-semibold text-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : pricing.ctaText}
          </button>

          <p className="text-center text-white/60 text-sm mt-3">
            {pricing.description}
          </p>
        </div>

        {/* Money-back guarantee */}
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <ShieldIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span>100% money-back guarantee. Not happy? Email us for a full refund within 30 days.</span>
        </div>

        {/* Free vs Premium comparison */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white text-center mb-6">Free vs Premium</h2>
          <div className="grid grid-cols-3 gap-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            <div className="p-3 font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700" />
            <div className="p-3 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-b border-l border-slate-200 dark:border-slate-700 font-medium">
              Free
            </div>
            <div className="p-3 text-center font-medium text-primary bg-primary/5 dark:bg-primary/10 border-b border-l border-slate-200 dark:border-slate-700">
              Premium
            </div>

            <ComparisonRow label="Browse camps" free="Yes" premium="Yes" />
            <ComparisonRow label="Saved camps" free="5" premium="Unlimited" highlighted />
            <ComparisonRow label="Weeks visible" free="4 weeks" premium="Every week" highlighted />
            <ComparisonRow label="Deadline alerts" free="No" premium="Yes" highlighted />
            <ComparisonRow label="Weekly digest" free="No" premium="Yes" highlighted />
            <ComparisonRow label="Calendar export" free="No" premium="Yes" highlighted />
            <ComparisonRow label="Children" free="1" premium="Unlimited" highlighted last />
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white text-center mb-6">What Parents Say</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
              >
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-3">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t.author} &middot; {t.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Second CTA */}
        <div className="mt-10 text-center">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="px-8 py-4 bg-primary text-white rounded-lg font-semibold text-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {loading ? 'Loading...' : pricing.ctaText}
          </button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Join families planning their Summer {SUMMER_YEAR}
          </p>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 text-center">Questions?</h3>
          <div className="space-y-3">
              <FAQItem question="How long does my access last?">
              Your Summer Pass gives you full access for a full year from purchase. Monthly plans can be canceled anytime from your account settings.
            </FAQItem>
            <FAQItem question="Do I need Premium to browse camps?">
              No! Browsing and searching camps is completely free. Premium unlocks unlimited planning features and
              deadline alerts.
            </FAQItem>
            <FAQItem question="Is there a money-back guarantee?">
              Yes. If you&apos;re not satisfied within 30 days, email us and we&apos;ll issue a full refund — no questions asked.
            </FAQItem>
            <FAQItem question="Can I share my plan with my partner?">
              Yes! You can share a read-only link to your family&apos;s summer calendar with anyone.
            </FAQItem>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <div className="flex justify-center gap-4">
            <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300">
              Privacy
            </Link>
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

function ComparisonRow({
  label,
  free,
  premium,
  highlighted,
  last,
}: {
  label: string;
  free: string;
  premium: string;
  highlighted?: boolean;
  last?: boolean;
}) {
  const borderB = last ? '' : 'border-b border-slate-200 dark:border-slate-700';
  return (
    <>
      <div className={`p-3 text-slate-700 dark:text-slate-300 ${borderB}`}>{label}</div>
      <div className={`p-3 text-center text-slate-500 dark:text-slate-400 border-l ${borderB}`}>
        {free === 'Yes' ? (
          <CheckIcon className="w-4 h-4 text-green-500 mx-auto" />
        ) : free === 'No' ? (
          <XIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
        ) : (
          free
        )}
      </div>
      <div
        className={`p-3 text-center border-l ${borderB} ${
          highlighted
            ? 'text-primary font-medium bg-primary/5 dark:bg-primary/10'
            : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {premium === 'Yes' ? (
          <CheckIcon className="w-4 h-4 text-green-500 mx-auto" />
        ) : (
          premium
        )}
      </div>
    </>
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
