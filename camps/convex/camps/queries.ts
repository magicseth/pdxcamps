import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * List camps for admin interface with filtering
 * Optimized to batch reads and avoid N+1 queries
 */
export const listCampsForAdmin = query({
  args: {
    cityId: v.optional(v.id("cities")),
    organizationId: v.optional(v.id("organizations")),
    hasImage: v.optional(v.boolean()),
    hasAvailability: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Batch fetch all data upfront to avoid N+1 queries
    const [allCamps, allOrganizations, allSessions] = await Promise.all([
      ctx.db.query("camps").collect(),
      ctx.db.query("organizations").collect(),
      ctx.db.query("sessions").collect(),
    ]);

    // Build lookup maps
    const orgMap = new Map(allOrganizations.map((o) => [o._id, o]));

    // Group sessions by campId
    const sessionsByCamp = new Map<Id<"camps">, typeof allSessions>();
    for (const session of allSessions) {
      const existing = sessionsByCamp.get(session.campId) || [];
      existing.push(session);
      sessionsByCamp.set(session.campId, existing);
    }

    // Build set of org IDs in city if filtering by city
    let orgIdsInCity: Set<Id<"organizations">> | undefined;
    if (args.cityId) {
      orgIdsInCity = new Set(
        allOrganizations
          .filter((org) => org.cityIds.includes(args.cityId as Id<"cities">))
          .map((org) => org._id)
      );
    }

    // Filter camps
    let camps = allCamps;

    if (orgIdsInCity) {
      camps = camps.filter((camp) => orgIdsInCity!.has(camp.organizationId));
    }

    if (args.organizationId) {
      camps = camps.filter((camp) => camp.organizationId === args.organizationId);
    }

    if (args.hasImage !== undefined) {
      camps = camps.filter((camp) => {
        const hasStorageImage = camp.imageStorageIds && camp.imageStorageIds.length > 0;
        const hasExternalImage = camp.imageUrls && camp.imageUrls.length > 0;
        const hasImage = hasStorageImage || hasExternalImage;
        return args.hasImage ? hasImage : !hasImage;
      });
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      camps = camps.filter((camp) =>
        camp.name.toLowerCase().includes(searchLower) ||
        camp.description.toLowerCase().includes(searchLower)
      );
    }

    const today = new Date().toISOString().split("T")[0];

    // Enrich camps without additional queries
    const enrichedCamps = camps.map((camp) => {
      const org = orgMap.get(camp.organizationId);
      const sessions = sessionsByCamp.get(camp._id) || [];

      const activeSessions = sessions.filter(
        (s) => s.status === "active" && s.startDate >= today
      );
      const sessionsWithAvailability = sessions.filter((s) => s.capacity > 0);
      const hasAvailabilityData = sessionsWithAvailability.length > 0;

      // Use external URLs only in list view (skip storage resolution for performance)
      const hasStorageImage = camp.imageStorageIds && camp.imageStorageIds.length > 0;
      const hasExternalImage = camp.imageUrls && camp.imageUrls.length > 0;

      return {
        _id: camp._id,
        name: camp.name,
        slug: camp.slug,
        description: camp.description,
        categories: camp.categories,
        ageRequirements: camp.ageRequirements,
        isActive: camp.isActive,
        organizationId: camp.organizationId,
        organizationName: org?.name,
        organizationSlug: org?.slug,
        organizationLogoUrl: org?.logoUrl,
        // For list view, use external URL; detail view will resolve storage
        imageUrl: camp.imageUrls?.[0],
        hasStorageImage,
        hasImage: hasStorageImage || hasExternalImage,
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        sessionsWithAvailability: sessionsWithAvailability.length,
        hasAvailabilityData,
      };
    });

    // Filter by availability data if specified
    let filteredCamps = enrichedCamps;
    if (args.hasAvailability !== undefined) {
      filteredCamps = enrichedCamps.filter((c) =>
        args.hasAvailability ? c.hasAvailabilityData : !c.hasAvailabilityData
      );
    }

    // Sort by name
    filteredCamps.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate stats (from all enriched camps, not filtered)
    const stats = {
      totalCamps: enrichedCamps.length,
      campsWithImages: enrichedCamps.filter((c) => c.hasImage).length,
      campsMissingImages: enrichedCamps.filter((c) => !c.hasImage).length,
      campsWithAvailability: enrichedCamps.filter((c) => c.hasAvailabilityData).length,
      campsMissingAvailability: enrichedCamps.filter((c) => !c.hasAvailabilityData).length,
      totalSessions: enrichedCamps.reduce((sum, c) => sum + c.totalSessions, 0),
      sessionsWithAvailability: enrichedCamps.reduce((sum, c) => sum + c.sessionsWithAvailability, 0),
    };

    return { camps: filteredCamps, stats };
  },
});

