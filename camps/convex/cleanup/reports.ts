import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Get a comprehensive data quality report
 */
export const getDataQualityReport = mutation({
  args: {},
  handler: async (ctx) => {
    const [orgs, camps, sessions, locations, sources] = await Promise.all([
      ctx.db.query("organizations").collect(),
      ctx.db.query("camps").collect(),
      ctx.db.query("sessions").collect(),
      ctx.db.query("locations").collect(),
      ctx.db.query("scrapeSources").collect(),
    ]);

    // Org issues
    const orgsWithoutLogo = orgs.filter((o) => !o.logoStorageId).length;
    const orgsWithBadWebsite = orgs.filter(
      (o) => !o.website || o.website === "<UNKNOWN>" || !o.website.startsWith("http")
    ).length;

    // Duplicate orgs
    const orgNames = orgs.map((o) => o.name);
    const duplicateOrgNames = orgNames.filter((name, i) => orgNames.indexOf(name) !== i);
    const uniqueDuplicates = [...new Set(duplicateOrgNames)];

    // Session issues
    const sessionsWithBadDates = sessions.filter(
      (s) =>
        s.startDate?.includes("UNKNOWN") ||
        s.startDate?.includes("<") ||
        s.endDate?.includes("UNKNOWN") ||
        s.endDate?.includes("<") ||
        (s.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(s.startDate))
    ).length;

    const sessionsWithPastDates = sessions.filter(
      (s) => s.startDate && s.startDate < "2025-01-01"
    ).length;

    // Location issues
    const locationsWithTBD = locations.filter(
      (l) => !l.address?.street || l.address.street === "TBD" || l.address.street === ""
    ).length;

    const locationsWithDefaultCoords = locations.filter(
      (l) =>
        Math.abs(l.latitude - 45.5152) < 0.001 && Math.abs(l.longitude - -122.6784) < 0.001
    ).length;

    // Orphan check
    const orgIds = new Set(orgs.map((o) => o._id));
    const orphanedSessions = sessions.filter((s) => !orgIds.has(s.organizationId)).length;
    const orphanedCamps = camps.filter((c) => !orgIds.has(c.organizationId)).length;

    return {
      summary: {
        organizations: orgs.length,
        camps: camps.length,
        sessions: sessions.length,
        locations: locations.length,
        scrapeSources: sources.length,
      },
      issues: {
        duplicateOrganizations: uniqueDuplicates.length,
        duplicateOrgNames: uniqueDuplicates,
        orgsWithoutLogo,
        orgsWithBadWebsite,
        sessionsWithBadDates,
        sessionsWithPastDates,
        locationsWithTBD,
        locationsWithDefaultCoords,
        orphanedSessions,
        orphanedCamps,
      },
    };
  },
});

/**
 * Get per-organization data quality report
 * Checks sessions for each org to see data completeness
 */
