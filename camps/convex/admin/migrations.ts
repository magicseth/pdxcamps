/**
 * Admin migrations for data cleanup and updates
 */
import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Check which organizations are missing city data
 */
export const checkMissingCityData = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const sources = await ctx.db.query("scrapeSources").collect();

    const orgsWithoutCity = orgs.filter(o => !o.cityIds || o.cityIds.length === 0);

    // Find Portland city
    const portland = await ctx.db
      .query("cities")
      .withIndex("by_slug", q => q.eq("slug", "portland"))
      .first();

    return {
      totalOrganizations: orgs.length,
      organizationsWithoutCity: orgsWithoutCity.length,
      organizationsWithCity: orgs.length - orgsWithoutCity.length,
      totalScrapeSources: sources.length,
      portlandCity: portland ? { id: portland._id, name: portland.name } : null,
      sampleOrgsWithoutCity: orgsWithoutCity.slice(0, 5).map(o => ({
        id: o._id,
        name: o.name,
        cityIds: o.cityIds,
      })),
    };
  },
});

/**
 * Set Portland as the city for all organizations without city data
 */
export const populatePortlandCity = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Find Portland city
    const portland = await ctx.db
      .query("cities")
      .withIndex("by_slug", q => q.eq("slug", "portland"))
      .first();

    if (!portland) {
      throw new Error("Portland city not found. Create the Portland city first.");
    }

    // Find all organizations without city data
    const orgs = await ctx.db.query("organizations").collect();
    const orgsWithoutCity = orgs.filter(o => !o.cityIds || o.cityIds.length === 0);

    if (dryRun) {
      return {
        dryRun: true,
        wouldUpdate: orgsWithoutCity.length,
        portlandCityId: portland._id,
        sampleOrgs: orgsWithoutCity.slice(0, 10).map(o => o.name),
      };
    }

    // Update each organization
    let updated = 0;
    for (const org of orgsWithoutCity) {
      await ctx.db.patch(org._id, {
        cityIds: [portland._id],
      });
      updated++;
    }

    return {
      dryRun: false,
      updated,
      portlandCityId: portland._id,
    };
  },
});

/**
 * Ensure all locations have a cityId
 * (locations should already have cityId from the session's city)
 */
export const checkLocationCityData = query({
  args: {},
  handler: async (ctx) => {
    const locations = await ctx.db.query("locations").collect();

    // Locations already require cityId in schema, so just count
    const cities = new Map<string, number>();
    for (const loc of locations) {
      const city = await ctx.db.get(loc.cityId);
      const cityName = city?.name || "unknown";
      cities.set(cityName, (cities.get(cityName) || 0) + 1);
    }

    return {
      totalLocations: locations.length,
      byCity: Object.fromEntries(cities),
    };
  },
});

/**
 * Check sessions by city
 */
export const checkSessionCityData = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("sessions").collect();

    const cities = new Map<string, number>();
    for (const session of sessions) {
      const city = await ctx.db.get(session.cityId);
      const cityName = city?.name || "unknown";
      cities.set(cityName, (cities.get(cityName) || 0) + 1);
    }

    return {
      totalSessions: sessions.length,
      byCity: Object.fromEntries(cities),
    };
  },
});

/**
 * List all cities
 */
export const listCities = query({
  args: {},
  handler: async (ctx) => {
    const cities = await ctx.db.query("cities").collect();
    return cities.map(c => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      state: c.state,
      isActive: c.isActive,
    }));
  },
});

/**
 * Count organizations by city
 */
export const organizationsByCity = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    const cities = await ctx.db.query("cities").collect();

    const cityCounts = new Map<string, { name: string; count: number }>();

    // Initialize all cities
    for (const city of cities) {
      cityCounts.set(city._id, { name: city.name, count: 0 });
    }

    // Count orgs per city
    for (const org of orgs) {
      for (const cityId of org.cityIds || []) {
        const existing = cityCounts.get(cityId);
        if (existing) {
          existing.count++;
        }
      }
    }

    return {
      totalOrganizations: orgs.length,
      byCity: Object.fromEntries(
        Array.from(cityCounts.entries()).map(([id, data]) => [data.name, data.count])
      ),
    };
  },
});

