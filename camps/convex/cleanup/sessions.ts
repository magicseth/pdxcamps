import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ============================================
// CATEGORY CLASSIFICATION
// ============================================

const VALID_CATEGORIES = [
  "Sports", "Arts", "STEM", "Nature", "Music",
  "Academic", "Drama", "Adventure", "Cooking", "Dance",
] as const;

/**
 * Apply AI-classified categories to a batch of camps.
 * Called by the categorizeCampsWithAI action after classification.
 */
export const applyCampCategories = internalMutation({
  args: {
    updates: v.array(
      v.object({
        campId: v.id("camps"),
        categories: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let updatedCamps = 0;
    let updatedSessions = 0;
    const cityIdsToRecompute = new Set<string>();

    let skippedMissing = 0;
    for (const update of args.updates) {
      const camp = await ctx.db.get(update.campId);
      if (!camp) {
        skippedMissing++;
        continue;
      }

      await ctx.db.patch(update.campId, { categories: update.categories });

      // Update denormalized campCategories on sessions
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_camp", (q) => q.eq("campId", update.campId))
        .collect();

      for (const session of sessions) {
        await ctx.db.patch(session._id, { campCategories: update.categories });
        cityIdsToRecompute.add(session.cityId);
        updatedSessions++;
      }

      updatedCamps++;
    }

    // Trigger aggregate recompute for affected cities
    const currentYear = new Date().getFullYear();
    for (const cityId of cityIdsToRecompute) {
      await ctx.scheduler.runAfter(
        0,
        internal.planner.aggregates.recomputeForCity,
        { cityId: cityId as any, year: currentYear }
      );
    }

    if (skippedMissing > 0) {
      console.log(`[ApplyCategories] ${skippedMissing} camps not found (deleted?)`);
    }
    return { updatedCamps, updatedSessions, citiesRecomputed: cityIdsToRecompute.size };
  },
});

/**
 * Get uncategorized camps (those with only "General") for AI classification.
 */
export const getUncategorizedCamps = internalMutation({
  args: {
    cityId: v.optional(v.id("cities")),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;
    const camps = await ctx.db.query("camps").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgMap = new Map(orgs.map((o) => [o._id, o.name]));

    // Optionally filter by city
    let campIdsInCity: Set<string> | null = null;
    if (args.cityId) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_city_and_status", (q) => q.eq("cityId", args.cityId!))
        .collect();
      campIdsInCity = new Set(sessions.map((s) => s.campId));
    }

    // Find camps that need categorization
    const uncategorized = camps.filter((camp) => {
      if (campIdsInCity && !campIdsInCity.has(camp._id)) return false;
      return (
        camp.categories.length === 0 ||
        (camp.categories.length === 1 && camp.categories[0] === "General") ||
        !VALID_CATEGORIES.some((vc) => camp.categories.includes(vc))
      );
    });

    const batch = uncategorized.slice(offset, offset + limit);

    return {
      total: uncategorized.length,
      offset,
      batch: batch.map((camp) => ({
        campId: camp._id,
        name: camp.name,
        orgName: orgMap.get(camp.organizationId) || "Unknown",
        description: camp.description.slice(0, 500),
        currentCategories: camp.categories,
      })),
    };
  },
});

/**
 * Find sessions with bad data
 */
export const findBadSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();

    const badSessions: Array<{
      id: string;
      campId: string;
      issues: string[];
    }> = [];

    for (const session of sessions) {
      const issues: string[] = [];

      // Check for placeholder dates
      if (session.startDate?.includes("UNKNOWN") || session.startDate?.includes("<")) {
        issues.push(`Bad startDate: ${session.startDate}`);
      }
      if (session.endDate?.includes("UNKNOWN") || session.endDate?.includes("<")) {
        issues.push(`Bad endDate: ${session.endDate}`);
      }

      // Check for invalid dates (not YYYY-MM-DD format)
      if (session.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.startDate)) {
        issues.push(`Invalid startDate format: ${session.startDate}`);
      }
      if (session.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.endDate)) {
        issues.push(`Invalid endDate format: ${session.endDate}`);
      }

      // Check for dates in the past (before 2025)
      if (session.startDate && session.startDate < "2025-01-01") {
        issues.push(`Past date: ${session.startDate}`);
      }

      // Check for missing required times
      if (session.dropOffTime?.hour === undefined) {
        issues.push("Missing dropOffTime");
      }
      if (session.pickUpTime?.hour === undefined) {
        issues.push("Missing pickUpTime");
      }

      if (issues.length > 0) {
        badSessions.push({
          id: session._id,
          campId: session.campId,
          issues,
        });
      }
    }

    return {
      totalSessions: sessions.length,
      badSessionCount: badSessions.length,
      badSessions: badSessions.slice(0, 50), // Limit output
    };
  },
});

