import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Create a new pending scrape job.
 *
 * IMPORTANT: Workflow starting is decoupled from job creation to avoid
 * write conflicts on the workflow's runStatus table. The workflow is
 * started via scheduler in a separate transaction.
 */
export const createScrapeJob = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    // Check if there's already a pending or running job
    const existingJob = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "pending")
      )
      .first();

    if (existingJob) {
      throw new Error("A pending job already exists for this source");
    }

    const runningJob = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "running")
      )
      .first();

    if (runningJob) {
      throw new Error("A job is already running for this source");
    }

    const jobId = await ctx.db.insert("scrapeJobs", {
      sourceId: args.sourceId,
      status: "pending",
      triggeredBy: args.triggeredBy,
      startedAt: undefined,
      completedAt: undefined,
      sessionsFound: undefined,
      sessionsCreated: undefined,
      sessionsUpdated: undefined,
      retryCount: 0,
      errorMessage: undefined,
    });

    // Schedule workflow start in a separate transaction to avoid
    // write conflicts on the workflow's runStatus table.
    // Use a small random delay (100-2000ms) to stagger concurrent job creations
    // and prevent scheduler write conflicts on _scheduled_functions.
    const jitterMs = 100 + Math.floor(Math.random() * 1900);
    await ctx.scheduler.runAfter(
      jitterMs,
      internal.scraping.scrapeWorkflow.startWorkflowForJob,
      {
        jobId,
        sourceId: args.sourceId,
      }
    );

    return jobId;
  },
});

/**
 * Mark a job as running
 */
export const startScrapeJob = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (job.status !== "pending") {
      throw new Error(`Cannot start job in "${job.status}" status`);
    }

    await ctx.db.patch(args.jobId, {
      status: "running",
      startedAt: Date.now(),
    });

    return args.jobId;
  },
});

/**
 * Mark a job as completed
 */
export const completeScrapeJob = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    sessionsFound: v.number(),
    sessionsCreated: v.number(),
    sessionsUpdated: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (job.status !== "running") {
      throw new Error(`Cannot complete job in "${job.status}" status`);
    }

    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: now,
      sessionsFound: args.sessionsFound,
      sessionsCreated: args.sessionsCreated,
      sessionsUpdated: args.sessionsUpdated,
    });

    // Update source last scraped time
    const source = await ctx.db.get(job.sourceId);
    await ctx.db.patch(job.sourceId, {
      lastScrapedAt: now,
    });

    // Recompute weekly availability aggregate for the planner grid
    if (source?.cityId && (args.sessionsCreated > 0 || args.sessionsUpdated > 0)) {
      const currentYear = new Date(now).getFullYear();
      await ctx.scheduler.runAfter(0, internal.planner.aggregates.recomputeForCity, {
        cityId: source.cityId,
        year: currentYear,
      });
    }

    return args.jobId;
  },
});

/**
 * Mark a job as failed and update health metrics.
 *
 * Automated responses:
 * - 3 consecutive failures -> flag for regeneration, create warning alert
 * - 5 consecutive 404 errors -> auto-disable source, create error alert
 * - 5+ failures -> create regeneration alert
 */
