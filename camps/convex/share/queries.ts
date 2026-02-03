import { query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import {
  generateSummerWeeks,
  doDateRangesOverlap,
  countOverlappingWeekdays,
} from "../lib/helpers";

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
