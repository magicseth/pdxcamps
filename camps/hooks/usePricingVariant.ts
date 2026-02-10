'use client';

/**
 * Pricing Configuration — Single source of truth for all pricing display.
 *
 * Plans:
 * - monthly: $4.99/month recurring
 * - summer: $29/year Summer Pass (one-time, best value)
 *
 * The Summer Pass is the default/recommended plan.
 */

export type PricingVariant = 'monthly' | 'summer';

export interface PricingConfig {
  variant: PricingVariant;
  price: string;
  period: string;
  description: string;
  ctaText: string;
  // Maps to Stripe plan for checkout
  stripePlan: 'monthly' | 'summer';
  // Optional coupon for discounted offers
  couponId?: string;
}

export const MONTHLY_PRICING: PricingConfig = {
  variant: 'monthly',
  price: '$4.99',
  period: '/mo',
  description: 'Billed monthly • Cancel anytime',
  ctaText: 'Start Planning',
  stripePlan: 'monthly',
};

export const SUMMER_PRICING: PricingConfig = {
  variant: 'summer',
  price: '$29',
  period: '/year',
  description: 'One-time payment • Full summer access',
  ctaText: 'Get Summer Pass',
  stripePlan: 'summer',
};

// Winback: 40% off monthly ($4.99 → $2.99/mo)
export const WINBACK_PRICING: PricingConfig = {
  variant: 'monthly',
  price: '$2.99',
  period: '/mo',
  description: '40% off — limited time offer',
  ctaText: 'Claim Your Discount',
  stripePlan: 'monthly',
  couponId: 'PNtPdCsf',
};

/**
 * Hook to get the pricing configuration.
 * Returns the Summer Pass (recommended) pricing by default.
 */
export function usePricingVariant(): PricingConfig {
  return SUMMER_PRICING;
}

/**
 * Get pricing config without React (for server-side or non-hook usage)
 */
export function getPricingConfig(): PricingConfig {
  return SUMMER_PRICING;
}
