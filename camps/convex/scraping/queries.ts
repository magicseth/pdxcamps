import { query } from "../_generated/server";
import { v } from "convex/values";
import { validateSession } from "./validation";

/**
 * List scrape sources with optional filters
 */
export const listScrapeSources = query({
  args: {
    isActive: v.optional(v.boolean()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    let sources;

    if (args.organizationId !== undefined) {
      sources = await ctx.db
        .query("scrapeSources")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .collect();
    } else if (args.isActive !== undefined) {
      sources = await ctx.db
        .query("scrapeSources")
        .withIndex("by_is_active", (q) => q.eq("isActive", args.isActive!))
        .collect();
    } else {
      sources = await ctx.db.query("scrapeSources").collect();
    }

    // Apply additional filter if both provided
    if (args.organizationId !== undefined && args.isActive !== undefined) {
      sources = sources.filter((source) => source.isActive === args.isActive);
    }

    return sources;
  },
});

/**
 * Get a scrape source with health info
 */
export const getScrapeSource = query({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      return null;
    }

    // Get organization if linked
    const organization = source.organizationId
      ? await ctx.db.get(source.organizationId)
      : null;

    // Get recent job history
    const recentJobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .order("desc")
      .take(5);

    return {
      ...source,
      organization,
      recentJobs,
      // Include new fields
      parsingNotes: source.parsingNotes,
      parsingNotesUpdatedAt: source.parsingNotesUpdatedAt,
      needsRescan: source.needsRescan,
      rescanRequestedAt: source.rescanRequestedAt,
      rescanReason: source.rescanReason,
    };
  },
});

/**
 * Get sources where nextScheduledScrape is in the past (due for scraping)
 */
export const getSourcesDueForScrape = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all active sources
    const activeSources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter to those due for scraping
    const dueForScrape = activeSources.filter((source) => {
      // If never scheduled, it's due
      if (source.nextScheduledScrape === undefined) {
        return true;
      }
      // If scheduled time is in the past, it's due
      return source.nextScheduledScrape <= now;
    });

    // Sort by nextScheduledScrape (oldest first, undefined first)
    dueForScrape.sort((a, b) => {
      if (a.nextScheduledScrape === undefined) return -1;
      if (b.nextScheduledScrape === undefined) return 1;
      return a.nextScheduledScrape - b.nextScheduledScrape;
    });

    return dueForScrape;
  },
});

/**
 * List scrape job history with optional filters
 */
export const listScrapeJobs = query({
  args: {
    sourceId: v.optional(v.id("scrapeSources")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let jobsQuery;

    if (args.sourceId && args.status) {
      jobsQuery = ctx.db
        .query("scrapeJobs")
        .withIndex("by_source_and_status", (q) =>
          q.eq("sourceId", args.sourceId!).eq("status", args.status!)
        );
    } else if (args.sourceId) {
      jobsQuery = ctx.db
        .query("scrapeJobs")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId!));
    } else if (args.status) {
      jobsQuery = ctx.db
        .query("scrapeJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      jobsQuery = ctx.db.query("scrapeJobs");
    }

    const jobs = await jobsQuery.order("desc").take(limit);

    return jobs;
  },
});

/**
 * Get raw data by job ID
 */
export const getRawDataByJob = query({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args) => {
    const rawData = await ctx.db
      .query("scrapeRawData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    return rawData;
  },
});

/**
 * Get a scrape job with raw data
 */
export const getScrapeJob = query({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    // Get associated raw data
    const rawData = await ctx.db
      .query("scrapeRawData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Get the source
    const source = await ctx.db.get(job.sourceId);

    // Get changes recorded for this job
    const changes = await ctx.db
      .query("scrapeChanges")
      .filter((q) => q.eq(q.field("jobId"), args.jobId))
      .collect();

    return {
      ...job,
      source,
      rawData,
      changes,
    };
  },
});

/**
 * Get alerts that haven't been acknowledged
 */
export const listUnacknowledgedAlerts = query({
  args: {},
  handler: async (ctx) => {
    // Get alerts where acknowledgedAt is undefined
    const alerts = await ctx.db
      .query("scraperAlerts")
      .withIndex("by_unacknowledged", (q) => q.eq("acknowledgedAt", undefined))
      .order("desc")
      .collect();

    // Enrich with source info
    const enrichedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        const source = alert.sourceId
          ? await ctx.db.get(alert.sourceId)
          : null;
        return {
          ...alert,
          source,
        };
      })
    );

    return enrichedAlerts;
  },
});

/**
 * Get detailed health metrics for a scrape source
 */
