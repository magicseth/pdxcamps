/**
 * Scraping Workflow
 *
 * Processes scrape jobs using the Convex workflow component.
 * When a job is created, this workflow picks it up and executes the scraper.
 */

import { WorkflowManager } from '@convex-dev/workflow';
import { components, internal, api } from '../_generated/api';
import { v } from 'convex/values';
import { mutation, internalMutation } from '../_generated/server';
import { Id } from '../_generated/dataModel';

// Create workflow manager
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 10, // Allow up to 10 concurrent scrapes
  },
});

/**
 * Define the scraping workflow
 */
export const scrapeSourceWorkflow = workflow.define({
  args: {
    jobId: v.id('scrapeJobs'),
    sourceId: v.id('scrapeSources'),
  },
  returns: v.object({
    success: v.boolean(),
    sessionsFound: v.number(),
    sessionsCreated: v.number(),
    sessionsUpdated: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    sessionsFound: number;
    sessionsCreated: number;
    sessionsUpdated: number;
    error?: string;
  }> => {
    // Mark job as in progress
    await step.runMutation(internal.scraping.scrapeWorkflow.markJobStarted, {
      jobId: args.jobId,
    });

    try {
      // Execute the scraper (defined in executor.ts with "use node")
      const result: {
        sessionsFound: number;
        sessionsCreated: number;
        sessionsUpdated: number;
      } = await step.runAction(
        internal.scraping.scrapers.executor.executeScraperForJob,
        {
          jobId: args.jobId,
          sourceId: args.sourceId,
        },
        { retry: true },
      );

      // Mark job as complete
      await step.runMutation(internal.scraping.scrapeWorkflow.markJobCompleted, {
        jobId: args.jobId,
        sessionsFound: result.sessionsFound,
        sessionsCreated: result.sessionsCreated,
        sessionsUpdated: result.sessionsUpdated,
      });

      // Fetch logo for the organization if missing
      await step.runAction(
        internal.scraping.populateOrgLogos.fetchOrgLogoForSource,
        { sourceId: args.sourceId },
        { retry: false },
      );

      // Download scraped image URLs for newly imported camps
      await step.runAction(
        internal.scraping.populateCampImages.internalPopulateImages,
        { limit: 5 },
        { retry: false },
      );

      return {
        success: true,
        sessionsFound: result.sessionsFound,
        sessionsCreated: result.sessionsCreated,
        sessionsUpdated: result.sessionsUpdated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark job as failed
      await step.runMutation(internal.scraping.scrapeWorkflow.markJobFailed, {
        jobId: args.jobId,
        error: errorMessage,
      });

      return {
        success: false,
        sessionsFound: 0,
        sessionsCreated: 0,
        sessionsUpdated: 0,
        error: errorMessage,
      };
    }
  },
});

/**
 * Start a scrape workflow for a pending job
 * Call this when a job is created to kick off processing
 */
export const startScrapeWorkflow = mutation({
  args: {
    jobId: v.id('scrapeJobs'),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    if (job.status !== 'pending') {
      throw new Error(`Job is not pending (status: ${job.status})`);
    }

    // Start the workflow using workflow.start pattern
    const workflowId: string = (await workflow.start(ctx, internal.scraping.scrapeWorkflow.scrapeSourceWorkflow, {
      jobId: args.jobId,
      sourceId: job.sourceId,
    })) as string;

    // Store workflow ID on the job
    await ctx.db.patch(args.jobId, {
      workflowId,
    });

    return workflowId;
  },
});

/**
 * Process all pending jobs.
 * Can be called manually or by a cron.
 *
 * Schedules each job's workflow start in a separate transaction
 * to avoid write conflicts on the runStatus table.
 */
export const processPendingJobs = mutation({
  args: {},
  handler: async (ctx) => {
    const pendingJobs = await ctx.db
      .query('scrapeJobs')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .take(10);

    const scheduled: string[] = [];

    for (const job of pendingJobs) {
      // Skip if already has a workflow
      if ((job as Record<string, unknown>).workflowId) continue;

      // Schedule workflow start in a separate transaction
      await ctx.scheduler.runAfter(0, internal.scraping.scrapeWorkflow.startWorkflowForJob, {
        jobId: job._id,
        sourceId: job.sourceId,
      });

      scheduled.push(job._id);
    }

    return { scheduled, count: scheduled.length };
  },
});

/**
 * Start a workflow for a job (called via scheduler to avoid write conflicts).
 *
 * This is separate from createScrapeJob to ensure workflow.start() runs
 * in its own transaction, preventing conflicts on the runStatus table
 * when multiple jobs are created concurrently.
 */
export const startWorkflowForJob = internalMutation({
  args: {
    jobId: v.id('scrapeJobs'),
    sourceId: v.id('scrapeSources'),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      console.error(`Job ${args.jobId} not found`);
      return;
    }

    // Skip if job is no longer pending (e.g., was cancelled)
    if (job.status !== 'pending') {
      console.log(`Job ${args.jobId} is not pending (status: ${job.status}), skipping workflow start`);
      return;
    }

    // Skip if already has a workflow
    if ((job as Record<string, unknown>).workflowId) {
      console.log(`Job ${args.jobId} already has a workflow, skipping`);
      return;
    }

    const workflowId = await workflow.start(ctx, internal.scraping.scrapeWorkflow.scrapeSourceWorkflow, {
      jobId: args.jobId,
      sourceId: args.sourceId,
    });

    await ctx.db.patch(args.jobId, {
      workflowId: workflowId as string,
    });
  },
});

// Internal mutations for workflow steps
export const markJobStarted = internalMutation({
  args: { jobId: v.id('scrapeJobs') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'running',
      startedAt: Date.now(),
    });
  },
});

export const markJobCompleted = internalMutation({
  args: {
    jobId: v.id('scrapeJobs'),
    sessionsFound: v.number(),
    sessionsCreated: v.number(),
    sessionsUpdated: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: 'completed',
      completedAt: now,
      sessionsFound: args.sessionsFound,
      sessionsCreated: args.sessionsCreated,
      sessionsUpdated: args.sessionsUpdated,
    });

    // 10B: Track zero-result scrapes and alert
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const source = await ctx.db.get(job.sourceId);
    if (!source) return;

    if (args.sessionsFound === 0) {
      const prevZeroCount = source.scraperHealth.consecutiveZeroResults ?? 0;
      const newZeroCount = prevZeroCount + 1;

      // Create warning alert on zero results
      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'zero_results',
        message: `Scraper "${source.name}" returned 0 sessions (${newZeroCount} consecutive) — may need attention`,
        severity: 'warning',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });

      // After 3 consecutive zero-result completions, flag for regeneration
      const needsRegeneration = newZeroCount >= 3 || source.scraperHealth.needsRegeneration;

      await ctx.db.patch(job.sourceId, {
        scraperHealth: {
          ...source.scraperHealth,
          consecutiveZeroResults: newZeroCount,
          needsRegeneration,
        },
      });
    } else {
      // Reset consecutive zero results on non-zero result
      if ((source.scraperHealth.consecutiveZeroResults ?? 0) > 0) {
        await ctx.db.patch(job.sourceId, {
          scraperHealth: {
            ...source.scraperHealth,
            consecutiveZeroResults: 0,
          },
        });
      }
    }
  },
});

export const markJobFailed = internalMutation({
  args: {
    jobId: v.id('scrapeJobs'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: 'failed',
      completedAt: Date.now(),
      error: args.error,
    });
  },
});

// Note: executeScraperForJob is defined in executor.ts (node runtime)
// It's referenced via internal.scraping.scrapers.executor.executeScraperForJob
