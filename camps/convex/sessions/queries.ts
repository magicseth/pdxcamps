import { query } from "../_generated/server";
import { v } from "convex/values";
import { calculateDistance, isAgeInRange, isGradeInRange } from "../lib/helpers";

/**
 * Main discovery query for searching sessions
 */
export const searchSessions = query({
  args: {
    cityId: v.id("cities"),
    startDateAfter: v.optional(v.string()),
    startDateBefore: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    maxPrice: v.optional(v.number()),
    excludeSoldOut: v.optional(v.boolean()),
    childAge: v.optional(v.number()),
    childGrade: v.optional(v.number()),
    locationIds: v.optional(v.array(v.id("locations"))),
    organizationIds: v.optional(v.array(v.id("organizations"))),
    extendedCareOnly: v.optional(v.boolean()),
    // Distance filtering
    homeLatitude: v.optional(v.number()),
    homeLongitude: v.optional(v.number()),
    maxDistanceMiles: v.optional(v.number()),
    // Pagination
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Start with sessions in the city that are active
    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status", (q) =>
        q.eq("cityId", args.cityId).eq("status", "active")
      )
      .collect();

    // Apply date range filters
    if (args.startDateAfter) {
      sessions = sessions.filter((session) => session.startDate >= args.startDateAfter!);
    }
    if (args.startDateBefore) {
      sessions = sessions.filter((session) => session.startDate <= args.startDateBefore!);
    }

    // Apply price filter
    if (args.maxPrice !== undefined) {
      sessions = sessions.filter((session) => session.price <= args.maxPrice!);
    }

    // Exclude sold out sessions if requested
    if (args.excludeSoldOut) {
      sessions = sessions.filter(
        (session) => session.enrolledCount < session.capacity
      );
    }

    // Apply location filter
    if (args.locationIds && args.locationIds.length > 0) {
      const locationIdSet = new Set(args.locationIds);
      sessions = sessions.filter((session) => locationIdSet.has(session.locationId));
    }

    // Apply organization filter
    if (args.organizationIds && args.organizationIds.length > 0) {
      const orgIdSet = new Set(args.organizationIds);
      sessions = sessions.filter((session) => orgIdSet.has(session.organizationId));
    }

    // Apply extended care filter
    if (args.extendedCareOnly) {
      sessions = sessions.filter((session) => session.extendedCareAvailable);
    }

    // Apply age/grade filters
    if (args.childAge !== undefined) {
      sessions = sessions.filter((session) =>
        isAgeInRange(args.childAge!, session.ageRequirements)
      );
    }
    if (args.childGrade !== undefined) {
      sessions = sessions.filter((session) =>
        isGradeInRange(args.childGrade!, session.ageRequirements)
      );
    }

    // Apply category filter - requires fetching camps
    if (args.categories && args.categories.length > 0) {
      const campIds = [...new Set(sessions.map((s) => s.campId))];
      const camps = await Promise.all(campIds.map((id) => ctx.db.get(id)));
      const campMap = new Map(camps.filter(Boolean).map((camp) => [camp!._id, camp!]));

      sessions = sessions.filter((session) => {
        const camp = campMap.get(session.campId);
        if (!camp) return false;
        return args.categories!.some((cat) => camp.categories.includes(cat));
      });
    }

    // Fetch all locations for sessions (needed for map display and distance)
    const locationIds = [...new Set(sessions.map((s) => s.locationId))];
    const locations = await Promise.all(locationIds.map((id) => ctx.db.get(id)));
    const locationMap = new Map(locations.filter(Boolean).map((loc) => [loc!._id, loc!]));

    // Fetch organizations for sessions missing organizationName (backfill for older sessions)
    const sessionsNeedingOrgName = sessions.filter((s) => !s.organizationName);
    const orgIdsToFetch = [...new Set(sessionsNeedingOrgName.map((s) => s.organizationId))];
    const orgs = await Promise.all(orgIdsToFetch.map((id) => ctx.db.get(id)));
    const orgMap = new Map(orgs.filter(Boolean).map((org) => [org!._id, org!]));

    // Calculate distance if home coordinates provided
    const hasHomeCoords = args.homeLatitude !== undefined && args.homeLongitude !== undefined;

    // Add location coordinates and distance to each session
    type SessionWithLocationAndDistance = typeof sessions[number] & {
      distanceFromHome?: number;
      locationLatitude?: number;
      locationLongitude?: number;
    };

    let enrichedSessions: SessionWithLocationAndDistance[] = sessions.map((session) => {
      const location = locationMap.get(session.locationId);

      // Backfill organizationName if missing
      let organizationName = session.organizationName;
      if (!organizationName) {
        const org = orgMap.get(session.organizationId);
        organizationName = org?.name;
      }

      const result: SessionWithLocationAndDistance = {
        ...session,
        organizationName,
        locationLatitude: location?.latitude,
        locationLongitude: location?.longitude,
      };

      if (hasHomeCoords && location) {
        const distance = calculateDistance(
          args.homeLatitude!,
          args.homeLongitude!,
          location.latitude,
          location.longitude
        );
        result.distanceFromHome = Math.round(distance * 10) / 10;
      }

      return result;
    });

    // Apply distance filter if specified
    if (hasHomeCoords && args.maxDistanceMiles !== undefined) {
      enrichedSessions = enrichedSessions.filter(
        (session) => session.distanceFromHome !== undefined && session.distanceFromHome <= args.maxDistanceMiles!
      );
    }

    // Get total count before pagination
    const totalCount = enrichedSessions.length;

    // Apply limit (client handles progressive loading)
    const limit = Math.min(args.limit ?? 100, 1000); // Cap at 1000 to stay well under Convex limits
    const paginatedSessions = enrichedSessions.slice(0, limit);

    return {
      sessions: paginatedSessions,
      totalCount,
      hasMore: limit < totalCount,
    };
  },
});

