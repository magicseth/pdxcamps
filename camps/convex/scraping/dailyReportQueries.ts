/**
 * Daily Report Queries
 *
 * Queries for gathering statistics used in the daily scraper report email.
 * These are separate from the action file because queries cannot be in "use node" files.
 */

import { internalQuery } from "../_generated/server";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Get scraping statistics from the last 24 hours.
 */
export const getDailyStats = internalQuery({
  args: {},
  handler: async (ctx): Promise<{
    jobsCompleted: number;
    jobsFailed: number;
    sessionsFound: number;
    sessionsCreated: number;
    sessionsUpdated: number;
  }> => {
    const cutoff = Date.now() - TWENTY_FOUR_HOURS;

    // Get all jobs completed in the last 24 hours
    const recentJobs = await ctx.db
      .query("scrapeJobs")
      .filter((q) =>
        q.and(
          q.neq(q.field("completedAt"), undefined),
          q.gte(q.field("completedAt"), cutoff)
        )
      )
      .collect();

    let jobsCompleted = 0;
    let jobsFailed = 0;
    let sessionsFound = 0;
    let sessionsCreated = 0;
    let sessionsUpdated = 0;

    for (const job of recentJobs) {
      if (job.status === "completed") {
        jobsCompleted++;
        sessionsFound += job.sessionsFound ?? 0;
        sessionsCreated += job.sessionsCreated ?? 0;
        sessionsUpdated += job.sessionsUpdated ?? 0;
      } else if (job.status === "failed") {
        jobsFailed++;
      }
    }

    return {
      jobsCompleted,
      jobsFailed,
      sessionsFound,
      sessionsCreated,
      sessionsUpdated,
    };
  },
});

/**
 * Get recent unacknowledged alerts from the last 24 hours.
 */
export const getRecentAlerts = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      message: string;
      severity: "info" | "warning" | "error" | "critical";
      alertType: string;
      createdAt: number;
    }>
  > => {
    const cutoff = Date.now() - TWENTY_FOUR_HOURS;

    // Get unacknowledged alerts from the last 24 hours
    const alerts = await ctx.db
      .query("scraperAlerts")
      .withIndex("by_unacknowledged", (q) => q.eq("acknowledgedAt", undefined))
      .filter((q) => q.gte(q.field("createdAt"), cutoff))
      .collect();

    // Sort by severity (critical first) then by time
    const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.createdAt - a.createdAt;
    });

    return alerts.map((a) => ({
      message: a.message,
      severity: a.severity,
      alertType: a.alertType,
      createdAt: a.createdAt,
    }));
  },
});
