/**
 * Subscription Management
 *
 * Uses @convex-dev/stripe component for subscription handling.
 *
 * FREE tier limits:
 * - Unlimited children
 * - 4 weeks visible
 * - 5 saved camps
 *
 * PREMIUM tier ($4.99/month or $29/year Summer Pass):
 * - Unlimited children
 * - Every week
 * - Unlimited saved camps
 * - Calendar export
 */

import { query, action, mutation } from './_generated/server';
import { components } from './_generated/api';
import { StripeSubscriptions } from '@convex-dev/stripe';
import { v } from 'convex/values';
import Stripe from 'stripe';
import { FREE_SAVED_CAMPS_LIMIT } from './lib/paywall';

// Initialize Stripe client
const stripeClient = new StripeSubscriptions(components.stripe, {});

// Price IDs from Stripe Dashboard (test vs live)
// Canonical pricing: $4.99/month recurring, $29/year Summer Pass (one-time)
const LIVE_PRICES = {
  monthly: 'price_1SyxjKAOaA3WFe0KmYlWIQpW', // $4.99/month recurring
  summer: 'price_1SwdZOAOaA3WFe0Kv1cQZC3O', // $29/year Summer Pass (one-time)
};

const TEST_PRICES = {
  monthly: 'price_1SweagA8NcUZvwFV3wqpcPLf', // $4.99/month test
  summer: 'price_1SweatA8NcUZvwFVu7yBk3cu', // $29 Summer Pass test
};

// Winback coupon: 40% off, created in Stripe Dashboard
const WINBACK_COUPON_ID = 'PNtPdCsf';

// Select prices based on Stripe key
const isTestMode = () => process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
const PRICES = isTestMode() ? TEST_PRICES : LIVE_PRICES;

// Free tier limits (maxSavedCamps sourced from convex/lib/paywall.ts)
export const FREE_LIMITS = {
  maxChildren: Infinity, // Unlimited children in free tier
  maxWeeks: 4,
  maxSavedCamps: FREE_SAVED_CAMPS_LIMIT,
};

/**
 * Check if user has an active premium subscription
 */
export const isPremium = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const subscriptions = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: identity.subject,
    });

    // Check for any active subscription
    const hasActive = subscriptions.some((sub) => sub.status === 'active' || sub.status === 'trialing');

    return hasActive;
  },
});

/**
 * Get user's subscription details
 */
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        isPremium: false,
        subscription: null,
        limits: FREE_LIMITS,
      };
    }

    const subscriptions = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: identity.subject,
    });

    const activeSubscription = subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing');

    // Check if subscription is set to cancel at period end
    const cancelAtPeriodEnd = activeSubscription?.cancelAtPeriodEnd ?? false;

    return {
      isPremium: !!activeSubscription,
      cancelAtPeriodEnd,
      subscription: activeSubscription || null,
      limits: activeSubscription ? { maxChildren: Infinity, maxWeeks: 12, maxSavedCamps: Infinity } : FREE_LIMITS,
    };
  },
});

/**
 * Create a checkout session for subscription
 * Uses Stripe SDK directly to support promotion codes
 *
 * Plans:
 * - monthly: $4.99/month recurring
 * - summer: $29/year Summer Pass (one-time)
 */
export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal('monthly'), v.literal('summer')),
    couponId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get or create Stripe customer using the component
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || undefined,
      name: identity.name || undefined,
    });

    // Get the price ID for the selected plan
    const priceMap: Record<string, string> = {
      monthly: PRICES.monthly,
      summer: PRICES.summer,
    };
    const priceId = priceMap[args.plan];

    // One-time payments use payment mode, recurring use subscription mode
    const mode = args.plan === 'summer' ? 'payment' : 'subscription';

    const baseUrl = process.env.SITE_URL || 'http://localhost:3000';

    // Use Stripe SDK directly to enable promotion codes
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Validate coupon if provided — only allow the winback coupon
    const applyCoupon = args.couponId === WINBACK_COUPON_ID ? args.couponId : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customer.customerId,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/upgrade?canceled=true`,
      // Can't use both discounts and allow_promotion_codes
      ...(applyCoupon
        ? { discounts: [{ coupon: applyCoupon }] }
        : { allow_promotion_codes: true }),
      metadata: {
        userId: identity.subject,
        plan: args.plan,
        ...(applyCoupon ? { coupon: applyCoupon } : {}),
      },
      subscription_data:
        mode === 'subscription'
          ? {
              metadata: {
                userId: identity.subject,
                plan: args.plan,
              },
            }
          : undefined,
      payment_intent_data:
        mode === 'payment'
          ? {
              metadata: {
                userId: identity.subject,
                plan: args.plan,
              },
            }
          : undefined,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

/**
 * Create a customer portal session for managing subscription
 */
export const createPortalSession = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get customer ID first
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || undefined,
      name: identity.name || undefined,
    });

    const baseUrl = process.env.SITE_URL || 'http://localhost:3000';

    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: customer.customerId,
      returnUrl: `${baseUrl}/settings`,
    });

    return {
      url: session.url,
    };
  },
});

/**
 * Cancel subscription
 */
export const cancelSubscription = action({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    await stripeClient.cancelSubscription(ctx, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      cancelAtPeriodEnd: true, // Let them use until end of period
    });

    return { success: true };
  },
});

/**
 * Resubscribe - resume a subscription that was set to cancel at period end
 */
export const resubscribe = action({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Use Stripe SDK directly to update the subscription
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    await stripe.subscriptions.update(args.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return { success: true };
  },
});

/**
 * Manual premium grant (for testing or special cases)
 * This is separate from Stripe - stores in our own table
 */
export const grantPremiumManually = mutation({
  args: {
    userId: v.string(),
    reason: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Store in a manual_premium table or user metadata
    // For now, we'll use Stripe component's data model
    // This is a placeholder for admin-granted premium access
    console.log(`Granting premium to ${args.userId}: ${args.reason}`);
    return { granted: true };
  },
});
