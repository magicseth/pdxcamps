import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { getFamily } from "../lib/auth";
import { Doc } from "../_generated/dataModel";

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
 * Get lightweight dashboard summary (no source details)
 * Optimized for the Command Center page
 */
export const getDashboardSummary = query({
  args: {
    cityId: v.optional(v.id("cities")),
  },
  handler: async (ctx, args) => {
    // Check admin
    const isAdminUser = await checkIsAdmin(ctx);
    if (!isAdminUser) {
      return null;
    }

    // Get all scrape sources (lightweight)
    let sources = await ctx.db.query("scrapeSources").collect();

    // Filter by city if provided
    if (args.cityId) {
      const organizations = await ctx.db.query("organizations").collect();
      const orgIdsInCity = new Set(
        organizations
          .filter((org) => org.cityIds.includes(args.cityId!))
          .map((org) => org._id)
      );
      sources = sources.filter(
        (source) => source.organizationId && orgIdsInCity.has(source.organizationId)
      );
    }

    // Get pending sessions count
    const pendingSessions = await ctx.db
      .query("pendingSessions")
      .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      .collect();

    // Use denormalized counts from sources instead of loading all sessions
    const totalSources = sources.length;
    const activeSources = sources.filter((s) => s.isActive).length;
    const totalSessions = sources.reduce((sum, s) => sum + (s.sessionCount ?? 0), 0);
    const totalActiveSessions = sources.reduce((sum, s) => sum + (s.activeSessionCount ?? 0), 0);
    const sourcesWithSessions = sources.filter((s) => (s.sessionCount ?? 0) > 0).length;
    const sourcesWithoutSessions = sources.filter((s) => s.isActive && (s.sessionCount ?? 0) === 0).length;
    const sourcesWithErrors = sources.filter((s) => s.scraperHealth.consecutiveFailures >= 3).length;

    // Quality breakdown
    const highQualitySources = sources.filter((s) => s.qualityTier === "high").length;
    const mediumQualitySources = sources.filter((s) => s.qualityTier === "medium").length;
    const lowQualitySources = sources.filter((s) => s.qualityTier === "low").length;

    // Calculate success rates
    const scrapeSuccessRate =
      activeSources > 0
        ? Math.round(((activeSources - sourcesWithErrors) / activeSources) * 100)
        : 0;
    const dataSuccessRate =
      activeSources > 0
        ? Math.round((sourcesWithSessions / activeSources) * 100)
        : 0;

    return {
      summary: {
        totalSources,
        activeSources,
        sourcesWithSessions,
        sourcesWithoutSessions,
        sourcesWithErrors,
        totalSessions,
        totalActiveSessions,
        pendingReview: pendingSessions.length,
        highQualitySources,
        mediumQualitySources,
        lowQualitySources,
        scrapeSuccessRate,
        dataSuccessRate,
      },
    };
  },
});

/**
 * Get admin scraping dashboard data
 * Shows all scrape sources with stats
 * Optionally filtered by city
 */