/**
 * Debug query to analyze camp image data
 */
export const analyzeImageData = query({
  args: {},
  handler: async (ctx) => {
    const camps = await ctx.db.query("camps").collect();

    let withStorageIds = 0;
    let withUrls = 0;
    let withBoth = 0;
    let withNeither = 0;
    let emptyStorageArray = 0;
    const sampleMissing: { name: string; orgId: string; storageIdsLength: number; urlsLength: number }[] = [];

    for (const camp of camps) {
      const storageCount = camp.imageStorageIds?.length ?? 0;
      const urlsCount = camp.imageUrls?.length ?? 0;
      const hasStorage = storageCount > 0;
      const hasUrls = urlsCount > 0;

      if (camp.imageStorageIds && camp.imageStorageIds.length === 0) {
        emptyStorageArray++;
      }

      if (hasStorage && hasUrls) withBoth++;
      else if (hasStorage) withStorageIds++;
      else if (hasUrls) withUrls++;
      else {
        withNeither++;
        if (sampleMissing.length < 15) {
          sampleMissing.push({
            name: camp.name,
            orgId: camp.organizationId,
            storageIdsLength: storageCount,
            urlsLength: urlsCount,
          });
        }
      }
    }

    // Count by organization
    const orgs = await ctx.db.query("organizations").collect();
    const orgMap = new Map(orgs.map((o) => [o._id, o.name]));

    const missingByOrg = new Map<string, number>();
    const totalByOrg = new Map<string, number>();

    for (const camp of camps) {
      const orgName = orgMap.get(camp.organizationId) || "Unknown";
      totalByOrg.set(orgName, (totalByOrg.get(orgName) || 0) + 1);

      const hasImage = (camp.imageStorageIds?.length ?? 0) > 0 || (camp.imageUrls?.length ?? 0) > 0;
      if (!hasImage) {
        missingByOrg.set(orgName, (missingByOrg.get(orgName) || 0) + 1);
      }
    }

    // Get top orgs with missing images
    const orgStats = Array.from(missingByOrg.entries())
      .map(([name, missing]) => ({ name, missing, total: totalByOrg.get(name) || 0 }))
      .sort((a, b) => b.missing - a.missing)
      .slice(0, 15);

    // Count camps with URLs but no storage (need downloading)
    let urlsNotDownloaded = 0;
    for (const camp of camps) {
      const hasUrls = (camp.imageUrls?.length ?? 0) > 0;
      const hasStorage = (camp.imageStorageIds?.length ?? 0) > 0;
      if (hasUrls && !hasStorage) {
        urlsNotDownloaded++;
      }
    }

    return {
      total: camps.length,
      withStorageIdsOnly: withStorageIds,
      withUrlsOnly: withUrls,
      withBoth,
      withNeither,
      emptyStorageArray,
      hasAnyImage: withStorageIds + withUrls + withBoth,
      urlsNeedDownloading: urlsNotDownloaded,
      topOrgsMissingImages: orgStats,
    };
  },
});

/**
 * Get a single camp with all its sessions for admin view
 */