/**
 * Check scrapeSources missing direct cityId
 */
export const checkScrapeSourcesCityData = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("scrapeSources").collect();

    const withCity = sources.filter(s => s.cityId);
    const withoutCity = sources.filter(s => !s.cityId);

    // Check which ones have organizationId we can derive from
    const derivable = await Promise.all(
      withoutCity.map(async (source) => {
        if (!source.organizationId) return null;
        const org = await ctx.db.get(source.organizationId);
        if (!org || !org.cityIds || org.cityIds.length === 0) return null;
        return {
          sourceId: source._id,
          sourceName: source.name,
          orgId: org._id,
          orgName: org.name,
          cityId: org.cityIds[0],
        };
      })
    );

    const canDerive = derivable.filter(Boolean);
    const cannotDerive = withoutCity.filter(
      s => !canDerive.some(d => d?.sourceId === s._id)
    );

    return {
      totalSources: sources.length,
      withDirectCityId: withCity.length,
      withoutDirectCityId: withoutCity.length,
      canDeriveFromOrg: canDerive.length,
      cannotDerive: cannotDerive.length,
      sampleCannotDerive: cannotDerive.slice(0, 5).map(s => ({
        id: s._id,
        name: s.name,
        url: s.url,
        hasOrg: !!s.organizationId,
      })),
    };
  },
});

/**
 * Populate cityId on scrapeSources from their organization
 */
export const populateScrapeSourcesCityId = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    defaultCitySlug: v.optional(v.string()), // For sources without org
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const defaultCitySlug = args.defaultCitySlug ?? "portland";

    // Get default city
    const defaultCity = await ctx.db
      .query("cities")
      .withIndex("by_slug", q => q.eq("slug", defaultCitySlug))
      .first();

    if (!defaultCity) {
      throw new Error(`Default city '${defaultCitySlug}' not found`);
    }

    const sources = await ctx.db.query("scrapeSources").collect();
    const sourcesWithoutCity = sources.filter(s => !s.cityId);

    const updates: Array<{
      sourceId: string;
      sourceName: string;
      cityId: string;
      cityName: string;
      derivedFrom: string;
    }> = [];

    for (const source of sourcesWithoutCity) {
      let cityId = defaultCity._id;
      let cityName = defaultCity.name;
      let derivedFrom = "default";

      if (source.organizationId) {
        const org = await ctx.db.get(source.organizationId);
        if (org && org.cityIds && org.cityIds.length > 0) {
          const city = await ctx.db.get(org.cityIds[0]);
          if (city) {
            cityId = city._id;
            cityName = city.name;
            derivedFrom = `organization: ${org.name}`;
          }
        }
      }

      updates.push({
        sourceId: source._id,
        sourceName: source.name,
        cityId,
        cityName,
        derivedFrom,
      });
    }

    if (dryRun) {
      return {
        dryRun: true,
        wouldUpdate: updates.length,
        defaultCity: defaultCity.name,
        sampleUpdates: updates.slice(0, 10),
      };
    }

    // Apply updates
    for (const update of updates) {
      await ctx.db.patch(update.sourceId as any, {
        cityId: update.cityId as any,
      });
    }

    return {
      dryRun: false,
      updated: updates.length,
      defaultCity: defaultCity.name,
    };
  },
});

/**
 * Check scraperDevelopmentRequests missing direct cityId
 */
export const checkDevRequestsCityData = query({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query("scraperDevelopmentRequests").collect();

    const withCity = requests.filter(r => r.cityId);
    const withoutCity = requests.filter(r => !r.cityId);

    return {
      totalRequests: requests.length,
      withDirectCityId: withCity.length,
      withoutDirectCityId: withoutCity.length,
      sampleWithoutCity: withoutCity.slice(0, 5).map(r => ({
        id: r._id,
        name: r.sourceName,
        url: r.sourceUrl,
        hasSourceId: !!r.sourceId,
      })),
    };
  },
});

/**
 * Count scrapeSources by city
 */
