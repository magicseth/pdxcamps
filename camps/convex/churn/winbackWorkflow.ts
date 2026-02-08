/**
 * Win-back Workflow
 *
 * Durable 3-email sequence sent after cancellation:
 * - Day 3: "We miss you" + what they're losing
 * - Day 7: Retention offer (discount or pause)
 * - Day 14: Final reminder before data cleanup
 *
 * Uses @convex-dev/workflow for durability and retry.
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

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Full 3-email win-back sequence as a single durable workflow.
 */
export const winbackSequenceWorkflow = workflow.define({
  args: {
    familyId: v.id('families'),
  },
  returns: v.object({
    emailsSent: v.number(),
  }),
  handler: async (step, args): Promise<{ emailsSent: number }> => {
    let emailsSent = 0;

    // Email 1: "We miss you" (runs immediately — workflow is started 3 days after cancel)
    await step.runAction(
      internal.churn.winback.sendWinbackEmail,
      { familyId: args.familyId, emailNumber: 1 },
      { retry: true },
    );
    await step.runMutation(internal.churn.mutations.incrementWinbackCount, {
      familyId: args.familyId,
    });
    emailsSent++;

    // Email 2: Retention offer (4 days after email 1 = day 7 total)
    await step.runAction(
      internal.churn.winback.sendWinbackEmail,
      { familyId: args.familyId, emailNumber: 2 },
      { retry: true, runAfter: FOUR_DAYS_MS },
    );
    await step.runMutation(internal.churn.mutations.incrementWinbackCount, {
      familyId: args.familyId,
    });
    emailsSent++;

    // Email 3: Final reminder (7 days after email 2 = day 14 total)
    await step.runAction(
      internal.churn.winback.sendWinbackEmail,
      { familyId: args.familyId, emailNumber: 3 },
      { retry: true, runAfter: SEVEN_DAYS_MS },
    );
    await step.runMutation(internal.churn.mutations.incrementWinbackCount, {
      familyId: args.familyId,
    });
    emailsSent++;

    return { emailsSent };
  },
});

/**
 * Start the win-back workflow.
 * Called via ctx.scheduler.runAfter from recordChurnReason to avoid write conflicts.
 */
export const startWinbackWorkflow = internalMutation({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    await workflow.start(ctx, internal.churn.winbackWorkflow.winbackSequenceWorkflow, {
      familyId: args.familyId,
    });
  },
});