export const getCampWithSessions = query({
  args: {
    campId: v.id("camps"),
  },
  handler: async (ctx, args) => {
    const camp = await ctx.db.get(args.campId);
    if (!camp) return null;

    const org = await ctx.db.get(camp.organizationId);

    // Resolve image URLs
    const resolvedImageUrls: string[] = [];
    for (const storageId of camp.imageStorageIds || []) {
      const url = await ctx.storage.getUrl(storageId);
      if (url) resolvedImageUrls.push(url);
    }

    // Get org logo
    let orgLogoUrl: string | undefined;
    if (org?.logoStorageId) {
      orgLogoUrl = await ctx.storage.getUrl(org.logoStorageId) ?? undefined;
    }
    orgLogoUrl = orgLogoUrl || org?.logoUrl;

    // Get all sessions for this camp
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_camp", (q) => q.eq("campId", args.campId))
      .collect();

    // Enrich sessions with location data
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const location = await ctx.db.get(session.locationId);
        return {
          _id: session._id,
          campId: session.campId,
          campName: session.campName || camp.name,
          startDate: session.startDate,
          endDate: session.endDate,
          dropOffTime: session.dropOffTime,
          pickUpTime: session.pickUpTime,
          price: session.price,
          currency: session.currency,
          status: session.status,
          capacity: session.capacity,
          enrolledCount: session.enrolledCount,
          waitlistCount: session.waitlistCount,
          ageRequirements: session.ageRequirements,
          locationId: session.locationId,
          locationName: session.locationName || location?.name,
          locationAddress: session.locationAddress || location?.address,
          externalRegistrationUrl: session.externalRegistrationUrl,
          completenessScore: session.completenessScore,
          missingFields: session.missingFields,
        };
      })
    );

    // Sort sessions by start date
    enrichedSessions.sort((a, b) => a.startDate.localeCompare(b.startDate));

    return {
      _id: camp._id,
      name: camp.name,
      slug: camp.slug,
      description: camp.description,
      categories: camp.categories,
      ageRequirements: camp.ageRequirements,
      website: camp.website,
      isActive: camp.isActive,
      isFeatured: camp.isFeatured,
      organizationId: camp.organizationId,
      organizationName: org?.name,
      organizationSlug: org?.slug,
      organizationLogoUrl: orgLogoUrl,
      resolvedImageUrls,
      externalImageUrls: camp.imageUrls || [],
      sessions: enrichedSessions,
    };
  },
});

/**
 * List camps for an organization
 */
export const listCamps = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("camps")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

/**
 * Get a camp by ID with resolved image URLs
 */
export const getCamp = query({
  args: {
    campId: v.id("camps"),
  },
  handler: async (ctx, args) => {
    const camp = await ctx.db.get(args.campId);
    if (!camp) return null;

    // Resolve storage IDs to URLs
    const resolvedImageUrls: string[] = [];
    for (const storageId of camp.imageStorageIds || []) {
      const url = await ctx.storage.getUrl(storageId);
      if (url) resolvedImageUrls.push(url);
    }

    return {
      ...camp,
      resolvedImageUrls,
    };
  },
});

/**
 * List all camps (for admin/image processing)
 */
export const listAllCamps = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("camps").collect();
  },
});

/**
 * Get a camp by slug (for deduplication)
 */
export const getCampBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("camps")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

/**
 * Get featured camps for the landing page
 * Can filter by city for market-specific landing pages
 * Falls back to popular camps if no camps are explicitly featured
 */