export const getScraperHealth = query({
  args: {
    sourceId: v.id("scrapeSources"),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      return null;
    }

    // Get all jobs for calculating additional metrics
    const allJobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    // Calculate metrics
    const completedJobs = allJobs.filter((j) => j.status === "completed");
    const failedJobs = allJobs.filter((j) => j.status === "failed");

    // Average sessions found per successful scrape
    const avgSessionsFound =
      completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => sum + (j.sessionsFound ?? 0), 0) /
          completedJobs.length
        : 0;

    // Recent performance (last 10 jobs)
    const recentJobs = allJobs.slice(-10);
    const recentSuccessRate =
      recentJobs.length > 0
        ? recentJobs.filter((j) => j.status === "completed").length /
          recentJobs.length
        : 0;

    // Time since last successful scrape
    const timeSinceLastSuccess = source.scraperHealth.lastSuccessAt
      ? Date.now() - source.scraperHealth.lastSuccessAt
      : null;

    // Get recent alerts for this source
    const recentAlerts = await ctx.db
      .query("scraperAlerts")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .order("desc")
      .take(5);

    return {
      sourceId: args.sourceId,
      sourceName: source.name,
      isActive: source.isActive,
      health: source.scraperHealth,
      metrics: {
        totalJobs: allJobs.length,
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
        avgSessionsFound: Math.round(avgSessionsFound * 10) / 10,
        recentSuccessRate: Math.round(recentSuccessRate * 100),
        timeSinceLastSuccess,
      },
      schedule: {
        frequencyHours: source.scrapeFrequencyHours,
        lastScrapedAt: source.lastScrapedAt,
        nextScheduledScrape: source.nextScheduledScrape,
      },
      recentAlerts,
    };
  },
});

/**
 * Get sessions from a job with validation status
 * Shows what was scraped and whether each session is complete
 */
export const getJobSessions = query({
  args: {
    jobId: v.id("scrapeJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    const rawData = await ctx.db
      .query("scrapeRawData")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .first();

    if (!rawData?.rawJson) {
      return { sessions: [], parsed: false, job };
    }

    try {
      const parsed = JSON.parse(rawData.rawJson);
      const sessions = parsed.result?.sessions || [];

      // Validate each session and add status
      const validatedSessions = sessions.map(
        (session: {
          name: string;
          description?: string;
          startDate?: string;
          endDate?: string;
          dateRaw?: string;
          timeRaw?: string;
          dropOffHour?: number;
          pickUpHour?: number;
          priceInCents?: number;
          priceRaw?: string;
          minAge?: number;
          maxAge?: number;
          minGrade?: number;
          maxGrade?: number;
          ageGradeRaw?: string;
          location?: string;
          registrationUrl?: string;
          imageUrls?: string[];
          isAvailable?: boolean;
        }) => {
          const validation = validateSession(session);
          return {
            ...session,
            validation: {
              isComplete: validation.isComplete,
              completenessScore: validation.completenessScore,
              missingFields: validation.missingFields,
              errors: validation.errors,
            },
          };
        }
      );

      // Get source info
      const source = await ctx.db.get(job.sourceId);

      return {
        sessions: validatedSessions,
        parsed: true,
        job,
        source,
        organization: parsed.result?.organization,
        durationMs: parsed.result?.durationMs,
        logs: parsed.logs,
      };
    } catch (e) {
      return { sessions: [], parsed: false, job, error: String(e) };
    }
  },
});

/**
 * Get pending sessions for review
 */
export const getPendingSessions = query({
  args: {
    sourceId: v.optional(v.id("scrapeSources")),
    status: v.optional(
      v.union(
        v.literal("pending_review"),
        v.literal("manually_fixed"),
        v.literal("imported"),
        v.literal("discarded")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let pendingSessions;

    if (args.sourceId) {
      pendingSessions = await ctx.db
        .query("pendingSessions")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId!))
        .order("desc")
        .take(limit);
    } else if (args.status) {
      pendingSessions = await ctx.db
        .query("pendingSessions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    } else {
      pendingSessions = await ctx.db
        .query("pendingSessions")
        .order("desc")
        .take(limit);
    }

    // Filter by status if both sourceId and status provided
    if (args.sourceId && args.status) {
      pendingSessions = pendingSessions.filter((s) => s.status === args.status);
    }

    // Enrich with source info
    const enriched = await Promise.all(
      pendingSessions.map(async (pending) => {
        const source = await ctx.db.get(pending.sourceId);
        return {
          ...pending,
          sourceName: source?.name ?? "Unknown",
          sourceUrl: source?.url,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single pending session by ID
 */
export const getPendingSession = query({
  args: {
    pendingSessionId: v.id("pendingSessions"),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db.get(args.pendingSessionId);
    if (!pending) {
      return null;
    }

    const source = await ctx.db.get(pending.sourceId);
    const job = await ctx.db.get(pending.jobId);

    return {
      ...pending,
      source,
      job,
    };
  },
});

/**
 * Get sessions for a source with completeness info
 */
export const getSessionsBySource = query({
  args: {
    sourceId: v.id("scrapeSources"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("sold_out"),
        v.literal("cancelled"),
        v.literal("completed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .order("desc")
      .take(limit);

    // Filter by status if provided
    if (args.status) {
      sessions = sessions.filter((s) => s.status === args.status);
    }

    // Get camp names
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const camp = await ctx.db.get(session.campId);
        return {
          ...session,
          campName: camp?.name ?? session.campName ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});
