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

    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const source = await ctx.db.get(job.sourceId);
    if (!source) return;

    // --- Update source health (success path) ---
    const currentHealth = source.scraperHealth;
    const newTotalRuns = currentHealth.totalRuns + 1;
    const previousSuccessfulRuns = Math.round(currentHealth.successRate * currentHealth.totalRuns);
    const newSuccessRate = (previousSuccessfulRuns + 1) / newTotalRuns;

    const healthUpdate: Record<string, unknown> = {
      lastSuccessAt: now,
      lastFailureAt: currentHealth.lastFailureAt,
      consecutiveFailures: 0, // Reset on success
      totalRuns: newTotalRuns,
      successRate: newSuccessRate,
      lastError: undefined, // Clear error on success
      needsRegeneration: false, // Clear flag on success
    };

    // Track zero-result scrapes
    if (args.sessionsFound === 0) {
      const prevZeroCount = currentHealth.consecutiveZeroResults ?? 0;
      const newZeroCount = prevZeroCount + 1;
      healthUpdate.consecutiveZeroResults = newZeroCount;

      // After 3 consecutive zero-result completions, flag for regeneration
      if (newZeroCount >= 3) {
        healthUpdate.needsRegeneration = true;
      }

      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'zero_results',
        message: `Scraper "${source.name}" returned 0 sessions (${newZeroCount} consecutive) — may need attention`,
        severity: 'warning',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    } else {
      healthUpdate.consecutiveZeroResults = 0;
    }

    // --- Schedule next scrape ---
    const frequencyMs = source.scrapeFrequencyHours * 60 * 60 * 1000;
    const nextScheduledScrape = now + frequencyMs;

    await ctx.db.patch(job.sourceId, {
      scraperHealth: healthUpdate as typeof source.scraperHealth,
      lastScrapedAt: now,
      nextScheduledScrape,
    });

    // --- Recompute planner aggregates if sessions changed ---
    if (source.cityId && (args.sessionsCreated > 0 || args.sessionsUpdated > 0)) {
      const currentYear = new Date(now).getFullYear();
      await ctx.scheduler.runAfter(0, internal.planner.aggregates.recomputeForCity, {
        cityId: source.cityId,
        year: currentYear,
      });
    }
  },
});

export const markJobFailed = internalMutation({
  args: {
    jobId: v.id('scrapeJobs'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: 'failed',
      completedAt: now,
      error: args.error,
    });

    // --- Update source health (failure path) ---
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const source = await ctx.db.get(job.sourceId);
    if (!source) return;

    const currentHealth = source.scraperHealth;

    // Detect rate-limit errors (429 or "rate limit" in message)
    const isRateLimited = /429|rate.?limit/i.test(args.error);
    // Detect 404 errors
    const is404Error = /404|not found/i.test(args.error);

    // For rate-limited errors, don't increment consecutiveFailures
    const newConsecutiveFailures = isRateLimited
      ? currentHealth.consecutiveFailures
      : currentHealth.consecutiveFailures + 1;
    const newTotalRuns = currentHealth.totalRuns + 1;
    const successfulRuns = Math.round(currentHealth.successRate * currentHealth.totalRuns);
    const newSuccessRate = successfulRuns / newTotalRuns;

    // Flag for regeneration if too many consecutive failures (but not for 404s or rate limits)
    const needsRegeneration =
      (!is404Error && !isRateLimited && newConsecutiveFailures >= 3) || currentHealth.needsRegeneration;

    // Track URL status in history
    const urlHistory = source.urlHistory || [];
    if (is404Error) {
      urlHistory.push({
        url: source.url,
        status: '404',
        checkedAt: now,
      });
      while (urlHistory.length > 20) {
        urlHistory.shift();
      }
    }

    // Count recent consecutive 404s
    let consecutive404s = 0;
    for (let i = urlHistory.length - 1; i >= 0; i--) {
      if (urlHistory[i].status === '404') {
        consecutive404s++;
      } else {
        break;
      }
    }

    // Auto-disable after 5 consecutive 404s
    const shouldAutoDisable404 = is404Error && consecutive404s >= 5 && source.isActive;

    // Circuit breaker: auto-disable after max consecutive failures (default 10)
    const maxFailures = (source as Record<string, unknown>).maxConsecutiveFailures as number ?? 10;
    const shouldCircuitBreak = !isRateLimited && !is404Error && newConsecutiveFailures >= maxFailures && source.isActive;
    const shouldAutoDisable = shouldAutoDisable404 || shouldCircuitBreak;

    // Exponential backoff for scheduling next scrape
    let nextScheduledScrape: number;
    if (isRateLimited) {
      nextScheduledScrape = now + 6 * 60 * 60 * 1000; // 6 hours
    } else {
      const backoffHours = Math.min(
        source.scrapeFrequencyHours * Math.pow(2, newConsecutiveFailures),
        168, // cap at 1 week
      );
      nextScheduledScrape = now + backoffHours * 60 * 60 * 1000;
    }

    const updates: Record<string, unknown> = {
      scraperHealth: {
        ...currentHealth,
        lastFailureAt: now,
        consecutiveFailures: newConsecutiveFailures,
        totalRuns: newTotalRuns,
        successRate: newSuccessRate,
        lastError: args.error,
        needsRegeneration,
      },
      urlHistory,
      nextScheduledScrape,
    };

    if (shouldAutoDisable) {
      updates.isActive = false;
      if (shouldCircuitBreak) {
        updates.closureReason = `Circuit breaker: auto-disabled after ${newConsecutiveFailures} consecutive failures (limit: ${maxFailures})`;
      } else {
        updates.closureReason = `Auto-disabled: URL returned 404 for ${consecutive404s} consecutive attempts`;
      }
      updates.closedAt = now;
      updates.closedBy = 'system';
    }

    await ctx.db.patch(job.sourceId, updates);

    // Create alerts based on failure type
    if (isRateLimited) {
      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'rate_limited',
        message: `Source "${source.name}" was rate-limited. Next attempt in 6 hours.`,
        severity: 'info',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    } else if (shouldCircuitBreak) {
      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'circuit_breaker',
        message: `Circuit breaker tripped: "${source.name}" auto-disabled after ${newConsecutiveFailures} consecutive failures. Last error: ${args.error}`,
        severity: 'error',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    } else if (shouldAutoDisable404) {
      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'scraper_disabled',
        message: `Source "${source.name}" auto-disabled after ${consecutive404s} consecutive 404 errors. URL needs to be updated: ${source.url}`,
        severity: 'error',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    } else if (newConsecutiveFailures === 3) {
      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'scraper_degraded',
        message: `Scraper "${source.name}" has failed 3 times consecutively. Last error: ${args.error}`,
        severity: 'warning',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    } else if (newConsecutiveFailures >= 5 && !is404Error) {
      await ctx.db.insert('scraperAlerts', {
        sourceId: job.sourceId,
        alertType: 'scraper_needs_regeneration',
        message: `Scraper "${source.name}" needs regeneration after ${newConsecutiveFailures} consecutive failures.`,
        severity: 'error',
        createdAt: now,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      });
    }
  },
});

// Note: executeScraperForJob is defined in executor.ts (node runtime)
// It's referenced via internal.scraping.scrapers.executor.executeScraperForJob
