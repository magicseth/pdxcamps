'use client';

import { useEffect, useState } from 'react';

/**
 * A/B Test: Pricing Simplification
 *
 * Variant A (weekly): Shows $4.99/week
 * Variant B (monthly): Shows $39.99/month (one-time summer pass)
 *
 * Assignment is sticky based on localStorage to ensure consistent experience.
 */

export type PricingVariant = 'weekly' | 'monthly';

export interface PricingConfig {
  variant: PricingVariant;
  price: string;
  period: string;
  description: string;
  ctaText: string;
  // Maps to Stripe plan for checkout
  stripePlan: 'weekly' | 'monthlyOneshot';
}

const PRICING_CONFIGS: Record<PricingVariant, PricingConfig> = {
  weekly: {
    variant: 'weekly',
    price: '$4.99',
    period: '/week',
    description: 'Billed weekly • Cancel anytime',
    ctaText: 'Start Planning',
    stripePlan: 'weekly',
  },
  monthly: {
    variant: 'monthly',
    price: '$39.99',
    period: '',
    description: 'One-time payment • Full summer access',
    ctaText: 'Get Summer Pass',
    stripePlan: 'monthlyOneshot',
  },
};

const STORAGE_KEY = 'pdxcamps_pricing_variant';

/**
 * Get a deterministic variant based on a random assignment
 * Stored in localStorage for consistency across sessions
 */
function getOrAssignVariant(): PricingVariant {
  if (typeof window === 'undefined') {
    return 'weekly'; // SSR default
  }

  // Check for existing assignment
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'weekly' || stored === 'monthly') {
    return stored;
  }

  // New user: randomly assign 50/50
  const variant: PricingVariant = Math.random() < 0.5 ? 'weekly' : 'monthly';
  localStorage.setItem(STORAGE_KEY, variant);

  // Log assignment for analytics
  console.log(`[A/B Test] Pricing variant assigned: ${variant}`);

  return variant;
}

/**
 * Hook to get the user's pricing variant
 * Returns the pricing configuration for their assigned variant
 */
export function usePricingVariant(): PricingConfig | null {
  const [config, setConfig] = useState<PricingConfig | null>(null);

  useEffect(() => {
    const variant = getOrAssignVariant();
    setConfig(PRICING_CONFIGS[variant]);
  }, []);

  return config;
}

/**
 * Get pricing config without React (for server-side or non-hook usage)
 * Note: Will always return 'weekly' on server, actual variant on client
 */
export function getPricingConfig(): PricingConfig {
  const variant = typeof window !== 'undefined' ? getOrAssignVariant() : 'weekly';
  return PRICING_CONFIGS[variant];
}
