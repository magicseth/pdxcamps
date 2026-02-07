import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { requireFamily } from "../lib/auth";
import { updateSessionCapacityStatus } from "../lib/helpers";
import { enforceSavedCampLimit } from "../lib/paywall";

/**
 * Internal mutation to update session capacity counts.
 * Called by registration mutations to maintain denormalized counts.
 */
export const updateSessionCounts = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    enrolledDelta: v.number(),
    waitlistDelta: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const newEnrolledCount = Math.max(0, session.enrolledCount + args.enrolledDelta);
    const newWaitlistCount = Math.max(0, session.waitlistCount + args.waitlistDelta);

    await ctx.db.patch(args.sessionId, {
      enrolledCount: newEnrolledCount,
      waitlistCount: newWaitlistCount,
    });

    // Auto-update status based on capacity
    await updateSessionCapacityStatus(
      ctx.db, args.sessionId, newEnrolledCount, session.capacity, session.status
    );

    // Refresh planner availability aggregate if this changed availability
    const wasSoldOut = session.enrolledCount >= session.capacity;
    const nowSoldOut = newEnrolledCount >= session.capacity;
    if (wasSoldOut !== nowSoldOut) {
      const currentYear = new Date().getFullYear();
      await ctx.scheduler.runAfter(0, internal.planner.aggregates.recomputeForCity, {
        cityId: session.cityId,
        year: currentYear,
      });
    }
  },
});

/**
 * Mark a session as interested (bookmark).
 * Creates a registration with status "interested".
 *
 * PAYWALL: Free users can only save 4 camps. Premium users get unlimited.
 */
export const markInterested = mutation({
  args: {
    childId: v.id("children"),
    sessionId: v.id("sessions"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Verify child belongs to family
    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }
    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    // Verify session exists
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Check if registration already exists for this child/session
    const existingRegistration = await ctx.db
      .query("registrations")
      .withIndex("by_child_and_session", (q) =>
        q.eq("childId", args.childId).eq("sessionId", args.sessionId)
      )
      .unique();

    if (existingRegistration) {
      throw new Error("Registration already exists for this child and session");
    }

    // === PAYWALL CHECK ===
    // Free users can only save a limited number of camps (registrations + custom camps).
    // Premium users get unlimited. See convex/lib/paywall.ts for details.
    await enforceSavedCampLimit(ctx, family._id, "save_camp");
    // === END PAYWALL CHECK ===

    const registrationId = await ctx.db.insert("registrations", {
      familyId: family._id,
      childId: args.childId,
      sessionId: args.sessionId,
      status: "interested",
      notes: args.notes,
    });

    return registrationId;
  },
});

/**
 * Register a child for a session.
 * Can upgrade from "interested" to "registered" or create a new registration.
 * Automatically moves to waitlist if session is full.
 *
 * NO PAYWALL: This mutation typically upgrades an existing "interested" registration
 * (which was already paywall-gated via markInterested) to "registered". When it
 * creates a brand-new registration, the user has already committed to registering
 * externally — blocking them here would be confusing. The paywall lives at the
 * "save/bookmark" step, not the "I actually registered" step.
 */
