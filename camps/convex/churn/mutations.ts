/**
 * Churn Tracking Mutations
 *
 * Records cancel reasons and triggers win-back workflows.
 */

import { mutation, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { requireFamily } from '../lib/auth';

const CHURN_REASONS = [
  'too_expensive',
  'not_using_enough',
  'summer_over',
  'found_alternative',
  'missing_features',
  'other',
] as const;

/**
 * Record why a user is canceling their subscription.
 * Called from the cancel flow before redirecting to Stripe portal.
 */
export const recordChurnReason = mutation({
  args: {
    reason: v.string(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Check for existing churn record (avoid duplicates)
    const existing = await ctx.db
      .query('churnReasons')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        reason: args.reason,
        feedback: args.feedback,
        canceledAt: Date.now(),
      });
      return existing._id;
    }

    const id = await ctx.db.insert('churnReasons', {
      familyId: family._id,
      reason: args.reason,
      feedback: args.feedback,
      canceledAt: Date.now(),
      winbackEmailsSent: 0,
    });

    // Start win-back workflow (3 days after cancel, in separate transaction)
    await ctx.scheduler.runAfter(
      3 * 24 * 60 * 60 * 1000, // 3 days after cancel
      internal.churn.winbackWorkflow.startWinbackWorkflow,
      { familyId: family._id },
    );

    return id;
  },
});

/**
 * Increment winback email counter.
 */
export const incrementWinbackCount = internalMutation({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    const churn = await ctx.db
      .query('churnReasons')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .first();

    if (churn) {
      await ctx.db.patch(churn._id, {
        winbackEmailsSent: churn.winbackEmailsSent + 1,
      });
    }
  },
});
