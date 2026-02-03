/**
 * Subscription Management
 *
 * Uses @convex-dev/stripe component for subscription handling.
 *
 * FREE tier limits:
 * - 1 child in planner
 * - 4 weeks visible
 * - 5 saved camps
 *
 * PREMIUM tier ($5/month or $29/summer):
 * - Unlimited children
 * - All 12 weeks
 * - Unlimited saved camps
 * - Deadline reminders
 * - Calendar export
 */

import { query, action, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { v } from "convex/values";

// Initialize Stripe client
const stripeClient = new StripeSubscriptions(components.stripe, {});

// Price IDs - set these in Stripe Dashboard and update here
// These are placeholders - replace with actual Stripe price IDs
const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || "price_monthly_placeholder",
  summer: process.env.STRIPE_PRICE_SUMMER || "price_summer_placeholder",
};

// Free tier limits
export const FREE_LIMITS = {
  maxChildren: 1,
  maxWeeks: 4,
  maxSavedCamps: 5,
};

/**
 * Check if user has an active premium subscription
 */
export const isPremium = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject }
    );

    // Check for any active subscription
    const hasActive = subscriptions.some(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

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

    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject }
    );

    const activeSubscription = subscriptions.find(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    return {
      isPremium: !!activeSubscription,
      subscription: activeSubscription || null,
      limits: activeSubscription
        ? { maxChildren: Infinity, maxWeeks: 12, maxSavedCamps: Infinity }
        : FREE_LIMITS,
    };
  },
});

/**
 * Create a checkout session for subscription
 */
export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal("monthly"), v.literal("summer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get or create Stripe customer
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || undefined,
      name: identity.name || undefined,
    });

    // Get the price ID for the selected plan
    const priceId = args.plan === "monthly" ? PRICES.monthly : PRICES.summer;

    // For summer pass, use payment mode (one-time)
    // For monthly, use subscription mode
    const mode = args.plan === "summer" ? "payment" : "subscription";

    const baseUrl = process.env.SITE_URL || "http://localhost:3000";

    const session = await stripeClient.createCheckoutSession(ctx, {
      priceId,
      customerId: customer.customerId,
      mode,
      successUrl: `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/upgrade?canceled=true`,
      subscriptionMetadata: {
        userId: identity.subject,
        plan: args.plan,
      },
    });

    return {
      sessionId: session.sessionId,
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
      throw new Error("Not authenticated");
    }

    // Get customer ID first
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || undefined,
      name: identity.name || undefined,
    });

    const baseUrl = process.env.SITE_URL || "http://localhost:3000";

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
      throw new Error("Not authenticated");
    }

    await stripeClient.cancelSubscription(ctx, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      cancelAtPeriodEnd: true, // Let them use until end of period
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
