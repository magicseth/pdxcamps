/**
 * Scraper Automation
 *
 * Automated systems for maintaining scraper health:
 * 1. Auto-queue sources needing regeneration
 * 2. Auto-queue sources without scrapers
 * 3. Auto-disable sources with persistent failures
 * 4. Track automation metrics
 */

import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Find sources that need scraper development but don't have a pending request.
 * Returns sources that:
 * - Have needsRegeneration = true, OR
 * - Have no scraperCode and no scraperModule
 * AND don't have an existing pending/in_progress dev request
 */
export const findSourcesNeedingScraperWork = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      sourceUrl: string;
      reason: "needs_regeneration" | "no_scraper";
      cityId: Id<"cities">;
    }>
  > => {
    // Get all active sources
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    // Get all pending/in_progress dev requests (use index for each status)
    const [pending, inProgress, testing] = await Promise.all([
      ctx.db.query("scraperDevelopmentRequests").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("scraperDevelopmentRequests").withIndex("by_status", (q) => q.eq("status", "in_progress")).collect(),
      ctx.db.query("scraperDevelopmentRequests").withIndex("by_status", (q) => q.eq("status", "testing")).collect(),
    ]);
    const pendingRequests = [...pending, ...inProgress, ...testing];

    const sourcesWithPendingRequest = new Set(
      pendingRequests.map((r) => r.sourceId).filter(Boolean)
    );

    const results: Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      sourceUrl: string;
      reason: "needs_regeneration" | "no_scraper";
      cityId: Id<"cities">;
    }> = [];

    for (const source of sources) {
      // Skip if already has a pending request
      if (sourcesWithPendingRequest.has(source._id)) {
        continue;
      }

      // Check if needs regeneration
      if (source.scraperHealth.needsRegeneration) {
        results.push({
          sourceId: source._id,
          sourceName: source.name,
          sourceUrl: source.url,
          reason: "needs_regeneration",
          cityId: source.cityId,
        });
        continue;
      }

      // Check if has no scraper
      if (!source.scraperCode && !source.scraperModule) {
        results.push({
          sourceId: source._id,
          sourceName: source.name,
          sourceUrl: source.url,
          reason: "no_scraper",
          cityId: source.cityId,
        });
      }
    }

    return results;
  },
});

/**
 * Create scraper development requests for sources that need them.
 * Called by the daily cron to auto-queue work.
 */
export const autoQueueScraperDevelopment = internalMutation({
  args: {
    maxToQueue: v.optional(v.number()), // Limit how many to queue at once
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    queued: number;
    sources: Array<{ name: string; reason: string }>;
  }> => {
    const maxToQueue = args.maxToQueue ?? 10;

    // This is a mutation so we can't call the query directly
    // We need to duplicate the logic here

    // Get all active sources
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    // Get all pending/in_progress dev requests (use index for each status)
    const [pending, inProgress, testing] = await Promise.all([
      ctx.db.query("scraperDevelopmentRequests").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
      ctx.db.query("scraperDevelopmentRequests").withIndex("by_status", (q) => q.eq("status", "in_progress")).collect(),
      ctx.db.query("scraperDevelopmentRequests").withIndex("by_status", (q) => q.eq("status", "testing")).collect(),
    ]);
    const pendingRequests = [...pending, ...inProgress, ...testing];

    const sourcesWithPendingRequest = new Set(
      pendingRequests.map((r) => r.sourceId).filter(Boolean)
    );

    const toQueue: Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      sourceUrl: string;
      reason: "needs_regeneration" | "no_scraper";
      cityId: Id<"cities">;
    }> = [];

    for (const source of sources) {
      if (toQueue.length >= maxToQueue) break;

      // Skip if already has a pending request
      if (sourcesWithPendingRequest.has(source._id)) {
        continue;
      }

      // Prioritize regeneration needs over new scrapers
      if (source.scraperHealth.needsRegeneration) {
        toQueue.push({
          sourceId: source._id,
          sourceName: source.name,
          sourceUrl: source.url,
          reason: "needs_regeneration",
          cityId: source.cityId,
        });
        continue;
      }

      // Then queue sources without scrapers
      if (!source.scraperCode && !source.scraperModule) {
        toQueue.push({
          sourceId: source._id,
          sourceName: source.name,
          sourceUrl: source.url,
          reason: "no_scraper",
          cityId: source.cityId,
        });
      }
    }

    // Create development requests
    const queued: Array<{ name: string; reason: string }> = [];

    for (const item of toQueue) {
      await ctx.db.insert("scraperDevelopmentRequests", {
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        sourceId: item.sourceId,
        cityId: item.cityId,
        requestedBy: "system",
        requestedAt: Date.now(),
        notes:
          item.reason === "needs_regeneration"
            ? "Auto-queued: Scraper needs regeneration due to repeated failures"
            : "Auto-queued: Source has no scraper configured",
        status: "pending",
      });

      // Clear the needsRegeneration flag since we've queued it
      if (item.reason === "needs_regeneration") {
        const source = await ctx.db.get(item.sourceId);
        if (source) {
          await ctx.db.patch(item.sourceId, {
            scraperHealth: {
              ...source.scraperHealth,
              needsRegeneration: false,
            },
          });
        }
      }

      queued.push({ name: item.sourceName, reason: item.reason });
    }

    return { queued: queued.length, sources: queued };
  },
});

