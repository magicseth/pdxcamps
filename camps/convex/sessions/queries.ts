import { query } from "../_generated/server";
import { v } from "convex/values";
import { calculateAge, isAgeInRange, isGradeInRange } from "../lib/helpers";

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

    return sessions;
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

    // Resolve camp image URLs
    let campImageUrl: string | null = null;
    if (camp?.imageStorageIds && camp.imageStorageIds.length > 0) {
      campImageUrl = await ctx.storage.getUrl(camp.imageStorageIds[0]);
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
