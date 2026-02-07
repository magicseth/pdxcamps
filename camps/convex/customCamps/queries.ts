import { query } from "../_generated/server";
import { v } from "convex/values";
import { getFamily } from "../lib/auth";

/**
 * Get all custom camps for the current family
 */
export const listCustomCamps = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    return await ctx.db
      .query("customCamps")
      .withIndex("by_family_and_active", (q) =>
        q.eq("familyId", family._id).eq("isActive", true)
      )
      .collect();
  },
});

/**
 * Get custom camps for a specific child
 */
export const listCustomCampsForChild = query({
  args: {
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    // Verify child belongs to family
    const child = await ctx.db.get(args.childId);
    if (!child || child.familyId !== family._id) {
      return [];
    }

    return await ctx.db
      .query("customCamps")
      .withIndex("by_child_and_active", (q) =>
        q.eq("childId", args.childId).eq("isActive", true)
      )
      .collect();
  },
});

/**
 * Get a single custom camp by ID
 */
export const getCustomCamp = query({
  args: {
    customCampId: v.id("customCamps"),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return null;
    }

    const customCamp = await ctx.db.get(args.customCampId);
    if (!customCamp || customCamp.familyId !== family._id) {
      return null;
    }

    return customCamp;
  },
});
