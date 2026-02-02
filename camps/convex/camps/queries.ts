import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List camps for an organization
 */
export const listCamps = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("camps")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

/**
 * Get a camp by ID
 */
export const getCamp = query({
  args: {
    campId: v.id("camps"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.campId);
  },
});

/**
 * Full text search camps in a city
 */
export const searchCamps = query({
  args: {
    query: v.string(),
    cityId: v.id("cities"),
  },
  handler: async (ctx, args) => {
    // First, get organizations in this city
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const orgIdsInCity = organizations
      .filter((org) => org.cityIds.includes(args.cityId))
      .map((org) => org._id);

    if (orgIdsInCity.length === 0) {
      return [];
    }

    // Search camps using the search index
    const searchResults = await ctx.db
      .query("camps")
      .withSearchIndex("search_camps", (q) =>
        q.search("description", args.query).eq("isActive", true)
      )
      .collect();

    // Filter to only camps from organizations in the city
    return searchResults.filter((camp) => orgIdsInCity.includes(camp.organizationId));
  },
});
