import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const getSourceStats = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("scrapeSources").collect();
    const sfCityId = "jn7a33n684hm7fa0fezfbzb4f180kf7c";

    return {
      total: sources.length,
      active: sources.filter(s => s.isActive).length,
      withCode: sources.filter(s => s.scraperCode).length,
      sfSources: sources.filter(s => s.cityId === sfCityId).length,
      sfActive: sources.filter(s => s.cityId === sfCityId && s.isActive).length,
      sfWithCode: sources.filter(s => s.cityId === sfCityId && s.scraperCode).length,
      sampleSfSources: sources
        .filter(s => s.cityId === sfCityId)
        .slice(0, 5)
        .map(s => ({
          name: s.name,
          isActive: s.isActive,
          hasCode: !!s.scraperCode,
          url: s.url,
        })),
    };
  },
});

export const getJobStats = query({
  args: {
    cityId: v.optional(v.id("cities")),
  },
  handler: async (ctx, args) => {
    const allJobs = await ctx.db.query("scrapeJobs").collect();

    // Get source IDs for the city if specified
    let relevantSourceIds: Set<string> | null = null;
    if (args.cityId) {
      const sources = await ctx.db.query("scrapeSources")
        .filter(q => q.eq(q.field("cityId"), args.cityId))
        .collect();
      relevantSourceIds = new Set(sources.map(s => s._id));
    }

    const jobs = relevantSourceIds
      ? allJobs.filter(j => relevantSourceIds!.has(j.sourceId))
      : allJobs;

    const byStatus: Record<string, number> = {};
    for (const job of jobs) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    }

    const recentFailed = jobs
      .filter(j => j.status === "failed")
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 5)
      .map(j => ({
        id: j._id,
        sourceId: j.sourceId,
        error: j.error,
        completedAt: j.completedAt,
      }));

    const recentCompleted = jobs
      .filter(j => j.status === "completed")
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 5)
      .map(j => ({
        id: j._id,
        sessionsFound: j.sessionsFound,
        sessionsCreated: j.sessionsCreated,
        completedAt: j.completedAt,
      }));

    const pendingJobs = jobs
      .filter(j => j.status === "pending")
      .slice(0, 10)
      .map(j => ({
        id: j._id,
        sourceId: j.sourceId,
        hasWorkflowId: !!(j as Record<string, unknown>).workflowId,
        createdAt: j._creationTime,
      }));

    return {
      total: jobs.length,
      byStatus,
      recentFailed,
      recentCompleted,
      pendingJobs,
    };
  },
});
