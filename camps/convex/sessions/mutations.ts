import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { ageRangeValidator, timeValidator, sessionStatusValidator } from "../lib/validators";

/**
 * Create a new session
 */
export const createSession = mutation({
  args: {
    campId: v.id("camps"),
    locationId: v.id("locations"),
    startDate: v.string(),
    endDate: v.string(),
    dropOffTime: timeValidator,
    pickUpTime: timeValidator,
    price: v.number(),
    currency: v.string(),
    capacity: v.number(),
    ageRequirements: ageRangeValidator,
    extendedCareAvailable: v.boolean(),
    waitlistEnabled: v.boolean(),
    externalRegistrationUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify camp exists and get organization ID
    const camp = await ctx.db.get(args.campId);
    if (!camp) {
      throw new Error("Camp not found");
    }

    // Verify location exists and get city ID
    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    // Validate dates
    if (args.startDate > args.endDate) {
      throw new Error("Start date must be before or equal to end date");
    }

    const sessionId = await ctx.db.insert("sessions", {
      campId: args.campId,
      locationId: args.locationId,
      // Denormalized fields for query efficiency
      organizationId: camp.organizationId,
      cityId: location.cityId,

      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: args.dropOffTime,
      pickUpTime: args.pickUpTime,

      extendedCareAvailable: args.extendedCareAvailable,
      extendedCareDetails: undefined,

      price: args.price,
      currency: args.currency,

      capacity: args.capacity,
      enrolledCount: 0,
      waitlistCount: 0,

      ageRequirements: args.ageRequirements,

      status: "draft",

      waitlistEnabled: args.waitlistEnabled,
      waitlistCapacity: undefined,

      externalRegistrationUrl: args.externalRegistrationUrl,

      sourceId: undefined,
      lastScrapedAt: undefined,
    });

    return sessionId;
  },
});

/**
 * Update session details
 */
export const updateSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    dropOffTime: v.optional(timeValidator),
    pickUpTime: v.optional(timeValidator),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    capacity: v.optional(v.number()),
    ageRequirements: v.optional(ageRangeValidator),
    extendedCareAvailable: v.optional(v.boolean()),
    extendedCareDetails: v.optional(
      v.object({
        earlyDropOffTime: v.optional(timeValidator),
        latePickUpTime: v.optional(timeValidator),
        additionalCost: v.optional(v.number()),
      })
    ),
    waitlistEnabled: v.optional(v.boolean()),
    waitlistCapacity: v.optional(v.number()),
    externalRegistrationUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...updates } = args;

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Build update object with only defined fields
    const updateFields: Record<string, unknown> = {};

    if (updates.startDate !== undefined) {
      updateFields.startDate = updates.startDate;
    }
    if (updates.endDate !== undefined) {
      updateFields.endDate = updates.endDate;
    }

    // Validate dates if either is being updated
    const newStartDate = updates.startDate ?? session.startDate;
    const newEndDate = updates.endDate ?? session.endDate;
    if (newStartDate > newEndDate) {
      throw new Error("Start date must be before or equal to end date");
    }

    if (updates.dropOffTime !== undefined) {
      updateFields.dropOffTime = updates.dropOffTime;
    }
    if (updates.pickUpTime !== undefined) {
      updateFields.pickUpTime = updates.pickUpTime;
    }
    if (updates.price !== undefined) {
      updateFields.price = updates.price;
    }
    if (updates.currency !== undefined) {
      updateFields.currency = updates.currency;
    }
    if (updates.capacity !== undefined) {
      updateFields.capacity = updates.capacity;
    }
    if (updates.ageRequirements !== undefined) {
      updateFields.ageRequirements = updates.ageRequirements;
    }
    if (updates.extendedCareAvailable !== undefined) {
      updateFields.extendedCareAvailable = updates.extendedCareAvailable;
    }
    if (updates.extendedCareDetails !== undefined) {
      updateFields.extendedCareDetails = updates.extendedCareDetails;
    }
    if (updates.waitlistEnabled !== undefined) {
      updateFields.waitlistEnabled = updates.waitlistEnabled;
    }
    if (updates.waitlistCapacity !== undefined) {
      updateFields.waitlistCapacity = updates.waitlistCapacity;
    }
    if (updates.externalRegistrationUrl !== undefined) {
      updateFields.externalRegistrationUrl = updates.externalRegistrationUrl;
    }

    await ctx.db.patch(sessionId, updateFields);

    return sessionId;
  },
});

/**
 * Change session status
 */
export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id("sessions"),
    status: sessionStatusValidator,
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ["active", "cancelled"],
      active: ["sold_out", "cancelled", "completed"],
      sold_out: ["active", "cancelled", "completed"],
      cancelled: [], // Terminal state
      completed: [], // Terminal state
    };

    const allowedNextStatuses = validTransitions[session.status] || [];
    if (!allowedNextStatuses.includes(args.status)) {
      throw new Error(
        `Cannot transition from "${session.status}" to "${args.status}"`
      );
    }

    await ctx.db.patch(args.sessionId, {
      status: args.status,
    });

    return args.sessionId;
  },
});

/**
 * Update session capacity counts (internal use, typically from scraper or registration system)
 */
export const updateCapacityCounts = mutation({
  args: {
    sessionId: v.id("sessions"),
    enrolledCount: v.number(),
    waitlistCount: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Validate counts are non-negative
    if (args.enrolledCount < 0) {
      throw new Error("Enrolled count cannot be negative");
    }
    if (args.waitlistCount < 0) {
      throw new Error("Waitlist count cannot be negative");
    }

    // Determine if session should be marked as sold out
    const isSoldOut = args.enrolledCount >= session.capacity;
    const currentlySoldOut = session.status === "sold_out";

    await ctx.db.patch(args.sessionId, {
      enrolledCount: args.enrolledCount,
      waitlistCount: args.waitlistCount,
    });

    // Auto-update status if capacity threshold crossed (only for active sessions)
    if (session.status === "active" && isSoldOut && !currentlySoldOut) {
      await ctx.db.patch(args.sessionId, {
        status: "sold_out",
      });
    } else if (
      session.status === "sold_out" &&
      !isSoldOut &&
      currentlySoldOut
    ) {
      // Capacity became available again
      await ctx.db.patch(args.sessionId, {
        status: "active",
      });
    }

    return args.sessionId;
  },
});
