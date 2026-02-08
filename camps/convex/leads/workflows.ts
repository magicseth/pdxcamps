/**
 * Lead Nurture Workflows
 *
 * Durable 3-email drip workflow for captured email leads.
 * Single consolidated workflow handles the entire sequence:
 *   Email 1 (immediate): Welcome + popular camps
 *   Email 2 (3 days later): Recent additions
 *   Email 3 (7 days later): Urgency + signup CTA
 *
 * Uses @convex-dev/workflow with runAfter delays for durability and retry.
 */

import { WorkflowManager } from '@convex-dev/workflow';
import { components, internal } from '../_generated/api';
import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';

const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 3,
  },
});

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Full 3-email nurture sequence as a single durable workflow.
 */
export const nurtureEmailWorkflow = workflow.define({
  args: {
    leadId: v.string(),
    email: v.string(),
    citySlug: v.string(),
  },
  returns: v.object({
    emailsSent: v.number(),
  }),
  handler: async (step, args): Promise<{ emailsSent: number }> => {
    let emailsSent = 0;

    // Email 1: Welcome + popular camps (immediate)
    const stillActive1 = await step.runQuery(
      internal.leads.queries.isLeadStillNurtureable,
      { leadId: args.leadId as any },
    );
    if (!stillActive1) return { emailsSent };

    const result1 = await step.runAction(
      internal.leads.actions.sendLeadNurtureEmail,
      {
        leadId: args.leadId,
        email: args.email,
        citySlug: args.citySlug,
        emailIndex: 0,
      },
      { retry: true },
    );
    if (result1.sent) {
      await step.runMutation(internal.leads.workflows.recordNurtureStep, {
        leadId: args.leadId as any,
        completedStep: 1,
      });
      emailsSent++;
    }

    // Email 2: Recent additions (3 days later)
    const stillActive2 = await step.runQuery(
      internal.leads.queries.isLeadStillNurtureable,
      { leadId: args.leadId as any },
      { runAfter: THREE_DAYS_MS },
    );
    if (!stillActive2) return { emailsSent };

    const result2 = await step.runAction(
      internal.leads.actions.sendLeadNurtureEmail,
      {
        leadId: args.leadId,
        email: args.email,
        citySlug: args.citySlug,
        emailIndex: 1,
      },
      { retry: true },
    );
    if (result2.sent) {
      await step.runMutation(internal.leads.workflows.recordNurtureStep, {
        leadId: args.leadId as any,
        completedStep: 2,
      });
      emailsSent++;
    }

    // Email 3: Urgency + signup CTA (4 more days = 7 days total)
    const stillActive3 = await step.runQuery(
      internal.leads.queries.isLeadStillNurtureable,
      { leadId: args.leadId as any },
      { runAfter: FOUR_DAYS_MS },
    );
    if (!stillActive3) return { emailsSent };

    const result3 = await step.runAction(
      internal.leads.actions.sendLeadNurtureEmail,
      {
        leadId: args.leadId,
        email: args.email,
        citySlug: args.citySlug,
        emailIndex: 2,
      },
      { retry: true },
    );
    if (result3.sent) {
      await step.runMutation(internal.leads.workflows.recordNurtureStep, {
        leadId: args.leadId as any,
        completedStep: 3,
      });
      emailsSent++;
    }

    return { emailsSent };
  },
});

/**
 * Record a nurture step completion (no scheduling — workflow handles timing).
 */
export const recordNurtureStep = internalMutation({
  args: {
    leadId: v.id('leadCaptures'),
    completedStep: v.number(), // 1, 2, or 3
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      nurtureEmailsSent: args.completedStep,
      lastNurtureEmailAt: Date.now(),
    });
  },
});

/**
 * Start the nurture workflow for a newly captured lead.
 * Called via ctx.scheduler.runAfter from the captureEmail mutation.
 */
export const startNurtureWorkflow = internalMutation({
  args: {
    leadId: v.id('leadCaptures'),
    email: v.string(),
    citySlug: v.string(),
  },
  handler: async (ctx, args) => {
    await workflow.start(ctx, internal.leads.workflows.nurtureEmailWorkflow, {
      leadId: args.leadId as string,
      email: args.email,
      citySlug: args.citySlug,
    });
  },
});
