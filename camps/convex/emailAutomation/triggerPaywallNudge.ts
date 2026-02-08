/**
 * Paywall Nudge Trigger
 *
 * Mutation the frontend calls when a user hits the paywall limit.
 * Gathers their saved camps and schedules the nudge email.
 */

import { mutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { requireFamily } from '../lib/auth';

/**
 * Trigger paywall upgrade nudge email.
 * Call this from the frontend when user hits the PAYWALL error.
 */
export const triggerPaywallNudge = mutation({
  args: {},
  handler: async (ctx) => {
    const family = await requireFamily(ctx);

    // Gather saved camp info
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    const activeRegs = registrations.filter(
      (r) => r.status === 'interested' || r.status === 'registered' || r.status === 'waitlisted',
    );

    const savedCamps: { campName: string; organizationName: string }[] = [];
    for (const reg of activeRegs.slice(0, 5)) {
      const session = await ctx.db.get(reg.sessionId);
      if (!session) continue;
      const camp = await ctx.db.get(session.campId);
      const org = await ctx.db.get(session.organizationId);
      savedCamps.push({
        campName: session.campName || camp?.name || 'Unknown',
        organizationName: session.organizationName || org?.name || 'Unknown',
      });
    }

    if (savedCamps.length > 0) {
      await ctx.scheduler.runAfter(0, internal.emailAutomation.actions.sendPaywallNudgeEmail, {
        familyId: family._id,
        savedCamps,
      });
    }

    return { triggered: savedCamps.length > 0 };
  },
});
