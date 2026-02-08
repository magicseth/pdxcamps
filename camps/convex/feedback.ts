import { mutation, query, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

/**
 * Submit user feedback
 * Stores in database and sends email notification to admin
 */
export const submit = mutation({
  args: {
    message: v.string(),
    page: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current user info if logged in
    const identity = await ctx.auth.getUserIdentity();
    let familyId = undefined;
    let email = undefined;

    if (identity) {
      const family = await ctx.db
        .query('families')
        .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', identity.subject))
        .first();

      if (family) {
        familyId = family._id;
        email = family.email;
      }
    }

    // Store the feedback
    const feedbackId = await ctx.db.insert('feedback', {
      familyId,
      email,
      message: args.message,
      page: args.page,
      createdAt: Date.now(),
    });

    // Send email notification
    await ctx.scheduler.runAfter(0, internal.feedback.sendFeedbackNotification, {
      feedbackId,
      email: email || 'Anonymous',
      message: args.message,
      page: args.page,
    });

    return feedbackId;
  },
});

/**
 * List all feedback (admin only)
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query('feedback')
      .order('desc')
      .take(args.limit || 50);

    return feedback;
  },
});

/**
 * Send email notification when feedback is submitted
 */
export const sendFeedbackNotification = internalAction({
  args: {
    feedbackId: v.id('feedback'),
    email: v.string(),
    message: v.string(),
    page: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.email.sendEmail, {
      to: 'seth@magicseth.com',
      subject: `New Feedback from ${args.email}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New User Feedback</h2>

          <table style="border-collapse: collapse; width: 100%;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">From:</td>
              <td style="padding: 8px 0;">${args.email}</td>
            </tr>
            ${args.page ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Page:</td>
              <td style="padding: 8px 0;">${args.page}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Time:</td>
              <td style="padding: 8px 0;">${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</td>
            </tr>
          </table>

          <div style="margin-top: 16px; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${args.message}</p>
          </div>
        </div>
      `,
      text: `New feedback from ${args.email}\n\nPage: ${args.page || 'N/A'}\n\n${args.message}`,
    });
  },
});
