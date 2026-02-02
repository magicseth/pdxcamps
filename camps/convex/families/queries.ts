import { query } from "../_generated/server";
import { v } from "convex/values";
import { getFamily } from "../lib/auth";

/**
 * Get the authenticated user's family.
 * Returns null if not authenticated or family not found.
 */
export const getCurrentFamily = query({
  args: {},
  handler: async (ctx) => {
    return await getFamily(ctx);
  },
});

/**
 * Get a family by ID.
 * Respects privacy settings - only returns public information for other families.
 */
export const getFamilyById = query({
  args: {
    familyId: v.id("families"),
  },
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId);
    if (!family) {
      return null;
    }

    // Check if this is the current user's family
    const currentFamily = await getFamily(ctx);
    const isOwnFamily = currentFamily?._id === family._id;

    if (isOwnFamily) {
      // Return full family data for own family
      return family;
    }

    // For other families, respect privacy and return limited info
    return {
      _id: family._id,
      _creationTime: family._creationTime,
      displayName: family.displayName,
      primaryCityId: family.primaryCityId,
      calendarSharingDefault: family.calendarSharingDefault,
    };
  },
});

/**
 * Get the onboarding status for the current user.
 * Returns whether the user has completed onboarding.
 */
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);

    if (!family) {
      return {
        hasFamily: false,
        isOnboardingComplete: false,
      };
    }

    return {
      hasFamily: true,
      isOnboardingComplete: family.onboardingCompletedAt !== undefined,
      onboardingCompletedAt: family.onboardingCompletedAt,
    };
  },
});
