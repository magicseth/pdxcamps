import { query } from '../_generated/server';
import { v } from 'convex/values';
import { isAgeInRange } from '../lib/helpers';

/**
 * Query sessions for SEO landing pages.
 * Returns enriched session data with camp, org, and location info.
 * Designed for server-side rendering (fetchQuery) -- no auth required.
 */
export const getSessionsForSeoPage = query({
  args: {
    cityId: v.id('cities'),
    // Filter options -- only one should be set per call
    category: v.optional(v.string()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    maxPriceCents: v.optional(v.number()),
    isFree: v.optional(v.boolean()),
    timeOfDay: v.optional(v.union(v.literal('morning'), v.literal('afternoon'), v.literal('fullday'))),
    startsWithinDays: v.optional(v.number()),
    extendedCare: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 200);

    // Fetch active sessions in the city
    let sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .collect();

    // Filter to future sessions only
    const today = new Date().toISOString().split('T')[0];
    sessions = sessions.filter((s) => s.startDate >= today);

    // Apply age filter
    if (args.minAge !== undefined || args.maxAge !== undefined) {
      sessions = sessions.filter((session) => {
        if (args.minAge !== undefined && args.maxAge !== undefined) {
          // Check if any age in range fits
          for (let age = args.minAge; age <= args.maxAge; age++) {
            if (isAgeInRange(age, session.ageRequirements)) return true;
          }
          return false;
        }
        if (args.minAge !== undefined) {
          return isAgeInRange(args.minAge, session.ageRequirements);
        }
        if (args.maxAge !== undefined) {
          return isAgeInRange(args.maxAge, session.ageRequirements);
        }
        return true;
      });
    }

    // Apply price filter
    if (args.isFree) {
      sessions = sessions.filter((s) => s.price === 0);
    } else if (args.maxPriceCents !== undefined) {
      sessions = sessions.filter((s) => s.price <= args.maxPriceCents!);
    }

    // Apply time-of-day filter
    if (args.timeOfDay) {
      sessions = sessions.filter((session) => {
        const dropHour = session.dropOffTime.hour;
        const pickHour = session.pickUpTime.hour;
        const durationHours = pickHour - dropHour;

        switch (args.timeOfDay) {
          case 'morning':
            // Ends by 1pm and less than 5 hours
            return pickHour <= 13 && durationHours < 5;
          case 'afternoon':
            // Starts at noon or later
            return dropHour >= 12;
          case 'fullday':
            // 5+ hours
            return durationHours >= 5;
        }
      });
    }

    // Apply startsWithinDays filter
    if (args.startsWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + args.startsWithinDays);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      sessions = sessions.filter((s) => s.startDate >= today && s.startDate <= futureDateStr);
      // Also filter to only sessions with available spots
      sessions = sessions.filter((s) => s.enrolledCount < s.capacity);
    }

    // Apply extended care filter
    if (args.extendedCare) {
      sessions = sessions.filter((s) => s.extendedCareAvailable);
    }

    // Apply category filter (requires camp lookup)
    if (args.category) {
      const campIds = [...new Set(sessions.map((s) => s.campId))];
      const camps = await Promise.all(campIds.map((id) => ctx.db.get(id)));
      const campMap = new Map(camps.filter(Boolean).map((c) => [c!._id, c!]));

      sessions = sessions.filter((session) => {
        const camp = campMap.get(session.campId);
        return camp?.categories.includes(args.category!) ?? false;
      });
    }

    // Get total count before pagination
    const totalCount = sessions.length;

    // Sort by start date, then take limit
    sessions.sort((a, b) => a.startDate.localeCompare(b.startDate));
    sessions = sessions.slice(0, limit);

    // Batch-fetch related data
    const campIds = [...new Set(sessions.map((s) => s.campId))];
    const locationIds = [...new Set(sessions.map((s) => s.locationId))];
    const orgIds = [...new Set(sessions.map((s) => s.organizationId))];

    const [campsRaw, locationsRaw, orgsRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(orgIds.map((id) => ctx.db.get(id))),
    ]);

    const campMap = new Map(campsRaw.filter(Boolean).map((c) => [c!._id, c!]));
    const locationMap = new Map(locationsRaw.filter(Boolean).map((l) => [l!._id, l!]));
    const orgMap = new Map(orgsRaw.filter(Boolean).map((o) => [o!._id, o!]));

    // Resolve camp image URLs
    const storageRequests: Array<{ campId: string; storageId: string }> = [];
    for (const camp of campMap.values()) {
      if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
        storageRequests.push({ campId: camp._id, storageId: camp.imageStorageIds[0] as string });
      }
    }
    const imageUrls = await Promise.all(
      storageRequests.map(async (req) => ({
        campId: req.campId,
        url: await ctx.storage.getUrl(req.storageId as any),
      })),
    );
    const campImageMap = new Map(imageUrls.filter((r) => r.url).map((r) => [r.campId, r.url!]));

    // Resolve org logo URLs
    const logoRequests: Array<{ orgId: string; storageId: string }> = [];
    for (const org of orgMap.values()) {
      if (org.logoStorageId) {
        logoRequests.push({ orgId: org._id, storageId: org.logoStorageId as string });
      }
    }
    const logoUrls = await Promise.all(
      logoRequests.map(async (req) => ({
        orgId: req.orgId,
        url: await ctx.storage.getUrl(req.storageId as any),
      })),
    );
    const orgLogoMap = new Map(logoUrls.filter((r) => r.url).map((r) => [r.orgId, r.url!]));

    // Build enriched results
    const enriched = sessions.map((session) => {
      const camp = campMap.get(session.campId);
      const location = locationMap.get(session.locationId);
      const org = orgMap.get(session.organizationId);

      let imageUrl = campImageMap.get(session.campId);
      if (!imageUrl && camp?.imageUrls && camp.imageUrls.length > 0) {
        imageUrl = camp.imageUrls[0];
      }

      return {
        _id: session._id,
        campId: session.campId,
        campName: session.campName ?? camp?.name ?? 'Camp',
        campSlug: camp?.slug ?? '',
        campDescription: camp?.description ?? '',
        categories: camp?.categories ?? [],
        organizationId: session.organizationId,
        organizationName: session.organizationName ?? org?.name ?? '',
        organizationSlug: org?.slug ?? '',
        organizationLogoUrl: orgLogoMap.get(session.organizationId) ?? org?.logoUrl,
        locationName: session.locationName ?? location?.name ?? '',
        locationCity: location?.address?.city,
        locationState: location?.address?.state,
        imageUrl,
        startDate: session.startDate,
        endDate: session.endDate,
        dropOffTime: session.dropOffTime,
        pickUpTime: session.pickUpTime,
        isOvernight: session.isOvernight,
        extendedCareAvailable: session.extendedCareAvailable,
        price: session.price,
        currency: session.currency,
        capacity: session.capacity,
        enrolledCount: session.enrolledCount,
        ageRequirements: session.ageRequirements,
        externalRegistrationUrl: session.externalRegistrationUrl,
        status: session.status,
      };
    });

    // Compute aggregate stats for page content
    const prices = enriched.map((s) => s.price).filter((p) => p > 0);
    const orgSet = new Set(enriched.map((s) => s.organizationId));

    return {
      sessions: enriched,
      totalCount,
      stats: {
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
        organizationCount: orgSet.size,
        availableCount: enriched.filter((s) => s.enrolledCount < s.capacity).length,
      },
    };
  },
});