export const getOrganizationQualityReport = mutation({
  args: {},
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const camps = await ctx.db.query("camps").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const sources = await ctx.db.query("scrapeSources").collect();

    const orgReports: Array<{
      id: string;
      name: string;
      website: string | undefined;
      campCount: number;
      sessionCount: number;
      hasLogo: boolean;
      sourceCount: number;
      quality: {
        withDates: number;
        withPrices: number;
        withAges: number;
        withLocations: number;
        withRegistrationUrl: number;
      };
      issues: string[];
    }> = [];

    for (const org of organizations) {
      const orgCamps = camps.filter((c) => c.organizationId === org._id);
      const campIds = new Set(orgCamps.map((c) => c._id));
      const orgSessions = sessions.filter((s) => campIds.has(s.campId));
      const orgSources = sources.filter((s) => s.organizationId === org._id);

      const quality = {
        withDates: 0,
        withPrices: 0,
        withAges: 0,
        withLocations: 0,
        withRegistrationUrl: 0,
      };

      for (const session of orgSessions) {
        if (session.startDate && session.endDate) quality.withDates++;
        if (session.price && session.price > 0) quality.withPrices++;
        if (
          session.ageRequirements &&
          (session.ageRequirements.minAge ||
            session.ageRequirements.minGrade ||
            session.ageRequirements.maxAge ||
            session.ageRequirements.maxGrade)
        ) {
          quality.withAges++;
        }
        if (session.locationId) quality.withLocations++;
        if (session.externalRegistrationUrl) quality.withRegistrationUrl++;
      }

      const issues: string[] = [];
      if (orgSessions.length > 0) {
        if (quality.withDates < orgSessions.length * 0.8) issues.push("missing_dates");
        if (quality.withPrices < orgSessions.length * 0.5) issues.push("missing_prices");
        if (quality.withAges < orgSessions.length * 0.5) issues.push("missing_ages");
        if (quality.withLocations < orgSessions.length * 0.8) issues.push("missing_locations");
        if (quality.withRegistrationUrl < orgSessions.length * 0.8) issues.push("missing_registration_urls");
      }

      // Check if camps have images
      const campsWithImages = orgCamps.filter(
        (c) =>
          (c.imageUrls && c.imageUrls.length > 0) ||
          (c.imageStorageIds && c.imageStorageIds.length > 0)
      ).length;
      if (campsWithImages < orgCamps.length * 0.5 && orgCamps.length > 0) {
        issues.push("missing_images");
      }

      orgReports.push({
        id: org._id,
        name: org.name,
        website: org.website,
        campCount: orgCamps.length,
        sessionCount: orgSessions.length,
        hasLogo: !!org.logoStorageId,
        sourceCount: orgSources.length,
        quality,
        issues,
      });
    }

    // Sort by session count descending
    orgReports.sort((a, b) => b.sessionCount - a.sessionCount);

    const summary = {
      totalOrgs: organizations.length,
      orgsWithIssues: orgReports.filter((o) => o.issues.length > 0).length,
      orgsWithNoSessions: orgReports.filter((o) => o.sessionCount === 0).length,
    };

    return { summary, organizations: orgReports };
  },
});

// ============================================
// CITY / MARKET DIAGNOSTICS
// ============================================

/**
 * Get overview of all cities and their scraping status
 */
export const getCityScrapingStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const cities = await ctx.db.query("cities").collect();
    const sources = await ctx.db.query("scrapeSources").collect();
    const sessions = await ctx.db.query("sessions").collect();
    const organizations = await ctx.db.query("organizations").collect();

    const cityStats = await Promise.all(
      cities.map(async (city) => {
        const citySources = sources.filter(s => s.cityId === city._id);
        const activeSources = citySources.filter(s => s.isActive);
        const citySessions = sessions.filter(s => s.cityId === city._id);
        const activeSessions = citySessions.filter(s => s.status === "active");

        // Get unique org IDs from sources
        const orgIds = new Set(citySources.map(s => s.organizationId).filter(Boolean));

        return {
          id: city._id,
          name: city.name,
          slug: city.slug,
          state: city.state,
          totalSources: citySources.length,
          activeSources: activeSources.length,
          totalSessions: citySessions.length,
          activeSessions: activeSessions.length,
          organizations: orgIds.size,
          sourcesWithScrapers: citySources.filter(s => s.scraperModule || s.scraperCode).length,
          recentlyScraped: citySources.filter(s =>
            s.lastScrapedAt && Date.now() - s.lastScrapedAt < 7 * 24 * 60 * 60 * 1000
          ).length,
        };
      })
    );

    // Sort by session count descending
    cityStats.sort((a, b) => b.totalSessions - a.totalSessions);

    return {
      totalCities: cities.length,
      totalSources: sources.length,
      totalSessions: sessions.length,
      cities: cityStats,
    };
  },
});

/**
 * Get detailed info about a specific city's scraping setup
 */
