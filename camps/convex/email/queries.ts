/**
 * Internal queries for email service
 */
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get current user's family
 */
export const getCurrentFamily = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const family = await ctx.db
      .query("families")
      .withIndex("by_workos_user_id", (q) => q.eq("workosUserId", identity.subject))
      .first();

    return family;
  },
});

/**
 * Internal query to get city by ID
 */
export const getCity = internalQuery({
  args: { cityId: v.id("cities") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cityId);
  },
});