/**
 * Get sessions for a specific neighborhood.
 * Finds all locations in the neighborhood, then all sessions at those locations.
 */
export const getSessionsForNeighborhood = query({
  args: {
    cityId: v.id('cities'),
    neighborhoodId: v.id('neighborhoods'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 200);

    // Find locations in this neighborhood
    const locations = await ctx.db
      .query('locations')
      .withIndex('by_city_and_active', (q) => q.eq('cityId', args.cityId).eq('isActive', true))
      .collect();
    const neighborhoodLocationIds = new Set(
      locations.filter((l) => l.neighborhoodId === args.neighborhoodId).map((l) => l._id),
    );

    if (neighborhoodLocationIds.size === 0) {
      return { sessions: [], totalCount: 0, stats: { minPrice: 0, maxPrice: 0, avgPrice: 0, organizationCount: 0, availableCount: 0 } };
    }

    // Fetch active sessions in this city
    let sessions = await ctx.db
      .query('sessions')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'active'))
      .collect();

    // Filter to future sessions at neighborhood locations
    const today = new Date().toISOString().split('T')[0];
    sessions = sessions.filter((s) => s.startDate >= today && neighborhoodLocationIds.has(s.locationId));

    const totalCount = sessions.length;
    sessions.sort((a, b) => a.startDate.localeCompare(b.startDate));
    sessions = sessions.slice(0, limit);

    // Batch-fetch related data
    const campIds = [...new Set(sessions.map((s) => s.campId))];
    const locationIds = [...new Set(sessions.map((s) => s.locationId))];
    const orgIds = [...new Set(sessions.map((s) => s.organizationId))];

    const [campsRaw, locationsRaw, orgsRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(orgIds.map((id) => ctx.db.get(id))),
    ]);

    const campMap = new Map(campsRaw.filter(Boolean).map((c) => [c!._id, c!]));
    const locationMap = new Map(locationsRaw.filter(Boolean).map((l) => [l!._id, l!]));
    const orgMap = new Map(orgsRaw.filter(Boolean).map((o) => [o!._id, o!]));

    // Resolve camp image URLs
    const storageRequests: Array<{ campId: string; storageId: string }> = [];
    for (const camp of campMap.values()) {
      if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
        storageRequests.push({ campId: camp._id, storageId: camp.imageStorageIds[0] as string });
      }
    }
    const imageUrls = await Promise.all(
      storageRequests.map(async (req) => ({
        campId: req.campId,
        url: await ctx.storage.getUrl(req.storageId as any),
      })),
    );
    const campImageMap = new Map(imageUrls.filter((r) => r.url).map((r) => [r.campId, r.url!]));

    const enriched = sessions.map((session) => {
      const camp = campMap.get(session.campId);
      const location = locationMap.get(session.locationId);
      const org = orgMap.get(session.organizationId);

      let imageUrl = campImageMap.get(session.campId);
      if (!imageUrl && camp?.imageUrls && camp.imageUrls.length > 0) {
        imageUrl = camp.imageUrls[0];
      }

      return {
        _id: session._id,
        campId: session.campId,
        campName: session.campName ?? camp?.name ?? 'Camp',
        campSlug: camp?.slug ?? '',
        campDescription: camp?.description ?? '',
        categories: camp?.categories ?? [],
        organizationId: session.organizationId,
        organizationName: session.organizationName ?? org?.name ?? '',
        organizationSlug: org?.slug ?? '',
        locationName: session.locationName ?? location?.name ?? '',
        locationCity: location?.address?.city,
        locationState: location?.address?.state,
        imageUrl,
        startDate: session.startDate,
        endDate: session.endDate,
        dropOffTime: session.dropOffTime,
        pickUpTime: session.pickUpTime,
        isOvernight: session.isOvernight,
        extendedCareAvailable: session.extendedCareAvailable,
        price: session.price,
        currency: session.currency,
        capacity: session.capacity,
        enrolledCount: session.enrolledCount,
        ageRequirements: session.ageRequirements,
        externalRegistrationUrl: session.externalRegistrationUrl,
        status: session.status,
      };
    });

    const prices = enriched.map((s) => s.price).filter((p) => p > 0);
    const orgSet = new Set(enriched.map((s) => s.organizationId));

    return {
      sessions: enriched,
      totalCount,
      stats: {
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        avgPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
        organizationCount: orgSet.size,
        availableCount: enriched.filter((s) => s.enrolledCount < s.capacity).length,
      },
    };
  },
});
