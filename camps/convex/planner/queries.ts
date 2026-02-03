import { query } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { getFamily } from "../lib/auth";
import {
  generateSummerWeeks,
  doDateRangesOverlap,
  countOverlappingWeekdays,
  calculateAge,
  calculateDistance,
  isAgeInRange,
  isGradeInRange,
  SummerWeek,
} from "../lib/helpers";

/**
 * Coverage status for a child in a given week
 */
export type CoverageStatus =
  | "full" // 5 days covered by camps or events
  | "partial" // 1-4 days covered
  | "gap" // No coverage
  | "tentative" // Interested/waitlisted only
  | "event"; // Covered by family event

/**
 * Coverage info for a single child in a single week
 */
export interface ChildWeekCoverage {
  childId: Id<"children">;
  childName: string;
  status: CoverageStatus;
  coveredDays: number;
  availableSessionCount?: number; // Number of available sessions for gaps
  registrations: {
    registrationId: Id<"registrations">;
    sessionId: Id<"sessions">;
    campName: string;
    organizationName: string;
    organizationLogoUrl: string | null;
    status: "interested" | "waitlisted" | "registered" | "cancelled";
    overlappingDays: number;
  }[];
  events: {
    eventId: Id<"familyEvents">;
    title: string;
    eventType: string;
    overlappingDays: number;
  }[];
}

/**
 * Week coverage overview
 */
export interface WeekCoverage {
  week: SummerWeek;
  childCoverage: ChildWeekCoverage[];
  hasGap: boolean;
  hasFamilyEvent: boolean;
}

/**
 * Get summer coverage overview for all children in the family.
 * Returns week-by-week coverage status for June-August.
 */
