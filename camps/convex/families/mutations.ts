import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireFamily, getFamily } from "../lib/auth";
import { addressValidator, calendarSharingDefaultValidator } from "../lib/validators";

/**
 * Create a new family for the current authenticated user.
 * Throws if user is not authenticated or already has a family.
 */
export const createFamily = mutation({
  args: {
    displayName: v.string(),
    email: v.string(),
    primaryCityId: v.id("cities"),
    calendarSharingDefault: calendarSharingDefaultValidator,
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Check if user already has a family
    const existingFamily = await getFamily(ctx);
    if (existingFamily) {
      throw new Error("User already has a family");
    }

    // Verify the city exists
    const city = await ctx.db.get(args.primaryCityId);
    if (!city) {
      throw new Error("City not found");
    }

    const familyId = await ctx.db.insert("families", {
      workosUserId: identity.subject,
      email: args.email,
      displayName: args.displayName,
      primaryCityId: args.primaryCityId,
      calendarSharingDefault: args.calendarSharingDefault,
    });

    return familyId;
  },
});

/**
 * Update the current family's settings.
 * All fields are optional - only provided fields will be updated.
 */
export const updateFamily = mutation({
  args: {
    displayName: v.optional(v.string()),
    primaryCityId: v.optional(v.id("cities")),
    homeNeighborhoodId: v.optional(v.id("neighborhoods")),
    homeAddress: v.optional(addressValidator),
    maxDriveTimeMinutes: v.optional(v.number()),
    calendarSharingDefault: v.optional(calendarSharingDefaultValidator),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (args.displayName !== undefined) {
      updates.displayName = args.displayName;
    }

    if (args.primaryCityId !== undefined) {
      // Verify the city exists
      const city = await ctx.db.get(args.primaryCityId);
      if (!city) {
        throw new Error("City not found");
      }
      updates.primaryCityId = args.primaryCityId;
    }

    if (args.homeNeighborhoodId !== undefined) {
      // Verify the neighborhood exists
      const neighborhood = await ctx.db.get(args.homeNeighborhoodId);
      if (!neighborhood) {
        throw new Error("Neighborhood not found");
      }
      updates.homeNeighborhoodId = args.homeNeighborhoodId;
    }

    if (args.homeAddress !== undefined) {
      updates.homeAddress = args.homeAddress;
    }

    if (args.maxDriveTimeMinutes !== undefined) {
      if (args.maxDriveTimeMinutes < 0) {
        throw new Error("Max drive time must be non-negative");
      }
      updates.maxDriveTimeMinutes = args.maxDriveTimeMinutes;
    }

    if (args.calendarSharingDefault !== undefined) {
      updates.calendarSharingDefault = args.calendarSharingDefault;
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(family._id, updates);
    }

    return family._id;
  },
});

/**
 * Mark the current family's onboarding as completed.
 */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const family = await requireFamily(ctx);

    // Only update if not already completed
    if (family.onboardingCompletedAt === undefined) {
      await ctx.db.patch(family._id, {
        onboardingCompletedAt: Date.now(),
      });
    }

    return family._id;
  },
});
