/**
 * Email Automation Mutations
 *
 * Record automated email sends for deduplication.
 */

import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Record that an automated email was sent.
 */
export const recordAutomatedEmail = internalMutation({
  args: {
    familyId: v.id('families'),
    emailType: v.union(
      v.literal('re_engagement'),
      v.literal('weekly_digest'),
      v.literal('summer_countdown'),
      v.literal('paywall_nudge'),
      v.literal('near_paywall_nudge'),
      v.literal('camp_request_fulfilled'),
    ),
    emailId: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('automatedEmailsSent', {
      familyId: args.familyId,
      emailType: args.emailType,
      sentAt: Date.now(),
      emailId: args.emailId,
      dedupeKey: args.dedupeKey,
    });
  },
});