export const register = mutation({
  args: {
    childId: v.id("children"),
    sessionId: v.id("sessions"),
    externalConfirmationCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Verify child belongs to family
    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }
    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    // Verify session exists and is active
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.status !== "active" && session.status !== "sold_out") {
      throw new Error("Session is not available for registration");
    }

    // Check if registration already exists
    const existingRegistration = await ctx.db
      .query("registrations")
      .withIndex("by_child_and_session", (q) =>
        q.eq("childId", args.childId).eq("sessionId", args.sessionId)
      )
      .unique();

    // Determine if there's capacity
    const hasCapacity = session.enrolledCount < session.capacity;

    if (existingRegistration) {
      // Handle existing registration
      if (existingRegistration.status === "registered") {
        throw new Error("Child is already registered for this session");
      }
      if (existingRegistration.status === "waitlisted") {
        throw new Error("Child is already on the waitlist for this session");
      }
      if (existingRegistration.status === "cancelled") {
        // Re-register a cancelled registration
        if (hasCapacity) {
          await ctx.db.patch(existingRegistration._id, {
            status: "registered",
            registeredAt: Date.now(),
            externalConfirmationCode: args.externalConfirmationCode,
          });

          // Update session counts
          await ctx.db.patch(args.sessionId, {
            enrolledCount: session.enrolledCount + 1,
          });

          // Check if session should be marked sold out
          await updateSessionCapacityStatus(
            ctx.db, args.sessionId, session.enrolledCount + 1, session.capacity, session.status
          );

          return existingRegistration._id;
        } else if (session.waitlistEnabled) {
          // Add to waitlist
          const waitlistPosition = session.waitlistCount + 1;
          await ctx.db.patch(existingRegistration._id, {
            status: "waitlisted",
            waitlistPosition,
            externalConfirmationCode: args.externalConfirmationCode,
          });

          await ctx.db.patch(args.sessionId, {
            waitlistCount: session.waitlistCount + 1,
          });

          return existingRegistration._id;
        } else {
          throw new Error("Session is full and waitlist is not available");
        }
      }

      // Upgrade from "interested" to "registered" or "waitlisted"
      if (hasCapacity) {
        await ctx.db.patch(existingRegistration._id, {
          status: "registered",
          registeredAt: Date.now(),
          externalConfirmationCode: args.externalConfirmationCode,
        });

        await ctx.db.patch(args.sessionId, {
          enrolledCount: session.enrolledCount + 1,
        });

        await updateSessionCapacityStatus(
          ctx.db, args.sessionId, session.enrolledCount + 1, session.capacity, session.status
        );

        return existingRegistration._id;
      } else if (session.waitlistEnabled) {
        const waitlistPosition = session.waitlistCount + 1;
        await ctx.db.patch(existingRegistration._id, {
          status: "waitlisted",
          waitlistPosition,
          externalConfirmationCode: args.externalConfirmationCode,
        });

        await ctx.db.patch(args.sessionId, {
          waitlistCount: session.waitlistCount + 1,
        });

        return existingRegistration._id;
      } else {
        throw new Error("Session is full and waitlist is not available");
      }
    }

    // Create new registration
    if (hasCapacity) {
      const registrationId = await ctx.db.insert("registrations", {
        familyId: family._id,
        childId: args.childId,
        sessionId: args.sessionId,
        status: "registered",
        registeredAt: Date.now(),
        externalConfirmationCode: args.externalConfirmationCode,
      });

      await ctx.db.patch(args.sessionId, {
        enrolledCount: session.enrolledCount + 1,
      });

      await updateSessionCapacityStatus(
        ctx.db, args.sessionId, session.enrolledCount + 1, session.capacity, session.status
      );

      return registrationId;
    } else if (session.waitlistEnabled) {
      const waitlistPosition = session.waitlistCount + 1;
      const registrationId = await ctx.db.insert("registrations", {
        familyId: family._id,
        childId: args.childId,
        sessionId: args.sessionId,
        status: "waitlisted",
        waitlistPosition,
        externalConfirmationCode: args.externalConfirmationCode,
      });

      await ctx.db.patch(args.sessionId, {
        waitlistCount: session.waitlistCount + 1,
      });

      return registrationId;
    } else {
      throw new Error("Session is full and waitlist is not available");
    }
  },
});

/**
 * Cancel a registration.
 * Updates status to "cancelled" and decrements session counts.
 */