export const scrapeSourcesByCity = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query("scrapeSources").collect();
    const cities = await ctx.db.query("cities").collect();

    const cityCounts = new Map<string, { name: string; count: number }>();

    for (const city of cities) {
      cityCounts.set(city._id, { name: city.name, count: 0 });
    }

    for (const source of sources) {
      if (source.cityId) {
        const existing = cityCounts.get(source.cityId);
        if (existing) {
          existing.count++;
        }
      }
    }

    return {
      totalSources: sources.length,
      byCity: Object.fromEntries(
        Array.from(cityCounts.entries()).map(([id, data]) => [data.name, data.count])
      ),
    };
  },
});

/**
 * Populate cityId on scraperDevelopmentRequests from their source/organization
 */
export const populateDevRequestsCityId = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    defaultCitySlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const defaultCitySlug = args.defaultCitySlug ?? "portland";

    // Get default city
    const defaultCity = await ctx.db
      .query("cities")
      .withIndex("by_slug", q => q.eq("slug", defaultCitySlug))
      .first();

    if (!defaultCity) {
      throw new Error(`Default city '${defaultCitySlug}' not found`);
    }

    const requests = await ctx.db.query("scraperDevelopmentRequests").collect();
    const requestsWithoutCity = requests.filter(r => !r.cityId);

    const updates: Array<{
      requestId: string;
      requestName: string;
      cityId: string;
      cityName: string;
      derivedFrom: string;
    }> = [];

    for (const request of requestsWithoutCity) {
      let cityId = defaultCity._id;
      let cityName = defaultCity.name;
      let derivedFrom = "default";

      // Try to derive from sourceId -> organization -> city
      if (request.sourceId) {
        const source = await ctx.db.get(request.sourceId);
        if (source) {
          // First check if source has direct cityId
          if (source.cityId) {
            const city = await ctx.db.get(source.cityId);
            if (city) {
              cityId = city._id;
              cityName = city.name;
              derivedFrom = `source: ${source.name}`;
            }
          } else if (source.organizationId) {
            // Fall back to organization
            const org = await ctx.db.get(source.organizationId);
            if (org && org.cityIds && org.cityIds.length > 0) {
              const city = await ctx.db.get(org.cityIds[0]);
              if (city) {
                cityId = city._id;
                cityName = city.name;
                derivedFrom = `organization: ${org.name}`;
              }
            }
          }
        }
      }

      updates.push({
        requestId: request._id,
        requestName: request.sourceName,
        cityId,
        cityName,
        derivedFrom,
      });
    }

    if (dryRun) {
      return {
        dryRun: true,
        wouldUpdate: updates.length,
        defaultCity: defaultCity.name,
        sampleUpdates: updates.slice(0, 10),
      };
    }

    // Apply updates
    for (const update of updates) {
      await ctx.db.patch(update.requestId as any, {
        cityId: update.cityId as any,
      });
    }

    return {
      dryRun: false,
      updated: updates.length,
      defaultCity: defaultCity.name,
    };
  },
});

/**
 * Recalculate session counts for all scrapeSources
 * Fixes the denormalized sessionCount and activeSessionCount fields
 */
export const recalculateSourceSessionCounts = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const batchSize = args.batchSize ?? 10;
    const cursorIndex = args.cursor ?? 0;

    const sources = await ctx.db.query("scrapeSources").collect();
    const batch = sources.slice(cursorIndex, cursorIndex + batchSize);

    const updates: Array<{
      sourceId: string;
      sourceName: string;
      oldCount: number;
      newCount: number;
      oldActiveCount: number;
      newActiveCount: number;
    }> = [];

    for (const source of batch) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_source", (q) => q.eq("sourceId", source._id))
        .collect();

      const sessionCount = sessions.length;
      const activeSessionCount = sessions.filter(s => s.status === "active").length;

      if (sessionCount !== (source.sessionCount ?? 0) || activeSessionCount !== (source.activeSessionCount ?? 0)) {
        updates.push({
          sourceId: source._id,
          sourceName: source.name,
          oldCount: source.sessionCount ?? 0,
          newCount: sessionCount,
          oldActiveCount: source.activeSessionCount ?? 0,
          newActiveCount: activeSessionCount,
        });
      }
    }

    if (!dryRun) {
      for (const update of updates) {
        await ctx.db.patch(update.sourceId as any, {
          sessionCount: update.newCount,
          activeSessionCount: update.newActiveCount,
          lastSessionsFoundAt: update.newCount > 0 ? Date.now() : undefined,
        });
      }
    }

    const nextCursor = cursorIndex + batchSize;
    const isDone = nextCursor >= sources.length;

    return {
      dryRun,
      processed: batch.length,
      totalSources: sources.length,
      updated: updates.length,
      sampleUpdates: updates.slice(0, 10).map(u => ({
        name: u.sourceName,
        old: `${u.oldCount} (${u.oldActiveCount} active)`,
        new: `${u.newCount} (${u.newActiveCount} active)`,
      })),
      isDone,
      nextCursor: isDone ? undefined : nextCursor,
    };
  },
});

