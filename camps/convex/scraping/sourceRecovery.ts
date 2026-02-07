/**
 * Source Recovery
 *
 * Periodically checks disabled sources (closed due to 404 errors)
 * to see if their URLs have come back online. If so, re-enables them.
 */

import { internalAction, internalQuery, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Query to find sources that are candidates for recovery.
 * Finds inactive sources where:
 * - closedAt is more than 7 days ago
 * - closureReason contains "404"
 */
export const getRecoveryCandidates = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      _id: Id<"scrapeSources">;
      name: string;
      url: string;
    }>
  > => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Get all inactive sources
    const inactiveSources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", false))
      .collect();

    // Filter to those with 404-related closures older than 7 days
    return inactiveSources
      .filter((source) => {
        if (!source.closedAt || !source.closureReason) return false;
        return (
          source.closedAt < sevenDaysAgo &&
          /404/i.test(source.closureReason)
        );
      })
      .map((source) => ({
        _id: source._id,
        name: source.name,
        url: source.url,
      }));
  },
});

/**
 * Mutation to re-enable a recovered source.
 * Clears closure fields, resets health, and creates an info alert.
 */
export const reEnableSource = internalMutation({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;

    const now = Date.now();

    await ctx.db.patch(args.sourceId, {
      isActive: true,
      closureReason: undefined,
      closedAt: undefined,
      closedBy: undefined,
      // Reset health and schedule an immediate scrape
      scraperHealth: {
        ...source.scraperHealth,
        consecutiveFailures: 0,
        lastError: undefined,
        needsRegeneration: false,
        consecutiveZeroResults: 0,
      },
      nextScheduledScrape: now,
    });

    // Create info alert about recovery
    await ctx.db.insert("scraperAlerts", {
      sourceId: args.sourceId,
      alertType: "source_recovered",
      message: `Source "${source.name}" has been automatically re-enabled — URL is responding again: ${source.url}`,
      severity: "info",
      createdAt: now,
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
    });
  },
});

/**
 * Check disabled sources with 404 closure reasons to see if they've recovered.
 * Re-enables sources whose URLs now return HTTP 200.
 *
 * Runs weekly via cron.
 */
export const checkDisabledSources = internalAction({
  args: {},
  handler: async (ctx) => {
    // Query sources that are inactive and closed due to 404 > 7 days ago
    const candidates = await ctx.runQuery(
      internal.scraping.sourceRecovery.getRecoveryCandidates,
      {}
    );

    const results: Array<{
      sourceId: string;
      name: string;
      url: string;
      recovered: boolean;
      statusCode?: number;
      error?: string;
    }> = [];

    for (const source of candidates) {
      try {
        // Do a HEAD request to check if the URL is back
        const response = await fetch(source.url, {
          method: "HEAD",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PDXCampsBot/1.0; +https://pdxcamps.com/bot)",
          },
          redirect: "follow",
        });

        if (response.ok) {
          // URL is back! Re-enable the source
          await ctx.runMutation(
            internal.scraping.sourceRecovery.reEnableSource,
            { sourceId: source._id }
          );

          results.push({
            sourceId: source._id,
            name: source.name,
            url: source.url,
            recovered: true,
            statusCode: response.status,
          });
        } else {
          results.push({
            sourceId: source._id,
            name: source.name,
            url: source.url,
            recovered: false,
            statusCode: response.status,
          });
        }
      } catch (error) {
        results.push({
          sourceId: source._id,
          name: source.name,
          url: source.url,
          recovered: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const recoveredCount = results.filter((r) => r.recovered).length;
    console.log(
      `[SourceRecovery] Checked ${results.length} sources, recovered ${recoveredCount}`
    );

    return {
      checked: results.length,
      recovered: recoveredCount,
      results,
    };
  },
});
