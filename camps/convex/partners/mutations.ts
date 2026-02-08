import { mutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';

export const submitPartnerApplication = mutation({
  args: {
    organizationName: v.string(),
    contactName: v.string(),
    email: v.string(),
    organizationType: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate applications by email
    const existing = await ctx.db
      .query('partnerApplications')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existing) {
      return { success: false, error: 'An application with this email already exists.' };
    }

    const id = await ctx.db.insert('partnerApplications', {
      organizationName: args.organizationName,
      contactName: args.contactName,
      email: args.email,
      organizationType: args.organizationType,
      message: args.message,
      status: 'pending',
      createdAt: Date.now(),
    });

    // Notify admin via email
    await ctx.scheduler.runAfter(0, internal.partners.notifications.notifyNewPartnerApplication, {
      organizationName: args.organizationName,
      contactName: args.contactName,
      email: args.email,
      organizationType: args.organizationType,
      message: args.message,
    });

    return { success: true, id };
  },
});