export const getSummerCoverage = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args): Promise<WeekCoverage[]> => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    // Get all active children for the family
    const children = await ctx.db
      .query("children")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    if (children.length === 0) {
      return [];
    }

    // Generate summer weeks
    const weeks = generateSummerWeeks(args.year);
    const summerStart = weeks[0]?.startDate;
    const summerEnd = weeks[weeks.length - 1]?.endDate;

    if (!summerStart || !summerEnd) {
      return [];
    }

    // Get all registrations for the family
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    // Filter out cancelled registrations
    const activeRegistrations = registrations.filter(
      (r) => r.status !== "cancelled"
    );

    // Fetch all sessions for the registrations
    const sessionIds = [...new Set(activeRegistrations.map((r) => r.sessionId))];
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<"sessions"> => s !== null);
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));

    // Fetch camp names only for sessions that don't have denormalized data
    const sessionsNeedingCamps = sessions.filter((s) => !s.campName);
    const campIds = [...new Set(sessionsNeedingCamps.map((s) => s.campId))];
    const campsRaw = await Promise.all(campIds.map((id) => ctx.db.get(id)));
    const camps = campsRaw.filter((c): c is Doc<"camps"> => c !== null);
    const campMap = new Map(camps.map((c) => [c._id, c]));

    // Fetch organization logos for sessions
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

    // Get all active family events
    const familyEvents = await ctx.db
      .query("familyEvents")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    // Filter events that overlap with summer
    const summerEvents = familyEvents.filter((e) =>
      doDateRangesOverlap(e.startDate, e.endDate, summerStart, summerEnd)
    );

    // Get all active sessions in the family's city for counting available options
    const allActiveSessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status", (q) =>
        q.eq("cityId", family.primaryCityId).eq("status", "active")
      )
      .collect();

    // Filter to sessions that overlap summer and have spots available
    const availableSummerSessions = allActiveSessions.filter((s) => {
      const hasSpots = s.capacity > s.enrolledCount;
      const overlapsSummer = doDateRangesOverlap(
        s.startDate,
        s.endDate,
        summerStart,
        summerEnd
      );
      return hasSpots && overlapsSummer;
    });

    // Pre-compute child ages for efficiency
    const childAges = new Map<string, number>();
    for (const child of children) {
      childAges.set(child._id, calculateAge(child.birthdate));
    }

    // Build coverage for each week
    return weeks.map((week) => {
      const childCoverage: ChildWeekCoverage[] = children.map((child) => {
        // Find registrations for this child that overlap this week
        const childRegistrations = activeRegistrations
          .filter((r) => r.childId === child._id)
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

            // Use denormalized campName if available, otherwise look up
            const campName = session.campName ?? campMap.get(session.campId)?.name ?? "Unknown Camp";
            const org = orgMap.get(session.organizationId);
            const orgLogoUrl = orgLogoUrls.get(session.organizationId) ?? null;
            return {
              registrationId: r._id,
              sessionId: r.sessionId,
              campName,
              organizationName: org?.name ?? "Unknown",
              organizationLogoUrl: orgLogoUrl,
              status: r.status,
              overlappingDays,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        // Find events for this child that overlap this week
        const childEvents = summerEvents
          .filter((e) => e.childIds.includes(child._id))
          .map((e) => {
            const overlappingDays = countOverlappingWeekdays(
              e.startDate,
              e.endDate,
              week.startDate,
              week.endDate
            );

            if (overlappingDays === 0) return null;

            return {
              eventId: e._id,
              title: e.title,
              eventType: e.eventType,
              overlappingDays,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);

        // Calculate coverage status
        const registeredDays = childRegistrations
          .filter((r) => r.status === "registered")
          .reduce((sum, r) => sum + r.overlappingDays, 0);

        const eventDays = childEvents.reduce(
          (sum, e) => sum + e.overlappingDays,
          0
        );

        const tentativeDays = childRegistrations
          .filter((r) => r.status === "interested" || r.status === "waitlisted")
          .reduce((sum, r) => sum + r.overlappingDays, 0);

        // Total covered (camps + events, avoiding double-counting)
        const coveredDays = Math.min(5, registeredDays + eventDays);

        let status: CoverageStatus;
        if (childEvents.length > 0 && eventDays >= 5) {
          status = "event";
        } else if (coveredDays >= 5) {
          status = "full";
        } else if (coveredDays > 0) {
          status = "partial";
        } else if (tentativeDays > 0) {
          status = "tentative";
        } else {
          status = "gap";
        }

        // Count available sessions for gaps
        let availableSessionCount: number | undefined;
        if (status === "gap" || status === "partial" || status === "tentative") {
          const childAge = childAges.get(child._id) ?? 0;
          const childGrade = child.currentGrade;

          availableSessionCount = availableSummerSessions.filter((s) => {
            // Check if session overlaps this week
            const overlaps = doDateRangesOverlap(
              s.startDate,
              s.endDate,
              week.startDate,
              week.endDate
            );
            if (!overlaps) return false;

            // Check age/grade eligibility
            const ageOk = isAgeInRange(childAge, s.ageRequirements);
            const gradeOk =
              childGrade === undefined ||
              childGrade === null ||
              isGradeInRange(childGrade, s.ageRequirements);

            return ageOk && gradeOk;
          }).length;
        }

        return {
          childId: child._id,
          childName: child.firstName,
          status,
          coveredDays,
          availableSessionCount,
          registrations: childRegistrations,
          events: childEvents,
        };
      });

      return {
        week,
        childCoverage,
        hasGap: childCoverage.some((c) => c.status === "gap"),
        hasFamilyEvent: childCoverage.some(
          (c) => c.events.length > 0
        ),
      };
    });
  },
});

/**
 * Get detailed coverage information for a specific week,
 * including session logistics and available camps for gaps.
 */
