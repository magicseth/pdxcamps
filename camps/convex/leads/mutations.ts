import { mutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';

/**
 * Capture an email lead - no auth required.
 * Used for pre-auth email collection on discover pages, homepage, etc.
 * Triggers the lead nurture workflow for new leads.
 */
export const captureEmail = mutation({
  args: {
    email: v.string(),
    citySlug: v.string(),
    source: v.string(),
    interests: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    const normalizedEmail = args.email.toLowerCase().trim();

    // Check for existing lead with this email
    const existing = await ctx.db
      .query('leadCaptures')
      .withIndex('by_email', (q) => q.eq('email', normalizedEmail))
      .first();

    if (existing) {
      return { success: true, alreadyExists: true };
    }

    const leadId = await ctx.db.insert('leadCaptures', {
      email: normalizedEmail,
      citySlug: args.citySlug,
      source: args.source,
      interests: args.interests,
      status: 'pending',
      createdAt: Date.now(),
      nurtureEmailsSent: 0,
    });

    // Start the lead nurture workflow in a separate transaction
    await ctx.scheduler.runAfter(0, internal.leads.workflows.startNurtureWorkflow, {
      leadId,
      email: normalizedEmail,
      citySlug: args.citySlug,
    });

    return { success: true, alreadyExists: false };
  },
});
