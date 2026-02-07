import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Update scraper health metrics after a scrape attempt
 * Called internally after scrape completion or failure
 */
export const updateScraperHealth = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const now = Date.now();
    const currentHealth = source.scraperHealth;

    if (args.success) {
      // Calculate new success rate
      const newTotalRuns = currentHealth.totalRuns + 1;
      const previousSuccessfulRuns = Math.round(
        currentHealth.successRate * currentHealth.totalRuns
      );
      const newSuccessRate = (previousSuccessfulRuns + 1) / newTotalRuns;

      await ctx.db.patch(args.sourceId, {
        scraperHealth: {
          lastSuccessAt: now,
          lastFailureAt: currentHealth.lastFailureAt,
          consecutiveFailures: 0, // Reset on success
          totalRuns: newTotalRuns,
          successRate: newSuccessRate,
          lastError: undefined, // Clear error on success
          needsRegeneration: false, // Clear flag on success
        },
        lastScrapedAt: now,
      });
    } else {
      // Calculate new metrics for failure
      const newTotalRuns = currentHealth.totalRuns + 1;
      const previousSuccessfulRuns = Math.round(
        currentHealth.successRate * currentHealth.totalRuns
      );
      const newSuccessRate = previousSuccessfulRuns / newTotalRuns;
      const newConsecutiveFailures = currentHealth.consecutiveFailures + 1;

      // Determine if scraper needs regeneration
      const needsRegeneration =
        newConsecutiveFailures >= 3 || currentHealth.needsRegeneration;

      await ctx.db.patch(args.sourceId, {
        scraperHealth: {
          lastSuccessAt: currentHealth.lastSuccessAt,
          lastFailureAt: now,
          consecutiveFailures: newConsecutiveFailures,
          totalRuns: newTotalRuns,
          successRate: newSuccessRate,
          lastError: args.error,
          needsRegeneration,
        },
      });

      // Auto-disable scraper if too many failures
      if (newConsecutiveFailures >= 10) {
        await ctx.db.patch(args.sourceId, {
          isActive: false,
        });

        // Create critical alert
        await ctx.db.insert("scraperAlerts", {
          sourceId: args.sourceId,
          alertType: "scraper_disabled",
          message: `Scraper "${source.name}" has been automatically disabled after ${newConsecutiveFailures} consecutive failures.`,
          severity: "critical",
          createdAt: now,
          acknowledgedAt: undefined,
          acknowledgedBy: undefined,
        });
      }
    }

    return args.sourceId;
  },
});

/**
 * Schedule the next scrape based on frequency settings
 * Called internally after scrape completion
 */
export const scheduleNextScrape = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    const now = Date.now();
    const frequencyMs = source.scrapeFrequencyHours * 60 * 60 * 1000;

    // Always schedule from NOW + frequency to prevent rapid re-scraping
    // This ensures we wait the full frequency interval after each scrape
    const nextScheduledScrape = now + frequencyMs;

    await ctx.db.patch(args.sourceId, {
      nextScheduledScrape,
    });

    return {
      sourceId: args.sourceId,
      nextScheduledScrape,
    };
  },
});

/**
 * Mark raw data as processed
 * Called internally after processing scraped data into sessions
 */
export const markRawDataProcessed = internalMutation({
  args: {
    rawDataId: v.id("scrapeRawData"),
    resultingSessionId: v.optional(v.id("sessions")),
    processingError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rawData = await ctx.db.get(args.rawDataId);
    if (!rawData) {
      throw new Error("Raw data not found");
    }

    await ctx.db.patch(args.rawDataId, {
      processedAt: Date.now(),
      resultingSessionId: args.resultingSessionId,
      processingError: args.processingError,
    });

    return args.rawDataId;
  },
});

/**
 * Mark changes as notified
 * Called internally after sending notifications for changes
 */
