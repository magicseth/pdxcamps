/**
 * Email Automation Workflows
 *
 * Durable workflows for email automation using @convex-dev/workflow.
 * Each email type gets its own workflow for retry/tracking.
 * Replaces direct cron → action pattern with cron → mutation → workflow.
 */

import { WorkflowManager } from '@convex-dev/workflow';
import { components, internal } from '../_generated/api';
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

// Create workflow manager for email automation
export const emailWorkflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 5, // Limit concurrent email sends for rate limiting
  },
});

// ============================================
// RE-ENGAGEMENT WORKFLOW
// ============================================

export const reEngagementWorkflow = emailWorkflow.define({
  args: {
    familyId: v.string(),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.string(),
  },
  returns: v.object({
    sent: v.boolean(),
    skipped: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (step, args): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> => {
    const result: { sent: boolean; skipped?: boolean; reason?: string; emailId?: string } = await step.runAction(
      internal.emailAutomation.emailSendActions.sendReEngagementForFamily,
      {
        familyId: args.familyId as any,
        email: args.email,
        displayName: args.displayName,
        primaryCityId: args.primaryCityId as any,
      },
      { retry: true },
    );

    if (result.sent) {
      await step.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
        familyId: args.familyId as any,
        emailType: 're_engagement',
        emailId: result.emailId,
      });
    }

    return { sent: result.sent, skipped: result.skipped, reason: result.reason };
  },
});

// ============================================
// WEEKLY DIGEST WORKFLOW
// ============================================

export const weeklyDigestWorkflow = emailWorkflow.define({
  args: {
    familyId: v.string(),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.string(),
    weekKey: v.string(),
  },
  returns: v.object({
    sent: v.boolean(),
    skipped: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (step, args): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> => {
    const result: { sent: boolean; skipped?: boolean; reason?: string; emailId?: string } = await step.runAction(
      internal.emailAutomation.emailSendActions.sendWeeklyDigestForFamily,
      {
        familyId: args.familyId as any,
        email: args.email,
        displayName: args.displayName,
        primaryCityId: args.primaryCityId as any,
      },
      { retry: true },
    );

    if (result.sent) {
      await step.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
        familyId: args.familyId as any,
        emailType: 'weekly_digest',
        emailId: result.emailId,
        dedupeKey: args.weekKey,
      });
    }

    return { sent: result.sent, skipped: result.skipped, reason: result.reason };
  },
});

// ============================================
// SUMMER COUNTDOWN WORKFLOW
// ============================================

export const summerCountdownWorkflow = emailWorkflow.define({
  args: {
    familyId: v.string(),
    email: v.string(),
    displayName: v.string(),
    primaryCityId: v.string(),
    weeksUntilSummer: v.number(),
    weekKey: v.string(),
  },
  returns: v.object({
    sent: v.boolean(),
    skipped: v.optional(v.boolean()),
    reason: v.optional(v.string()),
  }),
  handler: async (step, args): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> => {
    const result: { sent: boolean; emailId?: string } = await step.runAction(
      internal.emailAutomation.emailSendActions.sendSummerCountdownForFamily,
      {
        familyId: args.familyId as any,
        email: args.email,
        displayName: args.displayName,
        primaryCityId: args.primaryCityId as any,
        weeksUntilSummer: args.weeksUntilSummer,
      },
      { retry: true },
    );

    if (result.sent) {
      await step.runMutation(internal.emailAutomation.mutations.recordAutomatedEmail, {
        familyId: args.familyId as any,
        emailType: 'summer_countdown',
        emailId: result.emailId,
        dedupeKey: args.weekKey,
      });
    }

    return { sent: result.sent };
  },
});

// ============================================
// ENTRY POINT MUTATIONS (called by crons)
// ============================================

/**
 * Start re-engagement workflows for all inactive families.
 * Called by daily cron. Starts one workflow per family.
 */
export const startReEngagementBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const inactiveFamilies = await ctx.db
      .query('families')
      .collect()
      .then(async (families) => {
        // Delegate to the existing query logic
        return ctx.runQuery(internal.emailAutomation.queries.getInactiveFamilies);
      });

    let started = 0;
    for (const family of inactiveFamilies) {
      await emailWorkflow.start(ctx, internal.emailAutomation.workflows.reEngagementWorkflow, {
        familyId: family.familyId as string,
        email: family.email,
        displayName: family.displayName,
        primaryCityId: family.primaryCityId as string,
      });
      started++;
    }

    console.log(`Re-engagement: started ${started} workflows`);
    return { started };
  },
});

/**
 * Start weekly digest workflows for all eligible families.
 * Called by weekly cron.
 */
export const startWeeklyDigestBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.runQuery(
      internal.emailAutomation.queries.getDigestEligibleFamilies,
    );

    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;

    let started = 0;
    for (const family of families) {
      await emailWorkflow.start(ctx, internal.emailAutomation.workflows.weeklyDigestWorkflow, {
        familyId: family.familyId as string,
        email: family.email,
        displayName: family.displayName,
        primaryCityId: family.primaryCityId as string,
        weekKey,
      });
      started++;
    }

    console.log(`Weekly digest: started ${started} workflows`);
    return { started };
  },
});

/**
 * Start summer countdown workflows for all eligible families.
 * Called by weekly cron (Feb-May).
 */
export const startSummerCountdownBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.runQuery(
      internal.emailAutomation.queries.getCountdownEligibleFamilies,
    );

    if (families.length === 0) return { started: 0 };

    const now = new Date();
    const weekKey = `${now.getFullYear()}-W${Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;

    let started = 0;
    for (const family of families) {
      await emailWorkflow.start(ctx, internal.emailAutomation.workflows.summerCountdownWorkflow, {
        familyId: family.familyId as string,
        email: family.email,
        displayName: family.displayName,
        primaryCityId: family.primaryCityId as string,
        weeksUntilSummer: family.weeksUntilSummer,
        weekKey,
      });
      started++;
    }

    console.log(`Summer countdown: started ${started} workflows`);
    return { started };
  },
});
