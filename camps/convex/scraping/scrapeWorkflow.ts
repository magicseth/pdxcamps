/**
 * Scraping Workflow
 *
 * Processes scrape jobs using the Convex workflow component.
 * When a job is created, this workflow picks it up and executes the scraper.
 */

import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal, api } from "../_generated/api";
import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Create workflow manager
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 2, // Limit concurrent scrapes to avoid rate limits
  },
});

/**
 * Define the scraping workflow
 */
export const scrapeSourceWorkflow = workflow.define({
  args: {
    jobId: v.id("scrapeJobs"),
    sourceId: v.id("scrapeSources"),
  },
  returns: v.object({
    success: v.boolean(),
    sessionsFound: v.number(),
    sessionsCreated: v.number(),
    sessionsUpdated: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (step, args): Promise<{
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
        { retry: true }
      );

      // Mark job as complete
      await step.runMutation(internal.scraping.scrapeWorkflow.markJobCompleted, {
        jobId: args.jobId,
        sessionsFound: result.sessionsFound,
        sessionsCreated: result.sessionsCreated,
        sessionsUpdated: result.sessionsUpdated,
      });

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
    jobId: v.id("scrapeJobs"),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    if (job.status !== "pending") {
      throw new Error(`Job is not pending (status: ${job.status})`);
    }

    // Start the workflow using workflow.start pattern
    const workflowId: string = await workflow.start(
      ctx,
      internal.scraping.scrapeWorkflow.scrapeSourceWorkflow,
      {
        jobId: args.jobId,
        sourceId: job.sourceId,
      }
    ) as string;

    // Store workflow ID on the job
    await ctx.db.patch(args.jobId, {
      workflowId,
    });

    return workflowId;
  },
});

/**
 * Process all pending jobs
 * Can be called manually or by a cron
 */
export const processPendingJobs = mutation({
  args: {},
  handler: async (ctx) => {
    const pendingJobs = await ctx.db
      .query("scrapeJobs")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(10);

    const started: string[] = [];

    for (const job of pendingJobs) {
      // Skip if already has a workflow
      if ((job as any).workflowId) continue;

      const workflowId = await workflow.start(
        ctx,
        internal.scraping.scrapeWorkflow.scrapeSourceWorkflow,
        {
          jobId: job._id,
          sourceId: job.sourceId,
        }
      );

      await ctx.db.patch(job._id, {
        workflowId: workflowId as string,
      });

      started.push(job._id);
    }

    return { started, count: started.length };
  },
});

// Internal mutations for workflow steps
export const markJobStarted = internalMutation({
  args: { jobId: v.id("scrapeJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const markJobCompleted = internalMutation({
  args: {
    jobId: v.id("scrapeJobs"),
    sessionsFound: v.number(),
    sessionsCreated: v.number(),
    sessionsUpdated: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: Date.now(),
      sessionsFound: args.sessionsFound,
      sessionsCreated: args.sessionsCreated,
      sessionsUpdated: args.sessionsUpdated,
    });
  },
});

export const markJobFailed = internalMutation({
  args: {
    jobId: v.id("scrapeJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error,
    });
  },
});

// Note: executeScraperForJob is defined in executor.ts (node runtime)
// It's referenced via internal.scraping.scrapers.executor.executeScraperForJob
