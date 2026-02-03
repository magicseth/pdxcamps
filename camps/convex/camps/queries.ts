import { query } from "../_generated/server";
import { v } from "convex/values";

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
