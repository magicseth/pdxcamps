import { query, internalQuery } from "../_generated/server";
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

/**
 * Get a city by its domain
 * Used for multi-tenant routing
 */
export const getCityByDomain = query({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Try exact match first
    const city = await ctx.db
      .query("cities")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();

    if (city) return city;

    // Also try without www prefix
    const domainWithoutWww = args.domain.replace(/^www\./, '');
    if (domainWithoutWww !== args.domain) {
      return await ctx.db
        .query("cities")
        .withIndex("by_domain", (q) => q.eq("domain", domainWithoutWww))
        .first();
    }

    return null;
  },
});

// ============ INTERNAL QUERIES (for HTTP actions) ============

/**
 * Internal: Get city by slug for HTTP route
 */
export const getCityBySlugInternal = internalQuery({
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
 * Internal: Get any city that has an icon stored (for fallback)
 */
export const getAnyCityWithIcon = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cities = await ctx.db.query("cities").collect();
    return cities.find(c => c.iconStorageId) || null;
  },
});

/**
 * Internal: Get city by domain for HTTP route
 */
export const getCityByDomainInternal = internalQuery({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Try exact match first
    const city = await ctx.db
      .query("cities")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();

    if (city) return city;

    // Also try without www prefix
    const domainWithoutWww = args.domain.replace(/^www\./, '');
    if (domainWithoutWww !== args.domain) {
      return await ctx.db
        .query("cities")
        .withIndex("by_domain", (q) => q.eq("domain", domainWithoutWww))
        .first();
    }

    return null;
  },
});
