/**
 * Data Quality Checks
 *
 * Scheduled checks that run daily to detect data quality issues:
 * - Sources without scraper code/module
 * - Sources with high percentage of zero-price sessions
 * - Sources with low quality scores
 * - Sources with no recent successful scrapes
 */

import { internalQuery, internalMutation } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { v } from "convex/values";

// Thresholds for alerts
const ZERO_PRICE_THRESHOLD = 0.5; // Alert if >50% sessions have $0 price

/**
 * Get all active sources with their health info for quality checks.
 */
export const getActiveSourcesForCheck = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<
      Pick<
        Doc<"scrapeSources">,
        | "_id"
        | "name"
        | "url"
        | "scraperCode"
        | "scraperModule"
        | "scraperHealth"
        | "dataQualityScore"
        | "qualityTier"
      >
    >
  > => {
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    return sources.map((s) => ({
      _id: s._id,
      name: s.name,
      url: s.url,
      scraperCode: s.scraperCode,
      scraperModule: s.scraperModule,
      scraperHealth: s.scraperHealth,
      dataQualityScore: s.dataQualityScore,
      qualityTier: s.qualityTier,
    }));
  },
});

/**
 * Find sources where >50% of sessions have $0 price.
 */
export const findSourcesWithHighZeroPriceRatio = internalQuery({
  args: {
    cursor: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    results: Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      zeroPriceCount: number;
      totalCount: number;
      zeroPriceRatio: number;
    }>;
    isDone: boolean;
    nextCursor?: number;
  }> => {
    const batchSize = args.batchSize ?? 5;
    const cursorIndex = args.cursor ?? 0;

    const results: Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      zeroPriceCount: number;
      totalCount: number;
      zeroPriceRatio: number;
    }> = [];

    // Get active sources in batches
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const batch = sources.slice(cursorIndex, cursorIndex + batchSize);

    for (const source of batch) {
      // Only count — don't load full session documents
      let totalCount = 0;
      let zeroPriceCount = 0;
      for await (const session of ctx.db
        .query("sessions")
        .withIndex("by_source", (q) => q.eq("sourceId", source._id))) {
        totalCount++;
        if (session.price === 0) zeroPriceCount++;
      }

      if (totalCount === 0) continue;

      const zeroPriceRatio = zeroPriceCount / totalCount;
      if (zeroPriceRatio > ZERO_PRICE_THRESHOLD) {
        results.push({
          sourceId: source._id,
          sourceName: source.name,
          zeroPriceCount,
          totalCount,
          zeroPriceRatio,
        });
      }
    }

    const nextCursor = cursorIndex + batchSize;
    const isDone = nextCursor >= sources.length;

    return { results, isDone, nextCursor: isDone ? undefined : nextCursor };
  },
});

/**
 * Find sources with broken URLs that need discovery.
 * These are sources that were auto-disabled due to 404 errors.
 */
export const findBrokenUrlSources = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      brokenUrl: string;
      orgWebsite?: string;
    }>
  > => {
    // Find sources that were auto-disabled due to 404s
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", false))
      .filter((q) => q.eq(q.field("closedBy"), "system"))
      .collect();

    const results: Array<{
      sourceId: Id<"scrapeSources">;
      sourceName: string;
      brokenUrl: string;
      orgWebsite?: string;
    }> = [];

    for (const source of sources) {
      // Check if it was closed due to 404
      if (source.closureReason?.includes("404")) {
        let orgWebsite: string | undefined;
        if (source.organizationId) {
          const org = await ctx.db.get(source.organizationId);
          orgWebsite = org?.website;
        }

        results.push({
          sourceId: source._id,
          sourceName: source.name,
          brokenUrl: source.url,
          orgWebsite,
        });
      }
    }

    return results;
  },
});

/**
 * Create an alert if one doesn't already exist for this source/type combination.
 * Returns true if alert was created, false if duplicate.
 */
export const createAlertIfNotExists = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
    alertType: v.union(
      v.literal("scraper_disabled"),
      v.literal("scraper_degraded"),
      v.literal("high_change_volume"),
      v.literal("scraper_needs_regeneration"),
      v.literal("new_sources_pending")
    ),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical")
    ),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    // Check for existing unacknowledged alert of this type for this source
    const existingAlerts = await ctx.db
      .query("scraperAlerts")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    const hasDuplicate = existingAlerts.some(
      (alert) =>
        alert.alertType === args.alertType &&
        alert.acknowledgedAt === undefined &&
        // Consider alerts created in the last 24 hours as duplicates
        alert.createdAt > Date.now() - 24 * 60 * 60 * 1000
    );

    if (hasDuplicate) {
      return false;
    }

    await ctx.db.insert("scraperAlerts", {
      sourceId: args.sourceId,
      alertType: args.alertType,
      message: args.message,
      severity: args.severity,
      createdAt: Date.now(),
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
    });

    return true;
  },
});