export const getWeekDetail = query({
  args: {
    weekStartDate: v.string(),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return null;
    }

    // Get children
    const children = await ctx.db
      .query("children")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    if (children.length === 0) {
      return null;
    }

    // Calculate week end (Friday = Monday + 4 days)
    const weekStart = new Date(args.weekStartDate + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);
    const weekEndDate = weekEnd.toISOString().split("T")[0];

    // Get registrations
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    const activeRegistrations = registrations.filter(
      (r) => r.status !== "cancelled"
    );

    // Fetch sessions
    const sessionIds = [...new Set(activeRegistrations.map((r) => r.sessionId))];
    const sessionsRaw = await Promise.all(sessionIds.map((id) => ctx.db.get(id)));
    const sessions = sessionsRaw.filter((s): s is Doc<"sessions"> => s !== null);
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));

    // Only fetch related data for sessions missing denormalized fields
    const sessionsNeedingData = sessions.filter(
      (s) => !s.campName || !s.locationName || !s.organizationName
    );
    const campIds = [...new Set(sessionsNeedingData.filter((s) => !s.campName).map((s) => s.campId))];
    const locationIds = [...new Set(sessionsNeedingData.filter((s) => !s.locationName).map((s) => s.locationId))];
    // Fetch all org IDs for logo resolution
    const allOrgIds = [...new Set(sessions.map((s) => s.organizationId))];

    const [campsRaw, locationsRaw, allOrgsRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(allOrgIds.map((id) => ctx.db.get(id))),
    ]);

    const campMap = new Map(
      campsRaw.filter((c): c is Doc<"camps"> => c !== null).map((c) => [c._id, c])
    );
    const locationMap = new Map(
      locationsRaw
        .filter((l): l is Doc<"locations"> => l !== null)
        .map((l) => [l._id, l])
    );
    const allOrgs = allOrgsRaw.filter((o): o is Doc<"organizations"> => o !== null);
    const orgMap = new Map(allOrgs.map((o) => [o._id, o]));

    // Resolve organization logo URLs
    const orgLogoUrls = new Map<string, string | null>();
    for (const org of allOrgs) {
      if (org.logoStorageId) {
        const url = await ctx.storage.getUrl(org.logoStorageId);
        orgLogoUrls.set(org._id, url);
      }
    }

    // Get family events
    const familyEvents = await ctx.db
      .query("familyEvents")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    // Filter events that overlap this week
    const weekEvents = familyEvents.filter((e) =>
      doDateRangesOverlap(e.startDate, e.endDate, args.weekStartDate, weekEndDate)
    );

    // Build per-child detail
    const childDetails = await Promise.all(
      children.map(async (child) => {
        const childAge = calculateAge(child.birthdate);
        const childGrade = child.currentGrade;

        // Find registrations for this child that overlap this week
        const childRegistrations = activeRegistrations
          .filter((r) => r.childId === child._id)
          .map((r) => {
            const session = sessionMap.get(r.sessionId);
            if (!session) return null;

            if (
              !doDateRangesOverlap(
                session.startDate,
                session.endDate,
                args.weekStartDate,
                weekEndDate
              )
            ) {
              return null;
            }

            // Use denormalized fields when available, fall back to lookups
            const camp = campMap.get(session.campId);
            const location = locationMap.get(session.locationId);
            const org = orgMap.get(session.organizationId);

            return {
              registrationId: r._id,
              status: r.status,
              session: {
                _id: session._id,
                startDate: session.startDate,
                endDate: session.endDate,
                dropOffTime: session.dropOffTime,
                pickUpTime: session.pickUpTime,
                extendedCareAvailable: session.extendedCareAvailable,
                extendedCareDetails: session.extendedCareDetails,
              },
              camp: {
                name: session.campName ?? camp?.name ?? "Unknown Camp",
                categories: session.campCategories ?? camp?.categories ?? [],
              },
              location: session.locationName || location
                ? {
                    name: session.locationName ?? location?.name ?? "Unknown Location",
                    address: session.locationAddress ?? location?.address ?? {
                      street: "",
                      city: "",
                      state: "",
                      zip: "",
                    },
                  }
                : null,
              organization: {
                name: session.organizationName ?? org?.name ?? "Unknown",
                logoUrl: orgLogoUrls.get(session.organizationId) ?? null,
              },
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        // Find events for this child
        const childEvents = weekEvents
          .filter((e) => e.childIds.includes(child._id))
          .map((e) => ({
            _id: e._id,
            title: e.title,
            eventType: e.eventType,
            startDate: e.startDate,
            endDate: e.endDate,
            location: e.location,
            notes: e.notes,
            color: e.color,
          }));

        // Calculate coverage
        const registeredDays = childRegistrations
          .filter((r) => r.status === "registered")
          .reduce((sum, r) => {
            return (
              sum +
              countOverlappingWeekdays(
                r.session.startDate,
                r.session.endDate,
                args.weekStartDate,
                weekEndDate
              )
            );
          }, 0);

        const eventDays = childEvents.reduce((sum, e) => {
          return (
            sum +
            countOverlappingWeekdays(
              e.startDate,
              e.endDate,
              args.weekStartDate,
              weekEndDate
            )
          );
        }, 0);

        const coveredDays = Math.min(5, registeredDays + eventDays);
        const hasGap = coveredDays < 5;

        // Get available camps if there's a gap
        let availableCamps: {
          sessionId: Id<"sessions">;
          campName: string;
          organizationName: string;
          startDate: string;
          endDate: string;
          dropOffTime: { hour: number; minute: number };
          pickUpTime: { hour: number; minute: number };
          price: number;
          currency: string;
          spotsLeft: number;
          locationName: string;
        }[] = [];

        if (hasGap) {
          // Find sessions that overlap this week and are suitable for this child
          const allSessions = await ctx.db
            .query("sessions")
            .withIndex("by_city_and_status", (q) =>
              q.eq("cityId", args.cityId).eq("status", "active")
            )
            .collect();

          const overlappingSessions = allSessions.filter((s) =>
            doDateRangesOverlap(
              s.startDate,
              s.endDate,
              args.weekStartDate,
              weekEndDate
            )
          );

          // Filter by age/grade requirements
          const eligibleSessions = overlappingSessions.filter((s) => {
            const ageOk = isAgeInRange(childAge, s.ageRequirements);
            const gradeOk =
              childGrade === undefined ||
              childGrade === null ||
              isGradeInRange(childGrade, s.ageRequirements);
            return ageOk && gradeOk;
          });

          // Exclude sessions the child is already registered for
          const registeredSessionIds = new Set(
            childRegistrations.map((r) => r.session._id)
          );
          const newSessions = eligibleSessions.filter(
            (s) => !registeredSessionIds.has(s._id)
          );

          // Fetch camp and location info only for sessions missing denormalized data
          const sessionsNeedingAvailData = newSessions.filter(
            (s) => !s.campName || !s.locationName || !s.organizationName
          );
          const availCampIds = [...new Set(sessionsNeedingAvailData.filter((s) => !s.campName).map((s) => s.campId))];
          const availLocIds = [...new Set(sessionsNeedingAvailData.filter((s) => !s.locationName).map((s) => s.locationId))];
          const availOrgIds = [...new Set(sessionsNeedingAvailData.filter((s) => !s.organizationName).map((s) => s.organizationId))];

          const [availCampsRaw, availLocsRaw, availOrgsRaw] = await Promise.all([
            Promise.all(availCampIds.map((id) => ctx.db.get(id))),
            Promise.all(availLocIds.map((id) => ctx.db.get(id))),
            Promise.all(availOrgIds.map((id) => ctx.db.get(id))),
          ]);

          const availCampMap = new Map(
            availCampsRaw
              .filter((c): c is Doc<"camps"> => c !== null)
              .map((c) => [c._id, c])
          );
          const availLocMap = new Map(
            availLocsRaw
              .filter((l): l is Doc<"locations"> => l !== null)
              .map((l) => [l._id, l])
          );
          const availOrgMap = new Map(
            availOrgsRaw
              .filter((o): o is Doc<"organizations"> => o !== null)
              .map((o) => [o._id, o])
          );

          availableCamps = newSessions
            .map((s) => {
              // Use denormalized fields when available
              return {
                sessionId: s._id,
                campName: s.campName ?? availCampMap.get(s.campId)?.name ?? "Unknown Camp",
                organizationName: s.organizationName ?? availOrgMap.get(s.organizationId)?.name ?? "Unknown",
                startDate: s.startDate,
                endDate: s.endDate,
                dropOffTime: s.dropOffTime,
                pickUpTime: s.pickUpTime,
                price: s.price,
                currency: s.currency,
                spotsLeft: Math.max(0, s.capacity - s.enrolledCount),
                locationName: s.locationName ?? availLocMap.get(s.locationId)?.name ?? "Unknown Location",
              };
            })
            .filter((s) => s.spotsLeft > 0)
            .slice(0, 10); // Limit to 10 suggestions
        }

        return {
          child: {
            _id: child._id,
            firstName: child.firstName,
            lastName: child.lastName,
            birthdate: child.birthdate,
            currentGrade: child.currentGrade,
            avatarStorageId: child.avatarStorageId,
          },
          age: childAge,
          registrations: childRegistrations,
          events: childEvents,
          coveredDays,
          hasGap,
          availableCamps,
        };
      })
    );

    return {
      weekStartDate: args.weekStartDate,
      weekEndDate,
      children: childDetails,
    };
  },
});

