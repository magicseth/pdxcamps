/**
 * Admin migrations for data cleanup and updates
 */
import { mutation, query, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';

/**
 * Check which organizations are missing city data
 */
export const checkMissingCityData = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query('organizations').collect();
    const sources = await ctx.db.query('scrapeSources').collect();

    const orgsWithoutCity = orgs.filter((o) => !o.cityIds || o.cityIds.length === 0);

    // Find Portland city
    const portland = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', 'portland'))
      .first();

    return {
      totalOrganizations: orgs.length,
      organizationsWithoutCity: orgsWithoutCity.length,
      organizationsWithCity: orgs.length - orgsWithoutCity.length,
      totalScrapeSources: sources.length,
      portlandCity: portland ? { id: portland._id, name: portland.name } : null,
      sampleOrgsWithoutCity: orgsWithoutCity.slice(0, 5).map((o) => ({
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
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', 'portland'))
      .first();

    if (!portland) {
      throw new Error('Portland city not found. Create the Portland city first.');
    }

    // Find all organizations without city data
    const orgs = await ctx.db.query('organizations').collect();
    const orgsWithoutCity = orgs.filter((o) => !o.cityIds || o.cityIds.length === 0);

    if (dryRun) {
      return {
        dryRun: true,
        wouldUpdate: orgsWithoutCity.length,
        portlandCityId: portland._id,
        sampleOrgs: orgsWithoutCity.slice(0, 10).map((o) => o.name),
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
    const locations = await ctx.db.query('locations').collect();

    // Locations already require cityId in schema, so just count
    const cities = new Map<string, number>();
    for (const loc of locations) {
      const city = await ctx.db.get(loc.cityId);
      const cityName = city?.name || 'unknown';
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
    const sessions = await ctx.db.query('sessions').collect();

    const cities = new Map<string, number>();
    for (const session of sessions) {
      const city = await ctx.db.get(session.cityId);
      const cityName = city?.name || 'unknown';
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
    const cities = await ctx.db.query('cities').collect();
    return cities.map((c) => ({
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
    const orgs = await ctx.db.query('organizations').collect();
    const cities = await ctx.db.query('cities').collect();

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
      byCity: Object.fromEntries(Array.from(cityCounts.entries()).map(([id, data]) => [data.name, data.count])),
    };
  },
});

/**
 * Check scrapeSources missing direct cityId
 */
export const checkScrapeSourcesCityData = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query('scrapeSources').collect();

    const withCity = sources.filter((s) => s.cityId);
    const withoutCity = sources.filter((s) => !s.cityId);

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
      }),
    );

    const canDerive = derivable.filter(Boolean);
    const cannotDerive = withoutCity.filter((s) => !canDerive.some((d) => d?.sourceId === s._id));

    return {
      totalSources: sources.length,
      withDirectCityId: withCity.length,
      withoutDirectCityId: withoutCity.length,
      canDeriveFromOrg: canDerive.length,
      cannotDerive: cannotDerive.length,
      sampleCannotDerive: cannotDerive.slice(0, 5).map((s) => ({
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
    const defaultCitySlug = args.defaultCitySlug ?? 'portland';

    // Get default city
    const defaultCity = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', defaultCitySlug))
      .first();

    if (!defaultCity) {
      throw new Error(`Default city '${defaultCitySlug}' not found`);
    }

    const sources = await ctx.db.query('scrapeSources').collect();
    const sourcesWithoutCity = sources.filter((s) => !s.cityId);

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
      let derivedFrom = 'default';

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
    const requests = await ctx.db.query('scraperDevelopmentRequests').collect();

    const withCity = requests.filter((r) => r.cityId);
    const withoutCity = requests.filter((r) => !r.cityId);

    return {
      totalRequests: requests.length,
      withDirectCityId: withCity.length,
      withoutDirectCityId: withoutCity.length,
      sampleWithoutCity: withoutCity.slice(0, 5).map((r) => ({
        id: r._id,
        name: r.sourceName,
        url: r.sourceUrl,
        hasSourceId: !!r.sourceId,
      })),
    };
  },
});

/**
 * Check scrape source readiness for a city
 */
export const checkCitySourceReadiness = query({
  args: { citySlug: v.string() },
  handler: async (ctx, args) => {
    const city = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.citySlug))
      .first();
    if (!city) return { error: 'City not found' };

    const sources = await ctx.db.query('scrapeSources').collect();
    const citySources = sources.filter((s) => s.cityId === city._id);

    const withCode = citySources.filter((s) => s.scraperCode);
    const withConfig = citySources.filter((s) => s.scraperConfig);
    const withModule = citySources.filter((s) => s.scraperModule);
    const active = citySources.filter((s) => s.isActive);
    const scraped = citySources.filter((s) => s.lastScrapedAt);
    const withSessions = citySources.filter((s) => (s.sessionCount ?? 0) > 0);
    const withNextSchedule = citySources.filter((s) => s.nextScheduledScrape !== undefined);

    return {
      city: city.name,
      totalSources: citySources.length,
      active: active.length,
      withScraperCode: withCode.length,
      withScraperConfig: withConfig.length,
      withScraperModule: withModule.length,
      withNextSchedule: withNextSchedule.length,
      everScraped: scraped.length,
      withSessions: withSessions.length,
      sampleSources: citySources.filter((s) => s.isActive).slice(0, 5).map((s) => ({
        name: s.name,
        isActive: s.isActive,
        hasCode: !!s.scraperCode,
        hasConfig: !!s.scraperConfig,
        hasModule: !!s.scraperModule,
        nextSchedule: s.nextScheduledScrape ? new Date(s.nextScheduledScrape).toISOString() : null,
        lastScraped: s.lastScrapedAt ? new Date(s.lastScrapedAt).toISOString() : null,
        sessionCount: s.sessionCount ?? 0,
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
    const sources = await ctx.db.query('scrapeSources').collect();
    const cities = await ctx.db.query('cities').collect();

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
      byCity: Object.fromEntries(Array.from(cityCounts.entries()).map(([id, data]) => [data.name, data.count])),
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
    const defaultCitySlug = args.defaultCitySlug ?? 'portland';

    // Get default city
    const defaultCity = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', defaultCitySlug))
      .first();

    if (!defaultCity) {
      throw new Error(`Default city '${defaultCitySlug}' not found`);
    }

    const requests = await ctx.db.query('scraperDevelopmentRequests').collect();
    const requestsWithoutCity = requests.filter((r) => !r.cityId);

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
      let derivedFrom = 'default';

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

    const sources = await ctx.db.query('scrapeSources').collect();
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
        .query('sessions')
        .withIndex('by_source', (q) => q.eq('sourceId', source._id))
        .collect();

      const sessionCount = sessions.length;
      const activeSessionCount = sessions.filter((s) => s.status === 'active').length;

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
      sampleUpdates: updates.slice(0, 10).map((u) => ({
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
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', undefined as any))
      .collect();

    // Actually we need to check all sessions since we can't query by price
    const allSessions = await ctx.db.query('sessions').collect();

    const zeroPriceActive = allSessions.filter((s) => s.status === 'active' && s.price === 0);

    if (dryRun) {
      // Group by source for better visibility
      const bySource = new Map<string, { name: string; count: number }>();
      for (const session of zeroPriceActive) {
        if (session.sourceId) {
          const source = await ctx.db.get(session.sourceId);
          const sourceName = source?.name || 'Unknown';
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
        status: 'draft',
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
 * Fix locations that have wrong cityId based on their organization's cityIds.
 * Locations were created with Portland defaults regardless of actual city.
 */
export const fixLocationCityIds = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    const locations = await ctx.db.query('locations').collect();
    const fixes: { locationId: string; name: string; oldCityId: string; newCityId: string; orgName: string }[] = [];

    // Build org city map
    const orgs = await ctx.db.query('organizations').collect();
    const orgCityMap = new Map<string, { cityId: string; name: string }>();
    for (const org of orgs) {
      if (org.cityIds && org.cityIds.length > 0) {
        orgCityMap.set(org._id, { cityId: org.cityIds[0], name: org.name });
      }
    }

    for (const loc of locations) {
      if (!loc.organizationId) continue;
      const orgData = orgCityMap.get(loc.organizationId);
      if (!orgData) continue;

      // If the org's primary city differs from location's city, fix it
      if (loc.cityId !== orgData.cityId) {
        fixes.push({
          locationId: loc._id,
          name: loc.name,
          oldCityId: loc.cityId,
          newCityId: orgData.cityId,
          orgName: orgData.name,
        });
      }
    }

    if (dryRun) {
      const cities = await ctx.db.query('cities').collect();
      const cityNames = new Map(cities.map((c) => [c._id, c.name]));

      return {
        dryRun: true,
        totalLocations: locations.length,
        locationsNeedingFix: fixes.length,
        sampleFixes: fixes.slice(0, 10).map((f) => ({
          location: f.name,
          org: f.orgName,
          oldCity: cityNames.get(f.oldCityId as any) || f.oldCityId,
          newCity: cityNames.get(f.newCityId as any) || f.newCityId,
        })),
      };
    }

    for (const fix of fixes) {
      await ctx.db.patch(fix.locationId as any, {
        cityId: fix.newCityId as any,
      });
    }

    return {
      dryRun: false,
      totalLocations: locations.length,
      fixed: fixes.length,
    };
  },
});

/**
 * Fix locations with wrong address.city (e.g. "Portland" for Boston locations).
 * Uses the geocoded data or falls back to the city record's name/state.
 */
export const fixLocationAddressCity = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    const portlandCity = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', 'portland'))
      .first();

    const locations = await ctx.db.query('locations').collect();
    const cities = await ctx.db.query('cities').collect();
    const cityMap = new Map(cities.map((c) => [c._id, c]));

    const fixes: { id: string; name: string; oldCity: string; newCity: string }[] = [];

    for (const loc of locations) {
      // Skip Portland locations
      if (portlandCity && loc.cityId === portlandCity._id) continue;

      const addrCity = loc.address?.city;
      const addrState = loc.address?.state;

      // Check if address says Portland/OR when it shouldn't
      if (addrCity === 'Portland' || addrState === 'OR') {
        const city = cityMap.get(loc.cityId);
        if (!city) continue;

        const newCity = city.name;
        const newState = city.state ?? '';

        fixes.push({
          id: loc._id,
          name: loc.name,
          oldCity: `${addrCity}, ${addrState}`,
          newCity: `${newCity}, ${newState}`,
        });

        if (!dryRun) {
          await ctx.db.patch(loc._id, {
            address: {
              ...loc.address!,
              city: newCity,
              state: newState,
            },
          });
        }
      }
    }

    if (dryRun) {
      return {
        dryRun: true,
        totalLocations: locations.length,
        locationsNeedingFix: fixes.length,
        sampleFixes: fixes.slice(0, 10).map((f) => ({
          name: f.name,
          oldCity: f.oldCity,
          newCity: f.newCity,
        })),
      };
    }

    return { dryRun: false, fixed: fixes.length };
  },
});

/**
 * Fix locations with Portland-area coordinates that belong to a different city.
 * Resets them to their city's center coordinates so the map shows the right area.
 */
export const fixLocationCoordinates = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    // Portland center area: lat ~45.3-45.7, lng ~-122.8 to -122.5
    const PORTLAND_LAT_MIN = 45.2;
    const PORTLAND_LAT_MAX = 45.8;
    const PORTLAND_LNG_MIN = -123.0;
    const PORTLAND_LNG_MAX = -122.3;

    const portlandCity = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', 'portland'))
      .first();

    const locations = await ctx.db.query('locations').collect();
    const cities = await ctx.db.query('cities').collect();
    const cityMap = new Map(cities.map((c) => [c._id, c]));

    const fixes: { id: string; name: string; cityName: string; oldLat: number; oldLng: number; newLat: number; newLng: number }[] = [];

    for (const loc of locations) {
      // Skip Portland locations - their coords are correct
      if (portlandCity && loc.cityId === portlandCity._id) continue;

      // Check if coordinates are in Portland area
      const inPortland =
        loc.latitude >= PORTLAND_LAT_MIN && loc.latitude <= PORTLAND_LAT_MAX &&
        loc.longitude >= PORTLAND_LNG_MIN && loc.longitude <= PORTLAND_LNG_MAX;

      if (inPortland) {
        const city = cityMap.get(loc.cityId);
        if (city?.centerLatitude && city?.centerLongitude) {
          fixes.push({
            id: loc._id,
            name: loc.name,
            cityName: city.name,
            oldLat: loc.latitude,
            oldLng: loc.longitude,
            newLat: city.centerLatitude,
            newLng: city.centerLongitude,
          });
        }
      }
    }

    if (dryRun) {
      return {
        dryRun: true,
        totalLocations: locations.length,
        locationsNeedingFix: fixes.length,
        sampleFixes: fixes.slice(0, 10).map((f) => ({
          name: f.name,
          city: f.cityName,
          oldCoords: `${f.oldLat.toFixed(4)}, ${f.oldLng.toFixed(4)}`,
          newCoords: `${f.newLat.toFixed(4)}, ${f.newLng.toFixed(4)}`,
        })),
      };
    }

    for (const fix of fixes) {
      await ctx.db.patch(fix.id as any, {
        latitude: fix.newLat,
        longitude: fix.newLng,
      });
    }

    return { dryRun: false, fixed: fixes.length };
  },
});

/**
 * Unstick scrape jobs for all sources in a given city.
 * Finds all "pending" and "running" jobs, marks them as "failed",
 * and resets nextScheduledScrape so sources get picked up immediately.
 */
export const unstickSourceJobs = mutation({
  args: {
    citySlug: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const city = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.citySlug))
      .first();
    if (!city) {
      throw new Error(`City '${args.citySlug}' not found`);
    }

    // Find all sources for this city
    const allSources = await ctx.db.query('scrapeSources').collect();
    const citySources = allSources.filter((s) => s.cityId === city._id);

    const now = Date.now();
    let jobsCleaned = 0;
    let sourcesReset = 0;
    const details: { sourceName: string; jobsFixed: number }[] = [];

    for (const source of citySources) {
      // Find stuck pending jobs
      const pendingJobs = await ctx.db
        .query('scrapeJobs')
        .withIndex('by_source_and_status', (q) => q.eq('sourceId', source._id).eq('status', 'pending'))
        .collect();

      // Find stuck running jobs
      const runningJobs = await ctx.db
        .query('scrapeJobs')
        .withIndex('by_source_and_status', (q) => q.eq('sourceId', source._id).eq('status', 'running'))
        .collect();

      const stuckJobs = [...pendingJobs, ...runningJobs];
      if (stuckJobs.length === 0) continue;

      if (!dryRun) {
        for (const job of stuckJobs) {
          await ctx.db.patch(job._id, {
            status: 'failed',
            completedAt: now,
            errorMessage: 'Cleaned up stuck job (migration: unstickSourceJobs)',
          });
        }

        // Reset source so it gets picked up by the next scheduler run
        await ctx.db.patch(source._id, {
          nextScheduledScrape: now,
        });
      }

      jobsCleaned += stuckJobs.length;
      sourcesReset++;
      details.push({ sourceName: source.name, jobsFixed: stuckJobs.length });
    }

    return {
      dryRun,
      city: city.name,
      totalCitySources: citySources.length,
      sourcesWithStuckJobs: sourcesReset,
      totalJobsCleaned: jobsCleaned,
      details: details.slice(0, 20),
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
    const sources = await ctx.db.query('scrapeSources').collect();
    const sourceMap = new Map(sources.map((s) => [s._id, s.cityId]));

    // Get all sessions
    const sessions = await ctx.db.query('sessions').collect();

    const fixes: { sessionId: string; oldCityId: string; newCityId: string; sourceName: string }[] = [];

    for (const session of sessions) {
      if (!session.sourceId) continue;

      const sourceCityId = sourceMap.get(session.sourceId);
      if (!sourceCityId) continue;

      // Check if session's cityId doesn't match source's cityId
      if (session.cityId !== sourceCityId) {
        const source = sources.find((s) => s._id === session.sourceId);
        fixes.push({
          sessionId: session._id,
          oldCityId: session.cityId,
          newCityId: sourceCityId,
          sourceName: source?.name || 'Unknown',
        });
      }
    }

    if (dryRun) {
      // Get city names for better output
      const cities = await ctx.db.query('cities').collect();
      const cityNames = new Map(cities.map((c) => [c._id, c.name]));

      return {
        dryRun: true,
        totalSessions: sessions.length,
        sessionsNeedingFix: fixes.length,
        sampleFixes: fixes.slice(0, 10).map((f) => ({
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

/**
 * Clean up all zombie pending jobs (no workflow, older than threshold)
 * and create fresh jobs for all active sources that need scraping.
 */
export const cleanupZombieJobsAndKickAll = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    citySlug: v.optional(v.string()), // Optional: only kick a specific city
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    // Find all pending jobs older than 15 minutes with no workflow
    const pendingJobs = await ctx.db
      .query('scrapeJobs')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();

    const zombieJobs = pendingJobs.filter((j) => {
      const age = now - j._creationTime;
      return age > FIFTEEN_MINUTES && !(j as Record<string, unknown>).workflowId;
    });

    if (!dryRun) {
      for (const job of zombieJobs) {
        await ctx.db.patch(job._id, {
          status: 'failed',
          completedAt: now,
          errorMessage: 'Cleaned up zombie pending job (no workflow started)',
        });
      }
    }

    // Find sources to kick off
    let sources;
    if (args.citySlug) {
      const city = await ctx.db
        .query('cities')
        .withIndex('by_slug', (q) => q.eq('slug', args.citySlug!))
        .first();
      if (!city) return { dryRun, zombieJobsCleaned: zombieJobs.length, jobsCreated: 0, error: 'City not found' };
      sources = await ctx.db
        .query('scrapeSources')
        .withIndex('by_city', (q) => q.eq('cityId', city._id))
        .collect();
    } else {
      sources = await ctx.db
        .query('scrapeSources')
        .withIndex('by_is_active', (q) => q.eq('isActive', true))
        .collect();
    }

    const activeSources = sources.filter((s) => s.isActive && s.scraperCode);

    let jobsCreated = 0;
    if (!dryRun) {
      for (const source of activeSources) {
        // Check no existing pending/running job
        const existingPending = await ctx.db
          .query('scrapeJobs')
          .withIndex('by_source_and_status', (q) => q.eq('sourceId', source._id).eq('status', 'pending'))
          .first();
        const existingRunning = await ctx.db
          .query('scrapeJobs')
          .withIndex('by_source_and_status', (q) => q.eq('sourceId', source._id).eq('status', 'running'))
          .first();

        if (!existingPending && !existingRunning) {
          const jobId = await ctx.db.insert('scrapeJobs', {
            sourceId: source._id,
            status: 'pending',
            triggeredBy: 'kickoff-all',
            retryCount: 0,
          });

          const jitterMs = 100 + Math.floor(Math.random() * 4000);
          await ctx.scheduler.runAfter(jitterMs, internal.scraping.scrapeWorkflow.startWorkflowForJob, {
            jobId,
            sourceId: source._id,
          });

          jobsCreated++;
        }
      }
    }

    return {
      dryRun,
      zombieJobsCleaned: zombieJobs.length,
      activeSources: activeSources.length,
      jobsCreated,
    };
  },
});

/**
 * Diagnostic: Check global job states
 */
export const checkGlobalJobs = query({
  args: {},
  handler: async (ctx) => {
    const pendingJobs = await ctx.db
      .query('scrapeJobs')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();
    const runningJobs = await ctx.db
      .query('scrapeJobs')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();

    // Get source info for each
    const sourceCache = new Map();
    const getSource = async (id: string) => {
      if (!sourceCache.has(id)) sourceCache.set(id, await ctx.db.get(id as never));
      return sourceCache.get(id);
    };

    const pendingDetails = await Promise.all(
      pendingJobs.slice(0, 20).map(async (j) => {
        const source = await getSource(j.sourceId as string);
        return {
          jobId: j._id,
          sourceName: source?.name || 'unknown',
          cityId: source?.cityId || 'unknown',
          triggeredBy: j.triggeredBy,
          workflowId: (j as Record<string, unknown>).workflowId || null,
          createdAt: new Date(j._creationTime).toISOString(),
        };
      }),
    );

    const runningDetails = await Promise.all(
      runningJobs.slice(0, 20).map(async (j) => {
        const source = await getSource(j.sourceId as string);
        return {
          jobId: j._id,
          sourceName: source?.name || 'unknown',
          cityId: source?.cityId || 'unknown',
          triggeredBy: j.triggeredBy,
          workflowId: (j as Record<string, unknown>).workflowId || null,
          startedAt: j.startedAt ? new Date(j.startedAt).toISOString() : null,
        };
      }),
    );

    return {
      pendingCount: pendingJobs.length,
      runningCount: runningJobs.length,
      pendingDetails,
      runningDetails,
    };
  },
});

/**
 * Diagnostic: Check job states for a city
 */
export const checkCityJobs = query({
  args: { citySlug: v.string() },
  handler: async (ctx, args) => {
    const city = await ctx.db
      .query('cities')
      .withIndex('by_slug', (q) => q.eq('slug', args.citySlug))
      .first();
    if (!city) return { error: 'City not found' };

    const sources = await ctx.db
      .query('scrapeSources')
      .withIndex('by_city', (q) => q.eq('cityId', city._id))
      .collect();
    const sourceIds = new Set(sources.map((s) => s._id));

    const allJobs = await ctx.db.query('scrapeJobs').collect();
    const cityJobs = allJobs.filter((j) => sourceIds.has(j.sourceId));

    const byStatus: Record<string, number> = {};
    let withWorkflow = 0;
    let withoutWorkflow = 0;
    const sampleJobs: Array<Record<string, unknown>> = [];

    for (const job of cityJobs) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      if ((job as Record<string, unknown>).workflowId) withWorkflow++;
      else withoutWorkflow++;
      if (sampleJobs.length < 5) {
        sampleJobs.push({
          id: job._id,
          status: job.status,
          triggeredBy: job.triggeredBy,
          workflowId: (job as Record<string, unknown>).workflowId || null,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
        });
      }
    }

    // Count sessions via camps for this city's organizations
    const orgs = await ctx.db.query('organizations').collect();
    const cityOrgs = orgs.filter((o) => o.cityIds?.includes(city._id));
    const camps = await ctx.db.query('camps').collect();
    const cityCamps = camps.filter((c) => cityOrgs.some((o) => o._id === c.organizationId));
    let sessionCount = 0;
    for (const camp of cityCamps.slice(0, 50)) {
      const campSessions = await ctx.db
        .query('sessions')
        .withIndex('by_camp', (q) => q.eq('campId', camp._id))
        .take(100);
      sessionCount += campSessions.length;
    }

    return {
      city: city.name,
      totalJobs: cityJobs.length,
      byStatus,
      withWorkflow,
      withoutWorkflow,
      sampleJobs,
      cityOrgs: cityOrgs.length,
      cityCamps: cityCamps.length,
      sessionCount,
    };
  },
});
