import { query } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import {
  generateSummerWeeks,
  doDateRangesOverlap,
  countOverlappingWeekdays,
} from "../lib/helpers";

/**
 * Get a family's shared summer plan by share token (public - no auth required)
 * Returns preview data for all shared children - stats and coverage status
 * but hides specific camp names to encourage sign-up
 */
export const getFamilySharedPlan = query({
  args: {
    shareToken: v.string(),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const year = args.year ?? new Date().getFullYear();

    // Find family share by token
    const familyShare = await ctx.db
      .query("familyShares")
      .withIndex("by_token", (q) => q.eq("shareToken", args.shareToken))
      .first();

    if (!familyShare) {
      return null;
    }

    // Get family info
    const family = await ctx.db.get(familyShare.familyId);
    if (!family) {
      return null;
    }

    // Get all shared children
    const childrenRaw = await Promise.all(
      familyShare.childIds.map((id) => ctx.db.get(id))
    );
    const children = childrenRaw.filter(
      (c): c is Doc<"children"> => c !== null && c.isActive
    );

    if (children.length === 0) {
      return null;
    }

    // Generate summer weeks
    const weeks = generateSummerWeeks(year);
    const summerStart = weeks[0]?.startDate;
    const summerEnd = weeks[weeks.length - 1]?.endDate;

    if (!summerStart || !summerEnd) {
      return null;
    }

    // Build plans for each child
    const childPlans = await Promise.all(
      children.map(async (child) => {
        // Get registrations for this child
        const registrations = await ctx.db
          .query("registrations")
          .withIndex("by_child", (q) => q.eq("childId", child._id))
          .collect();

        const confirmedRegistrations = registrations.filter(
          (r) => r.status === "registered"
        );

        // Fetch sessions
        const sessionIds = [
          ...new Set(confirmedRegistrations.map((r) => r.sessionId)),
        ];
        const sessionsRaw = await Promise.all(
          sessionIds.map((id) => ctx.db.get(id))
        );
        const sessions = sessionsRaw.filter(
          (s): s is Doc<"sessions"> => s !== null
        );
        const sessionMap = new Map(sessions.map((s) => [s._id, s]));

        // Fetch organizations for camp names
        const orgIds = [...new Set(sessions.map((s) => s.organizationId))];
        const orgsRaw = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
        const orgs = orgsRaw.filter(
          (o): o is Doc<"organizations"> => o !== null
        );
        const orgMap = new Map(orgs.map((o) => [o._id, o]));

        // Resolve org logos
        const orgLogoUrls = new Map<string, string | null>();
        for (const org of orgs) {
          if (org.logoStorageId) {
            const url = await ctx.storage.getUrl(org.logoStorageId);
            orgLogoUrls.set(org._id, url);
          }
        }

        // Fetch camps to get slugs
        const campIds = [...new Set(sessions.map((s) => s.campId))];
        const campsRaw = await Promise.all(campIds.map((id) => ctx.db.get(id)));
        const camps = campsRaw.filter(
          (c): c is Doc<"camps"> => c !== null
        );
        const campMap = new Map(camps.map((c) => [c._id, c]));

        // Get city for URL building
        const city = await ctx.db.get(family.primaryCityId);
        const citySlug = city?.slug ?? "portland";

        // Get family events for this child
        const familyEvents = await ctx.db
          .query("familyEvents")
          .withIndex("by_family_and_active", (q) =>
            q.eq("familyId", family._id).eq("isActive", true)
          )
          .collect();

        const childEvents = familyEvents.filter(
          (e) =>
            e.childIds.includes(child._id) &&
            doDateRangesOverlap(e.startDate, e.endDate, summerStart, summerEnd)
        );

        // Build week-by-week coverage with camp details
        const weeklyPlan = weeks.map((week) => {
          const camps: {
            sessionId: string;
            campName: string;
            campSlug: string;
            organizationName: string;
            organizationLogoUrl: string | null;
            startDate: string;
            endDate: string;
            citySlug: string;
          }[] = [];
          let campDays = 0;

          for (const reg of confirmedRegistrations) {
            const session = sessionMap.get(reg.sessionId);
            if (!session) continue;

            const overlappingDays = countOverlappingWeekdays(
              session.startDate,
              session.endDate,
              week.startDate,
              week.endDate
            );

            if (overlappingDays > 0) {
              const org = orgMap.get(session.organizationId);
              const camp = campMap.get(session.campId);
              camps.push({
                sessionId: session._id,
                campName: session.campName ?? "Camp",
                campSlug: camp?.slug ?? "camp",
                organizationName: org?.name ?? "Unknown",
                organizationLogoUrl: orgLogoUrls.get(session.organizationId) ?? null,
                startDate: session.startDate,
                endDate: session.endDate,
                citySlug,
              });
              campDays += overlappingDays;
            }
          }

          let eventDays = 0;
          for (const event of childEvents) {
            const overlappingDays = countOverlappingWeekdays(
              event.startDate,
              event.endDate,
              week.startDate,
              week.endDate
            );
            eventDays += overlappingDays;
          }

          const coveredDays = Math.min(5, campDays + eventDays);

          return {
            weekNumber: week.weekNumber,
            startDate: week.startDate,
            monthName: week.monthName,
            label: week.label,
            coveredDays,
            camps, // Actual camp details
            hasEvent: eventDays > 0,
            status:
              coveredDays >= 5
                ? ("full" as const)
                : coveredDays > 0
                ? ("partial" as const)
                : ("gap" as const),
          };
        });

        const stats = {
          totalWeeks: weeks.length,
          coveredWeeks: weeklyPlan.filter((w) => w.status === "full").length,
          partialWeeks: weeklyPlan.filter((w) => w.status === "partial").length,
          gapWeeks: weeklyPlan.filter((w) => w.status === "gap").length,
          totalCamps: confirmedRegistrations.length,
        };

        return {
          childId: child._id,
          childName: child.firstName,
          weeks: weeklyPlan,
          stats,
        };
      })
    );

    // Aggregate family stats
    const totalCoveredWeeks = childPlans.reduce(
      (sum, p) => sum + p.stats.coveredWeeks,
      0
    );
    const totalGapWeeks = childPlans.reduce(
      (sum, p) => sum + p.stats.gapWeeks,
      0
    );
    const totalCamps = childPlans.reduce(
      (sum, p) => sum + p.stats.totalCamps,
      0
    );

    return {
      familyName: family.displayName,
      year,
      children: childPlans,
      familyStats: {
        childCount: children.length,
        totalCoveredWeeks,
        totalGapWeeks,
        totalCamps,
        weeksPerChild: weeks.length,
      },
    };
  },
});