export const getFeaturedCamps = query({
  args: {
    citySlug: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 6;

    // If citySlug provided, get the city and filter orgs
    let cityId: string | undefined;
    if (args.citySlug) {
      const city = await ctx.db
        .query("cities")
        .withIndex("by_slug", (q) => q.eq("slug", args.citySlug!))
        .unique();
      cityId = city?._id;
    }

    // Get organizations in this city
    let orgIdsInCity: Set<string> | undefined;
    if (cityId) {
      const orgsInCity = await ctx.db
        .query("organizations")
        .withIndex("by_is_active", (q) => q.eq("isActive", true))
        .collect();
      orgIdsInCity = new Set(
        orgsInCity.filter((org) => org.cityIds.includes(cityId as any)).map((org) => org._id)
      );
    }

    // Get featured active camps
    let allFeaturedCamps = await ctx.db
      .query("camps")
      .withIndex("by_featured", (q) => q.eq("isFeatured", true).eq("isActive", true))
      .collect();

    // Filter by city if specified
    let camps = allFeaturedCamps;
    if (orgIdsInCity) {
      camps = camps.filter((camp) => orgIdsInCity!.has(camp.organizationId));
    }

    // If no featured camps, fall back to camps with images that have sessions
    if (camps.length === 0) {
      // Get active camps with images
      const allCamps = await ctx.db
        .query("camps")
        .withIndex("by_is_active", (q) => q.eq("isActive", true))
        .take(200);

      // Filter to camps in city with images
      let candidateCamps = allCamps.filter((camp) => {
        const hasImage = (camp.imageStorageIds && camp.imageStorageIds.length > 0) ||
                         (camp.imageUrls && camp.imageUrls.length > 0);
        const inCity = !orgIdsInCity || orgIdsInCity.has(camp.organizationId);
        return hasImage && inCity;
      });

      // Get session counts for these camps to find popular ones
      const today = new Date().toISOString().split("T")[0];
      const campsWithCounts = await Promise.all(
        candidateCamps.slice(0, 50).map(async (camp) => {
          const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_camp", (q) => q.eq("campId", camp._id))
            .filter((q) => q.gte(q.field("startDate"), today))
            .take(20);
          const activeCount = sessions.filter((s) => s.status === "active").length;
          return { camp, sessionCount: activeCount };
        })
      );

      // Sort by session count and take top ones
      campsWithCounts.sort((a, b) => b.sessionCount - a.sessionCount);
      camps = campsWithCounts
        .filter((c) => c.sessionCount > 0)
        .slice(0, limit)
        .map((c) => c.camp);
    } else {
      // Limit featured results
      camps = camps.slice(0, limit);
    }

    // Enrich with organization, images, and session info
    const enrichedCamps = await Promise.all(
      camps.map(async (camp) => {
        // Get organization
        const organization = await ctx.db.get(camp.organizationId);

        // Resolve image URLs
        const resolvedImageUrls: string[] = [];
        for (const storageId of camp.imageStorageIds || []) {
          const url = await ctx.storage.getUrl(storageId);
          if (url) resolvedImageUrls.push(url);
        }

        // Get upcoming sessions for this camp
        const today = new Date().toISOString().split("T")[0];
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_camp", (q) => q.eq("campId", camp._id))
          .filter((q) => q.gte(q.field("startDate"), today))
          .take(10);

        // Calculate price range from sessions
        let minPrice: number | undefined;
        let maxPrice: number | undefined;
        let sessionCount = 0;

        for (const session of sessions) {
          if (session.status === "active") {
            sessionCount++;
            if (minPrice === undefined || session.price < minPrice) {
              minPrice = session.price;
            }
            if (maxPrice === undefined || session.price > maxPrice) {
              maxPrice = session.price;
            }
          }
        }

        return {
          _id: camp._id,
          name: camp.name,
          slug: camp.slug,
          description: camp.description,
          categories: camp.categories,
          ageRequirements: camp.ageRequirements,
          organizationName: organization?.name,
          organizationSlug: organization?.slug,
          imageUrl: resolvedImageUrls[0] || camp.imageUrls?.[0],
          priceRange:
            minPrice !== undefined
              ? { min: minPrice, max: maxPrice ?? minPrice }
              : undefined,
          upcomingSessionCount: sessionCount,
        };
      })
    );

    return enrichedCamps;
  },
});

/**
 * Full text search camps in a city
 */
export const searchCamps = query({
  args: {
    query: v.string(),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    // First, get organizations in this city
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const orgIdsInCity = organizations
      .filter((org) => org.cityIds.includes(args.cityId))
      .map((org) => org._id);

    if (orgIdsInCity.length === 0) {
      return [];
    }

    // Search camps using the search index
    const searchResults = await ctx.db
      .query("camps")
      .withSearchIndex("search_camps", (q) =>
        q.search("description", args.query).eq("isActive", true)
      )
      .collect();

    // Filter to only camps from organizations in the city
    return searchResults.filter((camp) => orgIdsInCity.includes(camp.organizationId));
  },
});
