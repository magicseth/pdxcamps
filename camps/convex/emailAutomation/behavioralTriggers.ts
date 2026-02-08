/**
 * Behavioral Email Triggers
 *
 * Smart triggers that send emails at critical conversion moments:
 * - Near-paywall: Free user saves 4th camp (1 away from limit)
 * - Stale plan: User has saved camps but hasn't logged in during peak season
 */

import { WorkflowManager } from '@convex-dev/workflow';
import { components, internal } from '../_generated/api';
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

const behaviorWorkflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 5,
  },
});

/**
 * Near-paywall nudge workflow.
 * Sends email when free user hits 4 saved camps.
 */
export const nearPaywallWorkflow = behaviorWorkflow.define({
  args: {
    familyId: v.string(),
    email: v.string(),
    displayName: v.string(),
    savedCampNames: v.array(v.string()),
    primaryCityId: v.string(),
  },
  returns: v.object({ sent: v.boolean() }),
  handler: async (step, args): Promise<{ sent: boolean }> => {
    const result: { sent: boolean; emailId?: string } = await step.runAction(
      internal.emailAutomation.emailSendActions.sendNearPaywallNudge,
      {
        familyId: args.familyId as any,
        email: args.email,
        displayName: args.displayName,
        savedCampNames: args.savedCampNames,
        primaryCityId: args.primaryCityId as any,
      },
      { retry: true },
    );

    if (result.sent) {
      await step.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
        familyId: args.familyId as any,
        emailType: 'near_paywall_nudge',
        emailId: result.emailId,
      });
    }

    return { sent: result.sent };
  },
});

/**
 * Check if a family just hit 4 saves and should get the near-paywall nudge.
 * Called from markInterested mutation after successful save.
 */
export const checkNearPaywallTrigger = internalMutation({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId);
    if (!family) return;

    // Count total interested registrations
    const regs = await ctx.db
      .query('registrations')
      .withIndex('by_family_and_status', (q) => q.eq('familyId', args.familyId).eq('status', 'interested'))
      .collect();

    // Only trigger at exactly 4 saves
    if (regs.length !== 4) return;

    // Check if we already sent this email
    const alreadySent = await ctx.db
      .query('automatedEmailsSent')
      .withIndex('by_family_and_type', (q) => q.eq('familyId', args.familyId).eq('emailType', 'near_paywall_nudge'))
      .first();
    if (alreadySent) return;

    // Get camp names for the email
    const sessionIds = [...new Set(regs.map((r) => r.sessionId))];
    const sessions = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const campNames = sessions
      .filter(Boolean)
      .map((s) => s!.campName ?? 'Camp')
      .slice(0, 4);

    // Start the workflow
    await behaviorWorkflow.start(ctx, internal.emailAutomation.behavioralTriggers.nearPaywallWorkflow, {
      familyId: args.familyId as string,
      email: family.email,
      displayName: family.displayName,
      savedCampNames: campNames,
      primaryCityId: family.primaryCityId as string,
    });
  },
});