export const markChangesNotified = internalMutation({
  args: {
    changeIds: v.array(v.id("scrapeChanges")),
  },
  handler: async (ctx, args) => {
    for (const changeId of args.changeIds) {
      const change = await ctx.db.get(changeId);
      if (change) {
        await ctx.db.patch(changeId, {
          notified: true,
        });
      }
    }

    return args.changeIds.length;
  },
});

/**
 * Clean up old scrape data
 * Called periodically to remove old raw data and completed jobs
 */
export const cleanupOldScrapeData = internalMutation({
  args: {
    retentionDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.retentionDays * 24 * 60 * 60 * 1000;
    let deletedJobs = 0;
    let deletedRawData = 0;

    // Get old completed/failed jobs (use index for each status, then filter by time)
    const [completedJobs, failedJobs] = await Promise.all([
      ctx.db.query("scrapeJobs")
        .withIndex("by_status", (q) => q.eq("status", "completed"))
        .filter((q) => q.lt(q.field("completedAt"), cutoffTime))
        .take(50),
      ctx.db.query("scrapeJobs")
        .withIndex("by_status", (q) => q.eq("status", "failed"))
        .filter((q) => q.lt(q.field("completedAt"), cutoffTime))
        .take(50),
    ]);
    const oldJobs = [...completedJobs, ...failedJobs];

    for (const job of oldJobs) {
      // Delete associated raw data first
      const rawDataRecords = await ctx.db
        .query("scrapeRawData")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      for (const rawData of rawDataRecords) {
        await ctx.db.delete(rawData._id);
        deletedRawData++;
      }

      // Delete the job
      await ctx.db.delete(job._id);
      deletedJobs++;
    }

    return {
      deletedJobs,
      deletedRawData,
    };
  },
});

/**
 * Reset scraper health metrics
 * Called after major scraper regeneration
 */
// 10E: Auto-trigger scraper regeneration helpers
// ============================================

/**
 * Query sources where scraperHealth.needsRegeneration === true
 * Used by runScheduledScrapes to auto-trigger regeneration requests.
 */
export const getSourcesNeedingRegeneration = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      _id: Id<"scrapeSources">;
      name: string;
      url: string;
      cityId: Id<"cities">;
    }>
  > => {
    const activeSources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    return activeSources
      .filter((source) => source.scraperHealth.needsRegeneration === true)
      .map((source) => ({
        _id: source._id,
        name: source.name,
        url: source.url,
        cityId: source.cityId,
      }));
  },
});

/**
 * Create a scraper development request for a source that needs regeneration.
 * Skips if a pending/in_progress request already exists for this source.
 */
export const createRegenerationRequest = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    sourceName: v.string(),
    sourceUrl: v.string(),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    const existingBySource = await ctx.db
      .query("scraperDevelopmentRequests")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    const hasActiveRequest = existingBySource.some(
      (r) =>
        r.status === "pending" ||
        r.status === "in_progress" ||
        r.status === "testing"
    );

    if (hasActiveRequest) {
      return null;
    }

    const existingByUrl = await ctx.db
      .query("scraperDevelopmentRequests")
      .withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
      .first();

    if (
      existingByUrl &&
      (existingByUrl.status === "pending" ||
        existingByUrl.status === "in_progress" ||
        existingByUrl.status === "testing")
    ) {
      return null;
    }

    const requestId = await ctx.db.insert("scraperDevelopmentRequests", {
      sourceName: args.sourceName,
      sourceUrl: args.sourceUrl,
      cityId: args.cityId,
      sourceId: args.sourceId,
      requestedBy: "auto-regeneration",
      requestedAt: Date.now(),
      status: "pending",
      scraperVersion: 0,
      notes:
        "Auto-created: scraper flagged for regeneration due to consecutive failures or zero results",
    });

    return requestId;
  },
});

export const resetScraperHealth = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Scrape source not found");
    }

    await ctx.db.patch(args.sourceId, {
      scraperHealth: {
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        consecutiveFailures: 0,
        totalRuns: 0,
        successRate: 0,
        lastError: undefined,
        needsRegeneration: false,
      },
    });

    return args.sourceId;
  },
});
