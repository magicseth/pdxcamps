import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List active organizations in a city
 */
export const listOrganizations = query({
  args: {
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    // Get all active organizations
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter to organizations that operate in the specified city
    return organizations.filter((org) => org.cityIds.includes(args.cityId));
  },
});

/**
 * Get an organization by ID
 */
export const getOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});

/**
 * Get an organization by its URL slug
 */
export const getOrganizationBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