export const getScrapingDashboard = query({
  args: {
    cityId: v.optional(v.id("cities")),
  },
  handler: async (ctx, args) => {
    // Check admin
    const isAdminUser = await checkIsAdmin(ctx);
    if (!isAdminUser) {
      return null; // Not authorized
    }

    // Get all scrape sources
    let sources = await ctx.db.query("scrapeSources").collect();

    // Filter by city if provided
    if (args.cityId) {
      // Get organizations in this city
      const organizations = await ctx.db.query("organizations").collect();
      const orgIdsInCity = new Set(
        organizations
          .filter((org) => org.cityIds.includes(args.cityId!))
          .map((org) => org._id)
      );

      // Filter sources to only those with organizations in this city
      sources = sources.filter(
        (source) => source.organizationId && orgIdsInCity.has(source.organizationId)
      );
    }

    // Get pending sessions count
    const pendingSessions = await ctx.db
      .query("pendingSessions")
      .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      .collect();

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

        // Resolve organization logo URL
        const orgLogoUrl = organization?.logoStorageId
          ? await ctx.storage.getUrl(organization.logoStorageId)
          : null;

        // Get most recent job
        const recentJob = await ctx.db
          .query("scrapeJobs")
          .withIndex("by_source", (q) => q.eq("sourceId", source._id))
          .order("desc")
          .first();

        // Count active vs total sessions
        const activeSessions = sessions.filter((s) => s.status === "active");
        const draftSessions = sessions.filter((s) => s.status === "draft");

        // Count pending sessions for this source
        const pendingForSource = pendingSessions.filter(
          (p) => p.sourceId === source._id
        ).length;

        return {
          _id: source._id,
          name: source.name,
          url: source.url,
          organizationId: source.organizationId ?? null,
          organizationName: organization?.name ?? null,
          organizationSlug: organization?.slug ?? null,
          organizationLogoUrl: orgLogoUrl,
          organizationWebsite: organization?.website ?? null,
          scraperModule: source.scraperModule,
          isActive: source.isActive,

          // Session stats (use denormalized values if available)
          totalSessions: source.sessionCount ?? sessions.length,
          activeSessions: source.activeSessionCount ?? activeSessions.length,
          draftSessions: draftSessions.length,
          pendingSessions: pendingForSource,

          // Has data indicator
          hasData: (source.sessionCount ?? sessions.length) > 0,

          // Quality info
          dataQualityScore: source.dataQualityScore,
          qualityTier: source.qualityTier,
          lastSessionsFoundAt: source.lastSessionsFoundAt,

          // Health info
          health: source.scraperHealth,
          lastScrapedAt: source.lastScrapedAt,
          nextScheduledScrape: source.nextScheduledScrape,
          scrapeFrequencyHours: source.scrapeFrequencyHours,

          // Recent job info
          lastJobId: recentJob?._id ?? null,
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
    const totalActiveSessions = sourcesWithStats.reduce(
      (sum, s) => sum + s.activeSessions,
      0
    );
    const sourcesWithSessions = sourcesWithStats.filter((s) => s.hasData).length;
    const sourcesWithoutSessions = sourcesWithStats.filter(
      (s) => s.isActive && !s.hasData
    ).length;
    const sourcesWithErrors = sourcesWithStats.filter(
      (s) => s.health.consecutiveFailures > 0
    ).length;

    // Quality breakdown
    const highQualitySources = sourcesWithStats.filter(
      (s) => s.qualityTier === "high"
    ).length;
    const mediumQualitySources = sourcesWithStats.filter(
      (s) => s.qualityTier === "medium"
    ).length;
    const lowQualitySources = sourcesWithStats.filter(
      (s) => s.qualityTier === "low"
    ).length;

    // Calculate success rates
    const scrapeSuccessRate =
      activeSources > 0
        ? Math.round(
            ((activeSources - sourcesWithErrors) / activeSources) * 100
          )
        : 0;
    const dataSuccessRate =
      activeSources > 0
        ? Math.round((sourcesWithSessions / activeSources) * 100)
        : 0;

    return {
      sources: sourcesWithStats,
      summary: {
        // Source counts
        totalSources,
        activeSources,
        sourcesWithSessions, // THE KEY METRIC
        sourcesWithoutSessions,
        sourcesWithErrors,

        // Session counts
        totalSessions,
        totalActiveSessions,
        pendingReview: pendingSessions.length,

        // Quality breakdown
        highQualitySources,
        mediumQualitySources,
        lowQualitySources,

        // Success rates
        scrapeSuccessRate,
        dataSuccessRate,
      },
    };
  },
});

/**
 * Get a single location by ID (for admin use)
 */
export const getLocationById = query({
  args: {
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    const isAdminUser = await checkIsAdmin(ctx);
    if (!isAdminUser) {
      return null;
    }

    return ctx.db.get(args.locationId);
  },
});

/**
 * Get locations that need address/coordinate fixes
 * Finds locations with placeholder data (TBD street, default coords, etc.)
 */
export const getLocationsNeedingFixes = query({
  args: {},
  handler: async (ctx) => {
    const isAdminUser = await checkIsAdmin(ctx);
    if (!isAdminUser) {
      return null;
    }

    // Get locations (limit to prevent memory issues)
    const locations = await ctx.db.query("locations").take(1000);

    // Portland city center coords (the default placeholder)
    const DEFAULT_LAT = 45.5152;
    const DEFAULT_LNG = -122.6784;
    const COORD_TOLERANCE = 0.0001; // ~10 meters

    // Identify locations needing fixes
    const locationsNeedingFixes = locations.filter((loc) => {
      // Check for placeholder street
      const hasPlaceholderStreet =
        !loc.address.street ||
        loc.address.street === "TBD" ||
        loc.address.street.trim() === "";

      // Check for default coordinates (Portland city center)
      const hasDefaultCoords =
        Math.abs(loc.latitude - DEFAULT_LAT) < COORD_TOLERANCE &&
        Math.abs(loc.longitude - DEFAULT_LNG) < COORD_TOLERANCE;

      return hasPlaceholderStreet || hasDefaultCoords;
    });

    // Get organization names for each location
    const orgIds = [...new Set(locationsNeedingFixes.map((l) => l.organizationId).filter(Boolean))];
    const orgs = await Promise.all(orgIds.map((id) => id ? ctx.db.get(id) : null));
    const orgMap = new Map(
      orgs.filter((o): o is Doc<"organizations"> => o !== null).map((o) => [o._id, o])
    );

    // Limit to first 100 locations to avoid timeout
    const limitedLocations = locationsNeedingFixes.slice(0, 100);

    // Count sessions per location (just get first few to check if it has sessions)
    const sessionCounts = new Map<string, number>();
    for (const loc of limitedLocations) {
      // Use take() instead of collect() to limit data read
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_location", (q) => q.eq("locationId", loc._id))
        .take(100);
      sessionCounts.set(loc._id, sessions.length);
    }

    // Build result with enriched data
    const result = limitedLocations.map((loc) => ({
      _id: loc._id,
      name: loc.name,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      organizationId: loc.organizationId,
      organizationName: loc.organizationId ? orgMap.get(loc.organizationId)?.name : null,
      sessionCount: sessionCounts.get(loc._id) || 0,
      issues: {
        hasPlaceholderStreet: !loc.address.street || loc.address.street === "TBD" || loc.address.street.trim() === "",
        hasDefaultCoords: Math.abs(loc.latitude - DEFAULT_LAT) < COORD_TOLERANCE && Math.abs(loc.longitude - DEFAULT_LNG) < COORD_TOLERANCE,
      },
    }));

    // Sort by session count (most sessions first - higher priority to fix)
    result.sort((a, b) => b.sessionCount - a.sessionCount);

    return {
      locations: result,
      summary: {
        total: locations.length,
        needingFixes: locationsNeedingFixes.length,
        withPlaceholderStreet: result.filter((l) => l.issues.hasPlaceholderStreet).length,
        withDefaultCoords: result.filter((l) => l.issues.hasDefaultCoords).length,
      },
    };
  },
});