/**
 * Delete sessions with bad data
 */
export const deleteBadSessions = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const sessions = await ctx.db.query("sessions").collect();

    let deleted = 0;
    const deletedIds: string[] = [];

    for (const session of sessions) {
      let shouldDelete = false;

      // Delete sessions with placeholder dates
      if (
        session.startDate?.includes("UNKNOWN") ||
        session.startDate?.includes("<") ||
        session.endDate?.includes("UNKNOWN") ||
        session.endDate?.includes("<")
      ) {
        shouldDelete = true;
      }

      // Delete sessions with invalid date format
      if (
        (session.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.startDate)) ||
        (session.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(session.endDate))
      ) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        if (!dryRun) {
          await ctx.db.delete(session._id);
        }
        deleted++;
        deletedIds.push(session._id);
      }
    }

    return {
      dryRun,
      deleted,
      deletedIds: deletedIds.slice(0, 50),
    };
  },
});

/**
 * Delete sessions with dates before a cutoff (old data)
 */
export const deleteOldSessions = mutation({
  args: {
    cutoffDate: v.optional(v.string()), // YYYY-MM-DD format, defaults to 2025-01-01
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const cutoff = args.cutoffDate ?? "2025-01-01";
    const sessions = await ctx.db.query("sessions").collect();

    let deleted = 0;
    const deletedIds: string[] = [];

    for (const session of sessions) {
      if (session.startDate && session.startDate < cutoff) {
        if (!dryRun) {
          await ctx.db.delete(session._id);
        }
        deleted++;
        deletedIds.push(session._id);
      }
    }

    return {
      dryRun,
      cutoffDate: cutoff,
      deleted,
      deletedIds: deletedIds.slice(0, 50),
    };
  },
});

/**
 * Trace a session back to its source data for debugging
 */
export const traceSessionSource = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { error: "Session not found" };
    }

    const camp = session.campId ? await ctx.db.get(session.campId) : null;
    const location = session.locationId ? await ctx.db.get(session.locationId) : null;
    const source = session.sourceId ? await ctx.db.get(session.sourceId) : null;
    const organization = session.organizationId ? await ctx.db.get(session.organizationId) : null;

    // Find recent jobs for this source
    const recentJobs = source
      ? await ctx.db
          .query("scrapeJobs")
          .withIndex("by_source", (q) => q.eq("sourceId", source._id))
          .order("desc")
          .take(5)
      : [];

    // Find raw data from those jobs
    const rawDataSamples: Array<{ jobId: string; preview: string }> = [];
    for (const job of recentJobs) {
      const rawData = await ctx.db
        .query("scrapeRawData")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .first();
      if (rawData) {
        rawDataSamples.push({
          jobId: job._id,
          preview: rawData.rawJson.slice(0, 500),
        });
      }
    }

    return {
      session: {
        id: session._id,
        startDate: session.startDate,
        endDate: session.endDate,
        externalRegistrationUrl: session.externalRegistrationUrl,
        status: session.status,
        createdAt: session._creationTime,
      },
      camp: camp ? {
        id: camp._id,
        name: camp.name,
        website: camp.website,
        imageUrls: camp.imageUrls,
      } : null,
      location: location ? {
        id: location._id,
        name: location.name,
        address: location.address,
      } : null,
      source: source ? {
        id: source._id,
        name: source.name,
        url: source.url,
        scraperModule: source.scraperModule,
      } : null,
      organization: organization ? {
        id: organization._id,
        name: organization.name,
        website: organization.website,
      } : null,
      recentJobs: recentJobs.map(j => ({
        id: j._id,
        status: j.status,
        sessionsFound: j.sessionsFound,
        completedAt: j.completedAt,
      })),
      rawDataSamples,
    };
  },
});

