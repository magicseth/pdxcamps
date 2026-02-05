import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List locations with optional city and organization filters
 */
export const listLocations = query({
  args: {
    cityId: v.optional(v.id("cities")),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    // Use the most specific index available
    if (args.organizationId) {
      const locations = await ctx.db
        .query("locations")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect();

      // Filter by city if also specified
      if (args.cityId) {
        return locations.filter(
          (location) => location.cityId === args.cityId && location.isActive
        );
      }

      return locations.filter((location) => location.isActive);
    }

    if (args.cityId) {
      const cityId = args.cityId;
      return await ctx.db
        .query("locations")
        .withIndex("by_city_and_active", (q) =>
          q.eq("cityId", cityId).eq("isActive", true)
        )
        .collect();
    }

    // No filters - return all active locations
    return await ctx.db
      .query("locations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * List all locations (including inactive) - for migration
 */
export const listAllLocations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("locations").collect();
  },
});

/**
 * Get a location by ID
 */
export const getLocation = query({
  args: {
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.locationId);
  },
});