export const getCityScrapingDetails = mutation({
  args: {
    citySlug: v.optional(v.string()),
    cityId: v.optional(v.id("cities")),
  },
  handler: async (ctx, args) => {
    let city;
    if (args.cityId) {
      city = await ctx.db.get(args.cityId);
    } else if (args.citySlug) {
      city = await ctx.db
        .query("cities")
        .withIndex("by_slug", q => q.eq("slug", args.citySlug!))
        .unique();
    }

    if (!city) {
      return { error: "City not found", availableCities: (await ctx.db.query("cities").collect()).map(c => ({ slug: c.slug, name: c.name })) };
    }

    // Get sources for this city
    const sources = await ctx.db
      .query("scrapeSources")
      .withIndex("by_city", q => q.eq("cityId", city._id))
      .collect();

    // Get sessions for this city
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status", q => q.eq("cityId", city._id))
      .collect();

    // Get recent scrape jobs
    const recentJobs = [];
    for (const source of sources.slice(0, 10)) {
      const jobs = await ctx.db
        .query("scrapeJobs")
        .withIndex("by_source", q => q.eq("sourceId", source._id))
        .order("desc")
        .take(3);
      recentJobs.push(...jobs.map(j => ({
        sourceId: source._id,
        sourceName: source.name,
        status: j.status,
        sessionsFound: j.sessionsFound,
        sessionsCreated: j.sessionsCreated,
        error: j.errorMessage || j.error,
        completedAt: j.completedAt,
      })));
    }

    // Get organizations linked to this city
    const orgIds = new Set(sources.map(s => s.organizationId).filter(Boolean));
    const orgs = await Promise.all(
      Array.from(orgIds).map(id => ctx.db.get(id as Id<"organizations">))
    );

    return {
      city: {
        id: city._id,
        name: city.name,
        slug: city.slug,
        state: city.state,
      },
      stats: {
        totalSources: sources.length,
        activeSources: sources.filter(s => s.isActive).length,
        sourcesWithScrapers: sources.filter(s => s.scraperModule || s.scraperCode).length,
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === "active").length,
        organizations: orgs.filter(Boolean).length,
      },
      sources: sources.map(s => ({
        id: s._id,
        name: s.name,
        url: s.url,
        isActive: s.isActive,
        hasScraperModule: !!s.scraperModule,
        hasScraperCode: !!s.scraperCode,
        scraperModule: s.scraperModule,
        lastScrapedAt: s.lastScrapedAt,
        lastError: s.scraperHealth?.lastError,
        consecutiveFailures: s.scraperHealth?.consecutiveFailures,
        organizationId: s.organizationId,
      })),
      recentJobs: recentJobs.slice(0, 20),
      organizations: orgs.filter(Boolean).map(o => ({
        id: o!._id,
        name: o!.name,
        website: o!.website,
      })),
    };
  },
});

// ============================================
// SCRAPER DEVELOPMENT REQUEST CLEANUP
// ============================================

/**
 * List scraper development requests by status
 */
export const listScraperDevRequests = mutation({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requests = await ctx.db.query("scraperDevelopmentRequests").collect();

    const filtered = args.status
      ? requests.filter(r => r.status === args.status)
      : requests;

    return {
      total: requests.length,
      filtered: filtered.length,
      byStatus: {
        pending: requests.filter(r => r.status === "pending").length,
        in_progress: requests.filter(r => r.status === "in_progress").length,
        testing: requests.filter(r => r.status === "testing").length,
        needs_feedback: requests.filter(r => r.status === "needs_feedback").length,
        completed: requests.filter(r => r.status === "completed").length,
        failed: requests.filter(r => r.status === "failed").length,
      },
      requests: filtered.map(r => ({
        id: r._id,
        sourceName: r.sourceName,
        sourceUrl: r.sourceUrl,
        status: r.status,
        requestedAt: r.requestedAt,
        claudeSessionId: r.claudeSessionId,
      })),
    };
  },
});

/**
 * Reset stuck scraper development requests back to pending or mark as failed
 */
export const resetScraperDevRequests = mutation({
  args: {
    requestIds: v.optional(v.array(v.id("scraperDevelopmentRequests"))),
    fromStatus: v.optional(v.string()), // Reset all requests with this status
    toStatus: v.union(
      v.literal("pending"),
      v.literal("failed"),
      v.literal("completed")
    ),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    let requests;
    if (args.requestIds && args.requestIds.length > 0) {
      requests = await Promise.all(
        args.requestIds.map(id => ctx.db.get(id))
      );
      requests = requests.filter(Boolean);
    } else if (args.fromStatus) {
      const allRequests = await ctx.db.query("scraperDevelopmentRequests").collect();
      requests = allRequests.filter(r => r.status === args.fromStatus);
    } else {
      return { error: "Must specify requestIds or fromStatus" };
    }

    const updated: Array<{ id: string; sourceName: string; oldStatus: string; newStatus: string }> = [];

    for (const request of requests) {
      if (!request) continue;

      updated.push({
        id: request._id,
        sourceName: request.sourceName,
        oldStatus: request.status,
        newStatus: args.toStatus,
      });

      if (!dryRun) {
        await ctx.db.patch(request._id, {
          status: args.toStatus,
          claudeSessionId: undefined,
          claudeSessionStartedAt: undefined,
        });
      }
    }

    return {
      dryRun,
      updatedCount: updated.length,
      updated,
    };
  },
});