export const cancelRegistration = mutation({
  args: {
    registrationId: v.id("registrations"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found");
    }

    // Verify registration belongs to family
    if (registration.familyId !== family._id) {
      throw new Error("Registration does not belong to this family");
    }

    if (registration.status === "cancelled") {
      throw new Error("Registration is already cancelled");
    }

    const previousStatus = registration.status;

    // Update registration status
    await ctx.db.patch(args.registrationId, {
      status: "cancelled",
      waitlistPosition: undefined,
    });

    // Update session counts
    const session = await ctx.db.get(registration.sessionId);
    if (session) {
      if (previousStatus === "registered") {
        const newEnrolledCount = Math.max(0, session.enrolledCount - 1);
        await ctx.db.patch(registration.sessionId, {
          enrolledCount: newEnrolledCount,
        });

        // If session was sold out and now has capacity, mark as active
        await updateSessionCapacityStatus(
          ctx.db, registration.sessionId, newEnrolledCount, session.capacity, session.status
        );
      } else if (previousStatus === "waitlisted") {
        await ctx.db.patch(registration.sessionId, {
          waitlistCount: Math.max(0, session.waitlistCount - 1),
        });

        // Reorder waitlist positions for remaining waitlisted registrations
        const waitlistedRegistrations = await ctx.db
          .query("registrations")
          .withIndex("by_session_and_status", (q) =>
            q.eq("sessionId", registration.sessionId).eq("status", "waitlisted")
          )
          .collect();

        // Sort by current waitlist position and reassign
        const sorted = waitlistedRegistrations
          .filter((r) => r.waitlistPosition !== undefined)
          .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));

        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i].waitlistPosition !== i + 1) {
            await ctx.db.patch(sorted[i]._id, { waitlistPosition: i + 1 });
          }
        }
      }
    }

    return args.registrationId;
  },
});

/**
 * Update notes on a registration.
 */
export const updateRegistrationNotes = mutation({
  args: {
    registrationId: v.id("registrations"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found");
    }

    // Verify registration belongs to family
    if (registration.familyId !== family._id) {
      throw new Error("Registration does not belong to this family");
    }

    await ctx.db.patch(args.registrationId, {
      notes: args.notes,
    });

    return args.registrationId;
  },
});

/**
 * Join the waitlist for a sold-out session.
 * Creates a registration with status "waitlisted" or upgrades from "interested".
 *
 * NO PAYWALL: Joining a waitlist is an upgrade from an existing "interested"
 * registration (already paywall-gated) or a direct action where the user is
 * tracking external waitlist status. Same reasoning as register() — the gate
 * is at the bookmark step.
 */
export const joinWaitlist = mutation({
  args: {
    childId: v.id("children"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Verify child belongs to family
    const child = await ctx.db.get(args.childId);
    if (!child) {
      throw new Error("Child not found");
    }
    if (child.familyId !== family._id) {
      throw new Error("Child does not belong to this family");
    }

    // Verify session exists
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Check if waitlist is enabled
    if (!session.waitlistEnabled) {
      throw new Error("Waitlist is not enabled for this session");
    }

    // Check waitlist capacity if specified
    if (
      session.waitlistCapacity !== undefined &&
      session.waitlistCount >= session.waitlistCapacity
    ) {
      throw new Error("Waitlist is full");
    }

    // Check for existing registration
    const existingRegistration = await ctx.db
      .query("registrations")
      .withIndex("by_child_and_session", (q) =>
        q.eq("childId", args.childId).eq("sessionId", args.sessionId)
      )
      .unique();

    const waitlistPosition = session.waitlistCount + 1;

    if (existingRegistration) {
      if (existingRegistration.status === "registered") {
        throw new Error("Child is already registered for this session");
      }
      if (existingRegistration.status === "waitlisted") {
        throw new Error("Child is already on the waitlist for this session");
      }
      if (
        existingRegistration.status === "cancelled" ||
        existingRegistration.status === "interested"
      ) {
        // Upgrade to waitlisted
        await ctx.db.patch(existingRegistration._id, {
          status: "waitlisted",
          waitlistPosition,
        });

        await ctx.db.patch(args.sessionId, {
          waitlistCount: session.waitlistCount + 1,
        });

        return existingRegistration._id;
      }
    }

    // Create new waitlist registration
    const registrationId = await ctx.db.insert("registrations", {
      familyId: family._id,
      childId: args.childId,
      sessionId: args.sessionId,
      status: "waitlisted",
      waitlistPosition,
    });

    await ctx.db.patch(args.sessionId, {
      waitlistCount: session.waitlistCount + 1,
    });

    return registrationId;
  },
});