/**
 * Search for sessions that overlap a specific week.
 * Used for finding camps to fill gaps.
 */
export const searchSessionsByWeek = query({
  args: {
    cityId: v.id("cities"),
    weekStartDate: v.string(),
    weekEndDate: v.string(),
    childAge: v.optional(v.number()),
    childGrade: v.optional(v.number()),
    categories: v.optional(v.array(v.string())),
    // Distance filtering
    homeLatitude: v.optional(v.number()),
    homeLongitude: v.optional(v.number()),
    maxDistanceMiles: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get active sessions in the city
    let sessions = await ctx.db
      .query("sessions")
      .withIndex("by_city_and_status", (q) =>
        q.eq("cityId", args.cityId).eq("status", "active")
      )
      .collect();

    // Filter to sessions that overlap the week
    sessions = sessions.filter((s) =>
      doDateRangesOverlap(
        s.startDate,
        s.endDate,
        args.weekStartDate,
        args.weekEndDate
      )
    );

    // Filter by age if provided
    if (args.childAge !== undefined) {
      sessions = sessions.filter((s) =>
        isAgeInRange(args.childAge!, s.ageRequirements)
      );
    }

    // Filter by grade if provided
    if (args.childGrade !== undefined) {
      sessions = sessions.filter((s) =>
        isGradeInRange(args.childGrade!, s.ageRequirements)
      );
    }

    // Filter by categories - use denormalized campCategories when available
    if (args.categories && args.categories.length > 0) {
      // First try filtering with denormalized data
      const sessionsWithCategories = sessions.filter((s) => s.campCategories);
      const sessionsNeedingCategories = sessions.filter((s) => !s.campCategories);

      // Fetch camps only for sessions missing denormalized categories
      const campIds = [...new Set(sessionsNeedingCategories.map((s) => s.campId))];
      const campsRaw = await Promise.all(campIds.map((id) => ctx.db.get(id)));
      const campMap = new Map(
        campsRaw
          .filter((c): c is Doc<"camps"> => c !== null)
          .map((c) => [c._id, c])
      );

      // Filter sessions with denormalized data
      const filteredWithDenorm = sessionsWithCategories.filter((s) =>
        args.categories!.some((cat) => s.campCategories!.includes(cat))
      );

      // Filter sessions needing lookup
      const filteredWithLookup = sessionsNeedingCategories.filter((s) => {
        const camp = campMap.get(s.campId);
        if (!camp) return false;
        return args.categories!.some((cat) => camp.categories.includes(cat));
      });

      sessions = [...filteredWithDenorm, ...filteredWithLookup];
    }

    // Only fetch related data for sessions missing denormalized fields
    const sessionsNeedingData = sessions.filter(
      (s) => !s.campName || !s.locationName || !s.organizationName
    );
    const campIds = [...new Set(sessionsNeedingData.filter((s) => !s.campName).map((s) => s.campId))];
    const locationIds = [...new Set(sessionsNeedingData.filter((s) => !s.locationName).map((s) => s.locationId))];
    const orgIds = [...new Set(sessionsNeedingData.filter((s) => !s.organizationName).map((s) => s.organizationId))];

    const [campsRaw, locationsRaw, orgsRaw] = await Promise.all([
      Promise.all(campIds.map((id) => ctx.db.get(id))),
      Promise.all(locationIds.map((id) => ctx.db.get(id))),
      Promise.all(orgIds.map((id) => ctx.db.get(id))),
    ]);

    const campMap = new Map(
      campsRaw
        .filter((c): c is Doc<"camps"> => c !== null)
        .map((c) => [c._id, c])
    );
    const locationMap = new Map(
      locationsRaw
        .filter((l): l is Doc<"locations"> => l !== null)
        .map((l) => [l._id, l])
    );
    const orgMap = new Map(
      orgsRaw
        .filter((o): o is Doc<"organizations"> => o !== null)
        .map((o) => [o._id, o])
    );

    // Check if we need to calculate distances
    const hasHomeCoords = args.homeLatitude !== undefined && args.homeLongitude !== undefined;

    // If filtering by distance, we need all location coords
    let allLocationMap = locationMap;
    if (hasHomeCoords) {
      // Fetch any locations we don't already have
      const allLocationIds = [...new Set(sessions.map((s) => s.locationId))];
      const missingLocationIds = allLocationIds.filter((id) => !locationMap.has(id));
      if (missingLocationIds.length > 0) {
        const missingLocationsRaw = await Promise.all(missingLocationIds.map((id) => ctx.db.get(id)));
        for (const loc of missingLocationsRaw) {
          if (loc) {
            allLocationMap.set(loc._id, loc);
          }
        }
      }
    }

    let results = sessions.map((s) => {
      const camp = campMap.get(s.campId);
      const location = allLocationMap.get(s.locationId);
      const org = orgMap.get(s.organizationId);

      // Calculate distance if home coords provided
      let distanceFromHome: number | undefined;
      if (hasHomeCoords && location) {
        distanceFromHome = Math.round(
          calculateDistance(
            args.homeLatitude!,
            args.homeLongitude!,
            location.latitude,
            location.longitude
          ) * 10
        ) / 10;
      }

      return {
        _id: s._id,
        startDate: s.startDate,
        endDate: s.endDate,
        dropOffTime: s.dropOffTime,
        pickUpTime: s.pickUpTime,
        price: s.price,
        currency: s.currency,
        capacity: s.capacity,
        enrolledCount: s.enrolledCount,
        spotsLeft: Math.max(0, s.capacity - s.enrolledCount),
        waitlistEnabled: s.waitlistEnabled,
        ageRequirements: s.ageRequirements,
        distanceFromHome,
        camp: {
          _id: s.campId,
          name: s.campName ?? camp?.name ?? "Unknown Camp",
          categories: s.campCategories ?? camp?.categories ?? [],
        },
        location: {
          _id: s.locationId,
          name: s.locationName ?? location?.name ?? "Unknown Location",
          address: s.locationAddress ?? location?.address ?? {
            street: "",
            city: "",
            state: "",
            zip: "",
          },
          latitude: location?.latitude,
          longitude: location?.longitude,
        },
        organization: {
          _id: s.organizationId,
          name: s.organizationName ?? org?.name ?? "Unknown",
        },
      };
    });

    // Apply distance filter if specified
    if (args.maxDistanceMiles !== undefined && hasHomeCoords) {
      results = results.filter(
        (s) => s.distanceFromHome !== undefined && s.distanceFromHome <= args.maxDistanceMiles!
      );
    }

    return results;
  },
});

/**
 * Get all family events (for listing/management)
 */
export const getFamilyEvents = query({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    let events = await ctx.db
      .query("familyEvents")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();

    // Filter by year if provided
    if (args.year !== undefined) {
      const yearStart = `${args.year}-01-01`;
      const yearEnd = `${args.year}-12-31`;
      events = events.filter((e) =>
        doDateRangesOverlap(e.startDate, e.endDate, yearStart, yearEnd)
      );
    }

    // Get children info
    const childIds = [...new Set(events.flatMap((e) => e.childIds))];
    const childrenRaw = await Promise.all(childIds.map((id) => ctx.db.get(id)));
    const childMap = new Map(
      childrenRaw
        .filter((c): c is Doc<"children"> => c !== null)
        .map((c) => [c._id, c])
    );

    return events.map((e) => ({
      ...e,
      children: e.childIds
        .map((id) => childMap.get(id))
        .filter((c): c is Doc<"children"> => c !== null)
        .map((c) => ({ _id: c._id, firstName: c.firstName })),
    }));
  },
});
