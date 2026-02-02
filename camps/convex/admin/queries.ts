import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { getFamily } from "../lib/auth";

const ADMIN_EMAILS = ["seth@magicseth.com"];

/**
 * Check if the current user is an admin by looking up their family record
 */
async function checkIsAdmin(ctx: QueryCtx): Promise<boolean> {
  const family = await getFamily(ctx);
  if (!family) return false;
  return ADMIN_EMAILS.includes(family.email);
}

/**
 * Check if the current user is an admin
 */
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    return checkIsAdmin(ctx);
  },
});

/**
 * Get admin scraping dashboard data
 * Shows all scrape sources with stats
 */
export const getScrapingDashboard = query({
  args: {},
  handler: async (ctx) => {
    // Check admin
    const isAdminUser = await checkIsAdmin(ctx);
    if (!isAdminUser) {
      return null; // Not authorized
    }

    // Get all scrape sources
    const sources = await ctx.db.query("scrapeSources").collect();

    // Get session counts per source
    const sourcesWithStats = await Promise.all(
      sources.map(async (source) => {
        // Count sessions from this source
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_source", (q) => q.eq("sourceId", source._id))
          .collect();

        // Get organization if linked
        const organization = source.organizationId
          ? await ctx.db.get(source.organizationId)
          : null;

        // Get most recent job
        const recentJob = await ctx.db
          .query("scrapeJobs")
          .withIndex("by_source", (q) => q.eq("sourceId", source._id))
          .order("desc")
          .first();

        // Count active vs total sessions
        const activeSessions = sessions.filter((s) => s.status === "active");

        return {
          _id: source._id,
          name: source.name,
          url: source.url,
          organizationName: organization?.name ?? null,
          organizationSlug: organization?.slug ?? null,
          scraperModule: source.scraperModule,
          isActive: source.isActive,

          // Session stats
          totalSessions: sessions.length,
          activeSessions: activeSessions.length,

          // Health info
          health: source.scraperHealth,
          lastScrapedAt: source.lastScrapedAt,
          nextScheduledScrape: source.nextScheduledScrape,
          scrapeFrequencyHours: source.scrapeFrequencyHours,

          // Recent job info
          lastJobStatus: recentJob?.status ?? null,
          lastJobSessionsFound: recentJob?.sessionsFound ?? null,
          lastJobError: recentJob?.errorMessage ?? null,
          lastJobCompletedAt: recentJob?.completedAt ?? null,
        };
      })
    );

    // Sort by name
    sourcesWithStats.sort((a, b) => a.name.localeCompare(b.name));

    // Summary stats
    const totalSources = sources.length;
    const activeSources = sources.filter((s) => s.isActive).length;
    const totalSessions = sourcesWithStats.reduce(
      (sum, s) => sum + s.totalSessions,
      0
    );
    const sourcesWithErrors = sourcesWithStats.filter(
      (s) => s.health.consecutiveFailures > 0
    ).length;

    return {
      sources: sourcesWithStats,
      summary: {
        totalSources,
        activeSources,
        totalSessions,
        sourcesWithErrors,
      },
    };
  },
});
