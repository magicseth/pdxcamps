import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

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

    // Get old completed jobs
    const oldJobs = await ctx.db
      .query("scrapeJobs")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "completed"),
            q.eq(q.field("status"), "failed")
          ),
          q.lt(q.field("completedAt"), cutoffTime)
        )
      )
      .take(100); // Process in batches

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