// ============================================
// SESSION DEDUPLICATION
// ============================================

/**
 * Find duplicate sessions (same camp, location, start date, end date)
 */
export const findDuplicateSessions = mutation({
  args: {
    cityId: v.optional(v.id("cities")),
  },
  handler: async (ctx, args) => {
    // Get sessions, optionally filtered by city
    let sessions;
    const cityId = args.cityId;
    if (cityId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_city_and_status", (q) => q.eq("cityId", cityId))
        .collect();
    } else {
      sessions = await ctx.db.query("sessions").collect();
    }

    // Group by deduplication key: campId + locationId + startDate + endDate
    const byKey = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = `${session.campId}|${session.locationId}|${session.startDate}|${session.endDate}`;
      const existing = byKey.get(key) || [];
      existing.push(session);
      byKey.set(key, existing);
    }

    // Find duplicates (groups with more than 1 session)
    const duplicateGroups: Array<{
      key: string;
      count: number;
      sessions: Array<{
        id: string;
        campName: string;
        startDate: string;
        endDate: string;
        price: number;
        status: string;
        completenessScore: number | undefined;
        lastScrapedAt: number | undefined;
        sourceId: string | undefined;
      }>;
    }> = [];

    for (const [key, sessionList] of byKey) {
      if (sessionList.length > 1) {
        duplicateGroups.push({
          key,
          count: sessionList.length,
          sessions: sessionList.map((s) => ({
            id: s._id,
            campName: s.campName || "Unknown",
            startDate: s.startDate,
            endDate: s.endDate,
            price: s.price,
            status: s.status,
            completenessScore: s.completenessScore,
            lastScrapedAt: s.lastScrapedAt,
            sourceId: s.sourceId,
          })),
        });
      }
    }

    // Sort by count descending
    duplicateGroups.sort((a, b) => b.count - a.count);

    const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0);

    return {
      totalSessions: sessions.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicatesToRemove: totalDuplicates,
      groups: duplicateGroups.slice(0, 50), // Return first 50 groups
    };
  },
});

/**
 * Score a session for deduplication - higher is better
 */
function scoreSession(session: {
  price: number;
  completenessScore?: number;
  lastScrapedAt?: number;
  status: string;
  externalRegistrationUrl?: string;
  description?: string;
}): number {
  let score = 0;

  // Prefer active sessions
  if (session.status === "active") score += 100;
  else if (session.status === "draft") score += 50;

  // Prefer sessions with prices
  if (session.price > 0) score += 50;

  // Prefer higher completeness
  score += (session.completenessScore || 0);

  // Prefer more recently scraped
  if (session.lastScrapedAt) {
    const ageInDays = (Date.now() - session.lastScrapedAt) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - ageInDays); // Up to 30 points for recent scrapes
  }

  // Prefer sessions with registration URLs
  if (session.externalRegistrationUrl) score += 20;

  // Prefer sessions with descriptions
  if (session.description) score += 10;

  return score;
}

/**
 * Merge duplicate sessions - keeps the best one and deletes others
 * Also reassigns registrations to the kept session
 */