/**
 * Get a child's summer plan by share token (public - no auth required)
 * Returns limited data suitable for public viewing
 */
export const getSharedPlan = query({
  args: {
    shareToken: v.string(),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const year = args.year ?? new Date().getFullYear();

    // Find child by share token
    const child = await ctx.db
      .query("children")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .first();

    if (!child || !child.isActive) {
      return null;
    }

    // Get family info (just the display name)
    const family = await ctx.db.get(child.familyId);
    if (!family) {
      return null;
    }

    // Generate summer weeks
    const weeks = generateSummerWeeks(year);
    const summerStart = weeks[0]?.startDate;
    const summerEnd = weeks[weeks.length - 1]?.endDate;

    if (!summerStart || !summerEnd) {
      return null;
    }

    // Get registrations for this child
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_child", (q) => q.eq("childId", child._id))
      .collect();

    // Filter to registered only (not interested/waitlisted for privacy)
    const confirmedRegistrations = registrations.filter(
      (r) => r.status === "registered"
    );

    // Fetch sessions
    const sessionIds = [...new Set(confirmedRegistrations.map((r) => r.sessionId))];
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<"sessions"> => s !== null);
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));

    // Fetch organizations for logos
    const orgIds = [...new Set(sessions.map((s) => s.organizationId))];
    const orgsRaw = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgs = orgsRaw.filter((o): o is Doc<"organizations"> => o !== null);
    const orgMap = new Map(orgs.map((o) => [o._id, o]));

    // Resolve org logos
    const orgLogoUrls = new Map<string, string | null>();
    for (const org of orgs) {
      if (org.logoStorageId) {
        const url = await ctx.storage.getUrl(org.logoStorageId);
        orgLogoUrls.set(org._id, url);
      }
    }

    // Get family events for this child
    const familyEvents = await ctx.db
      .query("familyEvents")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    const childEvents = familyEvents.filter(
      (e) =>
        e.childIds.includes(child._id) &&
        doDateRangesOverlap(e.startDate, e.endDate, summerStart, summerEnd)
    );

    // Build week-by-week coverage
    const weeklyPlan = weeks.map((week) => {
      const weekRegistrations = confirmedRegistrations
        .map((r) => {
          const session = sessionMap.get(r.sessionId);
          if (!session) return null;

          const overlappingDays = countOverlappingWeekdays(
            session.startDate,
            session.endDate,
            week.startDate,
            week.endDate
          );

          if (overlappingDays === 0) return null;

          const org = orgMap.get(session.organizationId);
          return {
            campName: session.campName ?? "Camp",
            organizationName: org?.name ?? "Unknown",
            organizationLogoUrl: orgLogoUrls.get(session.organizationId) ?? null,
            overlappingDays,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const weekEvents = childEvents
        .map((e) => {
          const overlappingDays = countOverlappingWeekdays(
            e.startDate,
            e.endDate,
            week.startDate,
            week.endDate
          );

          if (overlappingDays === 0) return null;

          return {
            title: e.title,
            eventType: e.eventType,
            overlappingDays,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      const coveredDays =
        weekRegistrations.reduce((sum, r) => sum + r.overlappingDays, 0) +
        weekEvents.reduce((sum, e) => sum + e.overlappingDays, 0);

      return {
        week: {
          weekNumber: week.weekNumber,
          startDate: week.startDate,
          endDate: week.endDate,
          monthName: week.monthName,
          label: week.label,
        },
        camps: weekRegistrations,
        events: weekEvents,
        coveredDays: Math.min(5, coveredDays),
        hasGap: coveredDays === 0,
      };
    });

    return {
      childName: child.firstName,
      familyName: family.displayName,
      year,
      weeks: weeklyPlan,
      stats: {
        totalWeeks: weeks.length,
        coveredWeeks: weeklyPlan.filter((w) => w.coveredDays >= 5).length,
        partialWeeks: weeklyPlan.filter((w) => w.coveredDays > 0 && w.coveredDays < 5).length,
        gapWeeks: weeklyPlan.filter((w) => w.coveredDays === 0).length,
      },
    };
  },
});

/**
 * Get calendar data for a child by share token (for ICS feed)
 * Returns all registered camps with dates/times for calendar sync
 */
export const getChildCalendar = query({
  args: {
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Find child by share token
    const child = await ctx.db
      .query("children")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .first();

    if (!child || !child.isActive) {
      return null;
    }

    // Get family info
    const family = await ctx.db.get(child.familyId);
    if (!family) {
      return null;
    }

    // Get registrations for this child (registered and interested/waitlisted)
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_child", (q) => q.eq("childId", child._id))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Fetch sessions with all details
    const sessionIds = [...new Set(registrations.map((r) => r.sessionId))];
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<"sessions"> => s !== null);

    // Fetch camps for names
    const campIds = [...new Set(sessions.map((s) => s.campId))];
    const campsRaw = await Promise.all(campIds.map((id) => ctx.db.get(id)));
    const camps = campsRaw.filter((c): c is Doc<"camps"> => c !== null);
    const campMap = new Map(camps.map((c) => [c._id, c]));

    // Fetch organizations
    const orgIds = [...new Set(sessions.map((s) => s.organizationId))];
    const orgsRaw = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgs = orgsRaw.filter((o): o is Doc<"organizations"> => o !== null);
    const orgMap = new Map(orgs.map((o) => [o._id, o]));

    // Fetch locations
    const locationIds = [...new Set(sessions.map((s) => s.locationId))];
    const locationsRaw = await Promise.all(locationIds.map((id) => ctx.db.get(id)));
    const locations = locationsRaw.filter((l): l is Doc<"locations"> => l !== null);
    const locationMap = new Map(locations.map((l) => [l._id, l]));

    // Build calendar events
    const events = registrations.map((reg) => {
      const session = sessions.find((s) => s._id === reg.sessionId);
      if (!session) return null;

      const camp = campMap.get(session.campId);
      const org = orgMap.get(session.organizationId);
      const location = locationMap.get(session.locationId);

      return {
        id: reg._id,
        status: reg.status,
        campName: camp?.name || "Camp",
        organizationName: org?.name || "",
        startDate: session.startDate,
        endDate: session.endDate,
        dropOffTime: session.dropOffTime,
        pickUpTime: session.pickUpTime,
        locationName: location?.name || "",
        locationAddress: location?.address
          ? `${location.address.street}, ${location.address.city}, ${location.address.state} ${location.address.zip}`
          : "",
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);

    // Get family events
    const familyEvents = await ctx.db
      .query("familyEvents")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    const childFamilyEvents = familyEvents
      .filter((e) => e.childIds.includes(child._id))
      .map((e) => ({
        id: e._id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        eventType: e.eventType,
        location: e.location,
      }));

    return {
      childName: child.firstName,
      familyName: family.displayName,
      events,
      familyEvents: childFamilyEvents,
    };
  },
});