/**
 * Fix sessions with $0 price that are marked "active" - they should be "draft".
 * These sessions have broken price extraction and shouldn't show to users
 * until manually reviewed.
 */
export const fixZeroPriceSessions = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Find all active sessions with $0 price
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status", (q) => q.eq("cityId", undefined as any))
      .collect();

    // Actually we need to check all sessions since we can't query by price
    const allSessions = await ctx.db.query("sessions").collect();

    const zeroPriceActive = allSessions.filter(
      (s) => s.status === "active" && s.price === 0
    );

    if (dryRun) {
      // Group by source for better visibility
      const bySource = new Map<string, { name: string; count: number }>();
      for (const session of zeroPriceActive) {
        if (session.sourceId) {
          const source = await ctx.db.get(session.sourceId);
          const sourceName = source?.name || "Unknown";
          const existing = bySource.get(session.sourceId) || { name: sourceName, count: 0 };
          existing.count++;
          bySource.set(session.sourceId, existing);
        }
      }

      return {
        dryRun: true,
        totalSessions: allSessions.length,
        zeroPriceActiveSessions: zeroPriceActive.length,
        wouldChangeToD: zeroPriceActive.length,
        bySource: Array.from(bySource.entries())
          .map(([id, data]) => ({ sourceId: id, name: data.name, count: data.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
      };
    }

    // Apply fixes
    let fixed = 0;
    for (const session of zeroPriceActive) {
      await ctx.db.patch(session._id, {
        status: "draft",
      });
      fixed++;
    }

    return {
      dryRun: false,
      totalSessions: allSessions.length,
      fixed,
    };
  },
});

/**
 * Fix sessions that have wrong cityId based on their source's cityId.
 * This fixes Boston sessions that were incorrectly assigned Portland's cityId.
 */
export const fixSessionCityIds = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Get all sources with their cityId
    const sources = await ctx.db.query("scrapeSources").collect();
    const sourceMap = new Map(sources.map(s => [s._id, s.cityId]));

    // Get all sessions
    const sessions = await ctx.db.query("sessions").collect();

    const fixes: { sessionId: string; oldCityId: string; newCityId: string; sourceName: string }[] = [];

    for (const session of sessions) {
      if (!session.sourceId) continue;

      const sourceCityId = sourceMap.get(session.sourceId);
      if (!sourceCityId) continue;

      // Check if session's cityId doesn't match source's cityId
      if (session.cityId !== sourceCityId) {
        const source = sources.find(s => s._id === session.sourceId);
        fixes.push({
          sessionId: session._id,
          oldCityId: session.cityId,
          newCityId: sourceCityId,
          sourceName: source?.name || "Unknown",
        });
      }
    }

    if (dryRun) {
      // Get city names for better output
      const cities = await ctx.db.query("cities").collect();
      const cityNames = new Map(cities.map(c => [c._id, c.name]));

      return {
        dryRun: true,
        totalSessions: sessions.length,
        sessionsNeedingFix: fixes.length,
        sampleFixes: fixes.slice(0, 10).map(f => ({
          oldCity: cityNames.get(f.oldCityId as any) || f.oldCityId,
          newCity: cityNames.get(f.newCityId as any) || f.newCityId,
          source: f.sourceName,
        })),
      };
    }

    // Apply fixes
    for (const fix of fixes) {
      await ctx.db.patch(fix.sessionId as any, {
        cityId: fix.newCityId as any,
      });
    }

    return {
      dryRun: false,
      totalSessions: sessions.length,
      fixed: fixes.length,
    };
  },
});