export const failScrapeJob = mutation({
  args: {
    jobId: v.id("scrapeJobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Scrape job not found");
    }

    if (job.status !== "running" && job.status !== "pending") {
      throw new Error(`Cannot fail job in "${job.status}" status`);
    }

    const now = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "failed",
      completedAt: now,
      errorMessage: args.errorMessage,
    });

    // Update source health metrics
    const source = await ctx.db.get(job.sourceId);
    if (source) {
      // 10C: Detect rate-limit errors (429 or "rate limit" in message)
      const isRateLimited = /429|rate.?limit/i.test(args.errorMessage);

      // Detect 404 errors - URL is broken
      const is404Error = /404|not found/i.test(args.errorMessage);

      // For rate-limited errors, don't increment consecutiveFailures
      const newConsecutiveFailures = isRateLimited
        ? source.scraperHealth.consecutiveFailures
        : source.scraperHealth.consecutiveFailures + 1;
      const newTotalRuns = source.scraperHealth.totalRuns + 1;
      const successfulRuns = Math.round(
        source.scraperHealth.successRate * source.scraperHealth.totalRuns
      );
      const newSuccessRate = successfulRuns / newTotalRuns;

      // Flag for regeneration if too many consecutive failures (but not for 404s or rate limits)
      const needsRegeneration =
        (!is404Error && !isRateLimited && newConsecutiveFailures >= 3) ||
        source.scraperHealth.needsRegeneration;

      // Track URL status in history
      const urlHistory = source.urlHistory || [];
      if (is404Error) {
        urlHistory.push({
          url: source.url,
          status: "404",
          checkedAt: now,
        });
        // Keep only last 20 entries
        while (urlHistory.length > 20) {
          urlHistory.shift();
        }
      }

      // Count recent consecutive 404s
      let consecutive404s = 0;
      for (let i = urlHistory.length - 1; i >= 0; i--) {
        if (urlHistory[i].status === "404") {
          consecutive404s++;
        } else {
          break;
        }
      }

      // Auto-disable after 5 consecutive 404s - URL is broken, stop wasting resources
      const shouldAutoDisable = is404Error && consecutive404s >= 5 && source.isActive;

      // 10A: Exponential backoff for failing sources
      // Rate-limited: fixed 6-hour delay
      // Normal failure: exponential backoff capped at 1 week
      let nextScheduledScrape: number;
      if (isRateLimited) {
        nextScheduledScrape = now + (6 * 60 * 60 * 1000); // 6 hours
      } else {
        const backoffHours = Math.min(
          source.scrapeFrequencyHours * Math.pow(2, newConsecutiveFailures),
          168 // cap at 1 week
        );
        nextScheduledScrape = now + (backoffHours * 60 * 60 * 1000);
      }

      const updates: Record<string, unknown> = {
        scraperHealth: {
          ...source.scraperHealth,
          lastFailureAt: now,
          consecutiveFailures: newConsecutiveFailures,
          totalRuns: newTotalRuns,
          successRate: newSuccessRate,
          lastError: args.errorMessage,
          needsRegeneration,
        },
        urlHistory,
        nextScheduledScrape,
      };

      if (shouldAutoDisable) {
        updates.isActive = false;
        updates.closureReason = `Auto-disabled: URL returned 404 for ${consecutive404s} consecutive attempts`;
        updates.closedAt = now;
        updates.closedBy = "system";
      }

      await ctx.db.patch(job.sourceId, updates);

      // Create alerts based on failure type
      if (isRateLimited) {
        // 10C: Info-level alert for rate limiting
        await ctx.db.insert("scraperAlerts", {
          sourceId: job.sourceId,
          alertType: "rate_limited",
          message: `Source "${source.name}" was rate-limited. Next attempt in 6 hours.`,
          severity: "info",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      } else if (shouldAutoDisable) {
        // High-priority alert for auto-disabled source
        await ctx.db.insert("scraperAlerts", {
          sourceId: job.sourceId,
          alertType: "scraper_disabled",
          message: `Source "${source.name}" auto-disabled after ${consecutive404s} consecutive 404 errors. URL needs to be updated: ${source.url}`,
          severity: "error",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      } else if (newConsecutiveFailures === 3) {
        await ctx.db.insert("scraperAlerts", {
          sourceId: job.sourceId,
          alertType: "scraper_degraded",
          message: `Scraper "${source.name}" has failed 3 times consecutively. Last error: ${args.errorMessage}`,
          severity: "warning",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      } else if (newConsecutiveFailures >= 5 && !is404Error) {
        await ctx.db.insert("scraperAlerts", {
          sourceId: job.sourceId,
          alertType: "scraper_needs_regeneration",
          message: `Scraper "${source.name}" needs regeneration after ${newConsecutiveFailures} consecutive failures.`,
          severity: "error",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      }
    }

    return args.jobId;
  },
});

/**
 * Clean up stuck/pending jobs for a source
 */
export const cleanupStuckJobs = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const stuckJobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "pending")
      )
      .collect();

    const runningJobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source_and_status", (q) =>
        q.eq("sourceId", args.sourceId).eq("status", "running")
      )
      .collect();

    const allStuck = [...stuckJobs, ...runningJobs];

    for (const job of allStuck) {
      await ctx.db.patch(job._id, {
        status: "failed",
        completedAt: Date.now(),
        errorMessage: "Manually marked as failed (cleanup)",
      });
    }

    return { cleaned: allStuck.length };
  },
});

/**
 * Flag a source for re-scan
 */
export const flagForRescan = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      needsRescan: true,
      rescanRequestedAt: Date.now(),
      rescanReason: args.reason,
      // Schedule for immediate scrape
      nextScheduledScrape: Date.now(),
    });

    return args.sourceId;
  },
});

/**
 * Clear the re-scan flag after scraping
 */
export const clearRescanFlag = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      needsRescan: false,
      rescanRequestedAt: undefined,
      rescanReason: undefined,
    });

    return args.sourceId;
  },
});
