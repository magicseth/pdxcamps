import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List all active cities
 */
export const listActiveCities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cities")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Get a city by its URL slug
 */
export const getCityBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

/**
 * Get a city by its ID
 */
export const getCityById = query({
  args: {
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cityId);
  },
});

/**
 * List all cities (including inactive) - for migration
 */
export const listAllCities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("cities").collect();
  },
});

/**
 * List all neighborhoods for a city
 */
export const listNeighborhoods = query({
  args: {
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("neighborhoods")
      .withIndex("by_city", (q) => q.eq("cityId", args.cityId))
      .collect();
  },
});
