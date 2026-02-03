import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireFamily } from "../lib/auth";
import { components } from "../_generated/api";

// Free tier limit for saved camps
const FREE_SAVED_CAMPS_LIMIT = 4;

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
    const isSoldOut = newEnrolledCount >= session.capacity;
    if (session.status === "active" && isSoldOut) {
      await ctx.db.patch(args.sessionId, { status: "sold_out" });
    } else if (session.status === "sold_out" && !isSoldOut) {
      await ctx.db.patch(args.sessionId, { status: "active" });
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
    // Count existing saved camps for this family (interested, registered, waitlisted)
    const existingRegistrations = await ctx.db
      .query("registrations")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .collect();

    const activeSavedCamps = existingRegistrations.filter(
      (r) => r.status === "interested" || r.status === "registered" || r.status === "waitlisted"
    ).length;

    // Check if user has premium subscription
    const identity = await ctx.auth.getUserIdentity();
    let isPremium = false;

    if (identity) {
      const subscriptions = await ctx.runQuery(
        components.stripe.public.listSubscriptionsByUserId,
        { userId: identity.subject }
      );
      isPremium = subscriptions.some(
        (sub) => sub.status === "active" || sub.status === "trialing"
      );
    }

    // Block if at limit and not premium
    if (activeSavedCamps >= FREE_SAVED_CAMPS_LIMIT && !isPremium) {
      throw new Error("PAYWALL:CAMP_LIMIT");
    }
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
          if (session.enrolledCount + 1 >= session.capacity && session.status === "active") {
            await ctx.db.patch(args.sessionId, { status: "sold_out" });
          }

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

        if (session.enrolledCount + 1 >= session.capacity && session.status === "active") {
          await ctx.db.patch(args.sessionId, { status: "sold_out" });
        }

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

      if (session.enrolledCount + 1 >= session.capacity && session.status === "active") {
        await ctx.db.patch(args.sessionId, { status: "sold_out" });
      }

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
        if (session.status === "sold_out" && newEnrolledCount < session.capacity) {
          await ctx.db.patch(registration.sessionId, { status: "active" });
        }
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