/**
 * Get session with camp, location, and organization details
 */
export const getSession = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    // Fetch related entities
    const [camp, location, organization] = await Promise.all([
      ctx.db.get(session.campId),
      ctx.db.get(session.locationId),
      ctx.db.get(session.organizationId),
    ]);

    // Resolve camp image URLs — prefer stored images, fall back to source URLs
    let campImageUrl: string | null = null;
    if (camp?.imageStorageIds && camp.imageStorageIds.length > 0) {
      campImageUrl = await ctx.storage.getUrl(camp.imageStorageIds[0]);
    } else if (camp?.imageUrls && camp.imageUrls.length > 0) {
      campImageUrl = camp.imageUrls[0];
    }

    // Resolve organization logo URL
    let orgLogoUrl: string | null = null;
    if (organization?.logoStorageId) {
      orgLogoUrl = await ctx.storage.getUrl(organization.logoStorageId);
    }

    return {
      ...session,
      camp: camp ? { ...camp, resolvedImageUrl: campImageUrl } : null,
      location,
      organization: organization ? { ...organization, resolvedLogoUrl: orgLogoUrl } : null,
    };
  },
});

/**
 * List sessions for a specific camp
 */
export const listSessionsByCamp = query({
  args: {
    campId: v.id("camps"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_camp", (q) => q.eq("campId", args.campId))
      .collect();
  },
});

/**
 * Get upcoming sessions in a city
 */
export const listUpcomingSessions = query({
  args: {
    cityId: v.id("cities"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const limit = args.limit ?? 20;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status_and_start_date", (q) =>
        q.eq("cityId", args.cityId).eq("status", "active").gte("startDate", today)
      )
      .take(limit);

    return sessions;
  },
});

/**
 * Get featured sessions for landing page showcase
 * Returns enriched session data with camp name, image, organization, location
 */
export const getFeaturedSessions = query({
  args: {
    citySlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Get city by slug
    const city = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.citySlug))
      .unique();

    if (!city) return [];

    const today = new Date().toISOString().split("T")[0];

    // Get all active sessions in the city (not ordered by date)
    // This ensures we sample from the full date range, not just the nearest dates
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status", (q) =>
        q.eq("cityId", city._id).eq("status", "active")
      )
      .collect();

    // Filter to future sessions with prices
    const sessionsWithPrices = allSessions.filter(
      (s) => s.price > 0 && s.startDate >= today
    );

    // Shuffle sessions for variety in the carousel
    // Use a simple Fisher-Yates shuffle with a daily seed so the order changes each day
    const shuffled = [...sessionsWithPrices];
    let seed = today.split("-").reduce((acc, n) => acc + parseInt(n), 0);
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Take a variety - spread across different camps/orgs
    const selectedSessions: typeof sessionsWithPrices = [];
    const seenCamps = new Set<string>();
    const seenOrgs = new Set<string>();

    for (const session of shuffled) {
      if (selectedSessions.length >= limit) break;
      // Prioritize variety: prefer sessions from unseen camps AND orgs
      const campSeen = seenCamps.has(session.campId);
      const orgSeen = seenOrgs.has(session.organizationId);

      // Allow if: new camp, or we haven't filled half yet, or new org
      if (!campSeen || selectedSessions.length < limit / 3 || !orgSeen) {
        selectedSessions.push(session);
        seenCamps.add(session.campId);
        seenOrgs.add(session.organizationId);
      }
    }

    // Batch fetch all related data upfront for efficiency
    const campIds = [...new Set(selectedSessions.map((s) => s.campId))];
    const locationIds = [...new Set(selectedSessions.map((s) => s.locationId))];

    // Fetch camps and locations in parallel
    const [campsRaw, locationsRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
    ]);

    const campMap = new Map(campsRaw.filter(Boolean).map((c) => [c!._id, c!]));
    const locationMap = new Map(locationsRaw.filter(Boolean).map((l) => [l!._id, l!]));

    // Get organization IDs from camps and fetch them
    const orgIds = [...new Set([...campMap.values()].map((c) => c.organizationId))];
    const orgsRaw = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgMap = new Map(orgsRaw.filter(Boolean).map((o) => [o!._id, o!]));

    // Collect all storage IDs that need URL resolution
    const storageIds: Array<{ type: "camp" | "org"; id: string; storageId: string }> = [];
    for (const camp of campMap.values()) {
      if (camp.imageStorageIds && camp.imageStorageIds.length > 0) {
        storageIds.push({ type: "camp", id: camp._id, storageId: camp.imageStorageIds[0] });
      }
    }
    for (const org of orgMap.values()) {
      if (org.logoStorageId) {
        storageIds.push({ type: "org", id: org._id, storageId: org.logoStorageId });
      }
    }

    // Batch resolve storage URLs
    const urlResults = await Promise.all(
      storageIds.map(async (item) => ({
        ...item,
        url: await ctx.storage.getUrl(item.storageId as any),
      }))
    );

    const campImageUrls = new Map<string, string>();
    const orgLogoUrls = new Map<string, string>();
    for (const result of urlResults) {
      if (result.url) {
        if (result.type === "camp") {
          campImageUrls.set(result.id, result.url);
        } else {
          orgLogoUrls.set(result.id, result.url);
        }
      }
    }

    // Build enriched sessions using the pre-fetched maps
    const enrichedSessions = selectedSessions.map((session) => {
      const camp = campMap.get(session.campId);
      if (!camp) return null;

      const organization = orgMap.get(camp.organizationId);
      const location = locationMap.get(session.locationId);

      // Get image URL from pre-resolved map or fallback to URL
      let imageUrl = campImageUrls.get(camp._id);
      if (!imageUrl && camp.imageUrls && camp.imageUrls.length > 0) {
        imageUrl = camp.imageUrls[0];
      }

      return {
        _id: session._id,
        campName: camp.name,
        campSlug: camp.slug,
        organizationName: organization?.name,
        organizationLogoUrl: orgLogoUrls.get(organization?._id ?? ""),
        imageUrl,
        startDate: session.startDate,
        endDate: session.endDate,
        price: session.price,
        locationName: location?.name,
        ageRequirements: session.ageRequirements || camp.ageRequirements,
        categories: camp.categories,
        spotsLeft: session.capacity - session.enrolledCount,
        isSoldOut: session.enrolledCount >= session.capacity,
      };
    });

    return enrichedSessions.filter((s): s is NonNullable<typeof s> => s !== null);
  },
});