export const mergeDuplicateSessions = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cityId: v.optional(v.id("cities")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const limit = args.limit ?? 1000;

    // Get sessions
    let sessions;
    const cityId = args.cityId;
    if (cityId) {
      sessions = await ctx.db
        .query("sessions")
        .withIndex("by_city_and_status", (q) => q.eq("cityId", cityId))
        .collect();
    } else {
      sessions = await ctx.db.query("sessions").collect();
    }

    // Group by deduplication key
    const byKey = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = `${session.campId}|${session.locationId}|${session.startDate}|${session.endDate}`;
      const existing = byKey.get(key) || [];
      existing.push(session);
      byKey.set(key, existing);
    }

    let mergedCount = 0;
    let deletedCount = 0;
    let registrationsReassigned = 0;
    const mergeResults: Array<{
      keptId: string;
      deletedIds: string[];
      campName: string;
    }> = [];

    for (const [, sessionList] of byKey) {
      if (sessionList.length <= 1) continue;
      if (mergedCount >= limit) break;

      // Score each session and pick the best
      const scored = sessionList.map((s) => ({
        session: s,
        score: scoreSession(s),
      }));
      scored.sort((a, b) => b.score - a.score);

      const keep = scored[0].session;
      const toDelete = scored.slice(1).map((s) => s.session);

      // Reassign registrations from deleted sessions to kept session
      for (const deleteSession of toDelete) {
        const registrations = await ctx.db
          .query("registrations")
          .withIndex("by_session", (q) => q.eq("sessionId", deleteSession._id))
          .collect();

        for (const reg of registrations) {
          // Check if this child already has a registration for the kept session
          const existingReg = await ctx.db
            .query("registrations")
            .withIndex("by_child_and_session", (q) =>
              q.eq("childId", reg.childId).eq("sessionId", keep._id)
            )
            .unique();

          if (!dryRun) {
            if (existingReg) {
              // Already registered for kept session, just delete the duplicate registration
              await ctx.db.delete(reg._id);
            } else {
              // Reassign to kept session
              await ctx.db.patch(reg._id, { sessionId: keep._id });
            }
          }
          registrationsReassigned++;
        }

        // Delete the duplicate session
        if (!dryRun) {
          await ctx.db.delete(deleteSession._id);
        }
        deletedCount++;
      }

      mergeResults.push({
        keptId: keep._id,
        deletedIds: toDelete.map((s) => s._id),
        campName: keep.campName || "Unknown",
      });
      mergedCount++;
    }

    return {
      dryRun,
      totalSessions: sessions.length,
      duplicateGroupsMerged: mergedCount,
      sessionsDeleted: deletedCount,
      registrationsReassigned,
      sampleMerges: mergeResults.slice(0, 20),
    };
  },
});

/**
 * Internal mutation for automated deduplication (called by cron)
 * Runs the merge with dryRun=false and a reasonable limit
 */
export const autoDeduplicateSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all sessions
    const sessions = await ctx.db.query("sessions").collect();

    // Group by deduplication key
    const byKey = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = `${session.campId}|${session.locationId}|${session.startDate}|${session.endDate}`;
      const existing = byKey.get(key) || [];
      existing.push(session);
      byKey.set(key, existing);
    }

    let mergedCount = 0;
    let deletedCount = 0;
    let registrationsReassigned = 0;
    const limit = 500; // Process up to 500 duplicate groups per run

    for (const [, sessionList] of byKey) {
      if (sessionList.length <= 1) continue;
      if (mergedCount >= limit) break;

      // Score each session and pick the best
      const scored = sessionList.map((s) => ({
        session: s,
        score: scoreSession(s),
      }));
      scored.sort((a, b) => b.score - a.score);

      const keep = scored[0].session;
      const toDelete = scored.slice(1).map((s) => s.session);

      // Reassign registrations from deleted sessions to kept session
      for (const deleteSession of toDelete) {
        const registrations = await ctx.db
          .query("registrations")
          .withIndex("by_session", (q) => q.eq("sessionId", deleteSession._id))
          .collect();

        for (const reg of registrations) {
          const existingReg = await ctx.db
            .query("registrations")
            .withIndex("by_child_and_session", (q) =>
              q.eq("childId", reg.childId).eq("sessionId", keep._id)
            )
            .unique();

          if (existingReg) {
            await ctx.db.delete(reg._id);
          } else {
            await ctx.db.patch(reg._id, { sessionId: keep._id });
          }
          registrationsReassigned++;
        }

        // Delete the duplicate session
        await ctx.db.delete(deleteSession._id);
        deletedCount++;
      }

      mergedCount++;
    }

    // Log results (these appear in Convex dashboard logs)
    if (deletedCount > 0) {
      console.log(`[Auto-Dedup] Merged ${mergedCount} groups, deleted ${deletedCount} sessions, reassigned ${registrationsReassigned} registrations`);
    }

    return {
      duplicateGroupsMerged: mergedCount,
      sessionsDeleted: deletedCount,
      registrationsReassigned,
    };
  },
});
