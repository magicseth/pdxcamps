"use node";

/**
 * Data Quality Actions
 *
 * Actions that run data quality checks. Separated from dataQualityChecks.ts
 * because actions require "use node" while mutations/queries don't.
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Thresholds for alerts
const LOW_QUALITY_THRESHOLD = 50; // Alert if quality score < 50%
const STALE_SCRAPE_DAYS = 7; // Alert if no successful scrape in 7+ days

interface DataQualityIssue {
  sourceId: Id<"scrapeSources">;
  sourceName: string;
  issueType: "no_scraper" | "high_zero_price" | "low_quality" | "stale_scrape";
  severity: "info" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Run all data quality checks and create alerts for issues found.
 * Intended to be called by a daily cron job.
 */
export const runDataQualityChecks = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    issuesFound: number;
    alertsCreated: number;
    issues: DataQualityIssue[];
  }> => {
    const issues: DataQualityIssue[] = [];

    // Get all active sources
    const sources = await ctx.runQuery(
      internal.scraping.dataQualityChecks.getActiveSourcesForCheck
    );

    const now = Date.now();
    const sevenDaysAgo = now - STALE_SCRAPE_DAYS * 24 * 60 * 60 * 1000;

    for (const source of sources) {
      // Check 1: Sources without scraper code or module
      if (!source.scraperCode && !source.scraperModule) {
        issues.push({
          sourceId: source._id,
          sourceName: source.name,
          issueType: "no_scraper",
          severity: "warning",
          message: `Source "${source.name}" has no scraper code or module configured`,
        });
      }

      // Check 2: Sources with low quality score
      if (
        source.dataQualityScore !== undefined &&
        source.dataQualityScore < LOW_QUALITY_THRESHOLD
      ) {
        issues.push({
          sourceId: source._id,
          sourceName: source.name,
          issueType: "low_quality",
          severity: "warning",
          message: `Source "${source.name}" has low quality score: ${source.dataQualityScore}%`,
          details: { qualityScore: source.dataQualityScore },
        });
      }

      // Check 3: Sources with no recent successful scrape
      if (
        source.scraperHealth.lastSuccessAt &&
        source.scraperHealth.lastSuccessAt < sevenDaysAgo
      ) {
        const daysSinceSuccess = Math.floor(
          (now - source.scraperHealth.lastSuccessAt) / (24 * 60 * 60 * 1000)
        );
        issues.push({
          sourceId: source._id,
          sourceName: source.name,
          issueType: "stale_scrape",
          severity: "warning",
          message: `Source "${source.name}" hasn't had a successful scrape in ${daysSinceSuccess} days`,
          details: { daysSinceSuccess },
        });
      } else if (
        !source.scraperHealth.lastSuccessAt &&
        source.scraperHealth.totalRuns > 0
      ) {
        // Has run but never succeeded
        issues.push({
          sourceId: source._id,
          sourceName: source.name,
          issueType: "stale_scrape",
          severity: "error",
          message: `Source "${source.name}" has never had a successful scrape (${source.scraperHealth.totalRuns} attempts)`,
          details: { totalRuns: source.scraperHealth.totalRuns },
        });
      }
    }

    // Check 4: Sources with high percentage of zero-price sessions
    const zeroPriceIssues = await ctx.runQuery(
      internal.scraping.dataQualityChecks.findSourcesWithHighZeroPriceRatio
    );

    for (const issue of zeroPriceIssues) {
      issues.push({
        sourceId: issue.sourceId,
        sourceName: issue.sourceName,
        issueType: "high_zero_price",
        severity: "warning",
        message: `Source "${issue.sourceName}" has ${Math.round(issue.zeroPriceRatio * 100)}% of sessions with $0 price (${issue.zeroPriceCount}/${issue.totalCount})`,
        details: {
          zeroPriceCount: issue.zeroPriceCount,
          totalCount: issue.totalCount,
          zeroPriceRatio: issue.zeroPriceRatio,
        },
      });
    }

    // Create alerts for issues, avoiding duplicates
    let alertsCreated = 0;
    for (const issue of issues) {
      const created = await ctx.runMutation(
        internal.scraping.dataQualityChecks.createAlertIfNotExists,
        {
          sourceId: issue.sourceId,
          alertType: "scraper_degraded",
          severity: issue.severity,
          message: issue.message,
        }
      );
      if (created) {
        alertsCreated++;
      }
    }

    return {
      issuesFound: issues.length,
      alertsCreated,
      issues,
    };
  },
});