/**
 * Get automation metrics for monitoring.
 */
export const getAutomationMetrics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("scrapeSources").collect();
    const devRequests = await ctx.db
      .query("scraperDevelopmentRequests")
      .collect();

    const activeSources = sources.filter((s) => s.isActive);
    const disabledSources = sources.filter((s) => !s.isActive);
    const autoDisabled = disabledSources.filter(
      (s) => s.closedBy === "system"
    );

    const sourcesWithScraper = activeSources.filter(
      (s) => s.scraperCode || s.scraperModule
    );
    const sourcesWithoutScraper = activeSources.filter(
      (s) => !s.scraperCode && !s.scraperModule
    );
    const sourcesNeedingRegeneration = activeSources.filter(
      (s) => s.scraperHealth.needsRegeneration
    );

    const pendingRequests = devRequests.filter((r) => r.status === "pending");
    const inProgressRequests = devRequests.filter(
      (r) => r.status === "in_progress"
    );
    const completedRequests = devRequests.filter(
      (r) => r.status === "completed"
    );
    const failedRequests = devRequests.filter((r) => r.status === "failed");

    // Count sources by health status
    const healthyCount = activeSources.filter(
      (s) =>
        s.scraperHealth.consecutiveFailures === 0 &&
        (s.scraperCode || s.scraperModule)
    ).length;
    const degradedCount = activeSources.filter(
      (s) =>
        s.scraperHealth.consecutiveFailures > 0 &&
        s.scraperHealth.consecutiveFailures < 5
    ).length;
    const failingCount = activeSources.filter(
      (s) => s.scraperHealth.consecutiveFailures >= 5
    ).length;

    return {
      sources: {
        total: sources.length,
        active: activeSources.length,
        disabled: disabledSources.length,
        autoDisabled: autoDisabled.length,
        withScraper: sourcesWithScraper.length,
        withoutScraper: sourcesWithoutScraper.length,
        needingRegeneration: sourcesNeedingRegeneration.length,
      },
      health: {
        healthy: healthyCount,
        degraded: degradedCount,
        failing: failingCount,
      },
      devRequests: {
        total: devRequests.length,
        pending: pendingRequests.length,
        inProgress: inProgressRequests.length,
        completed: completedRequests.length,
        failed: failedRequests.length,
      },
    };
  },
});

/**
 * Clean up stale development requests that have been stuck for too long.
 */
export const cleanupStaleDevRequests = internalMutation({
  args: {
    maxAgeDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxAgeDays = args.maxAgeDays ?? 7;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    // Query by status using index, then filter by age
    const [pendingStale, inProgressStale] = await Promise.all([
      ctx.db.query("scraperDevelopmentRequests")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .filter((q) => q.lt(q.field("requestedAt"), cutoff))
        .collect(),
      ctx.db.query("scraperDevelopmentRequests")
        .withIndex("by_status", (q) => q.eq("status", "in_progress"))
        .filter((q) => q.lt(q.field("requestedAt"), cutoff))
        .collect(),
    ]);
    const staleRequests = [...pendingStale, ...inProgressStale];

    let cleaned = 0;
    for (const request of staleRequests) {
      await ctx.db.patch(request._id, {
        status: "failed",
        lastTestError: `Auto-failed: Request was stale for ${maxAgeDays}+ days without completion`,
      });
      cleaned++;
    }

    return { cleaned };
  },
});
