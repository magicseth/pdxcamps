import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Helper to convert a name to a URL-friendly slug
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Seed Portland, OR data with neighborhoods
 * Idempotent - will not create duplicates if Portland already exists
 */
export const seedPortland = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if Portland already exists
    const existingPortland = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", "portland"))
      .unique();

    if (existingPortland) {
      return {
        success: true,
        message: "Portland already exists",
        cityId: existingPortland._id,
        created: false,
      };
    }

    // Create Portland
    const cityId = await ctx.db.insert("cities", {
      name: "Portland",
      slug: "portland",
      state: "OR",
      timezone: "America/Los_Angeles",
      isActive: true,
      centerLatitude: 45.5152,
      centerLongitude: -122.6784,
    });

    // Portland neighborhoods
    const neighborhoods = [
      "Alberta Arts District",
      "Alameda",
      "Beaumont-Wilshire",
      "Boise",
      "Brooklyn",
      "Buckman",
      "Division",
      "Downtown",
      "Eastmoreland",
      "Hawthorne",
      "Hollywood",
      "Irvington",
      "Kerns",
      "Laurelhurst",
      "Mississippi",
      "Montavilla",
      "Mt. Tabor",
      "Nob Hill",
      "Northeast Portland",
      "Northwest Portland",
      "Pearl District",
      "Richmond",
      "Rose City Park",
      "Sellwood-Moreland",
      "St. Johns",
      "Sunnyside",
      "University Park",
      "Woodstock",
    ];

    // Insert all neighborhoods
    for (const name of neighborhoods) {
      await ctx.db.insert("neighborhoods", {
        cityId,
        name,
        slug: toSlug(name),
      });
    }

    return {
      success: true,
      message: "Portland created with neighborhoods",
      cityId,
      created: true,
      neighborhoodCount: neighborhoods.length,
    };
  },
});

/**
 * Admin mutation to create a new city
 */
export const createCity = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    state: v.string(),
    timezone: v.string(),
    centerLatitude: v.number(),
    centerLongitude: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if slug already exists
    const existingCity = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existingCity) {
      throw new Error(`City with slug "${args.slug}" already exists`);
    }

    const cityId = await ctx.db.insert("cities", {
      name: args.name,
      slug: args.slug,
      state: args.state,
      timezone: args.timezone,
      isActive: true,
      centerLatitude: args.centerLatitude,
      centerLongitude: args.centerLongitude,
    });

    return { cityId };
  },
});

/**
 * Admin mutation to set brand info for a city
 */
export const setCityBrand = mutation({
  args: {
    cityId: v.id("cities"),
    brandName: v.string(),
    domain: v.string(),
    fromEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    await ctx.db.patch(args.cityId, {
      brandName: args.brandName,
      domain: args.domain,
      fromEmail: args.fromEmail,
    });

    return { success: true, cityId: args.cityId };
  },
});

/**
 * Admin mutation to set brand info for all cities by slug mapping
 */
export const setBrandInfoForAllCities = mutation({
  args: {},
  handler: async (ctx) => {
    // Brand mapping by city slug
    const brandMapping: Record<string, { brandName: string; domain: string; fromEmail: string }> = {
      portland: {
        brandName: "PDX Camps",
        domain: "pdxcamps.com",
        fromEmail: "hello@pdxcamps.com",
      },
      boston: {
        brandName: "BOS Camps",
        domain: "boscamps.com",
        fromEmail: "hello@boscamps.com",
      },
    };

    const cities = await ctx.db.query("cities").collect();
    const updates: string[] = [];

    for (const city of cities) {
      const brand = brandMapping[city.slug];
      if (brand) {
        await ctx.db.patch(city._id, {
          brandName: brand.brandName,
          domain: brand.domain,
          fromEmail: brand.fromEmail,
        });
        updates.push(`${city.name}: ${brand.brandName}`);
      }
    }

    return { success: true, updated: updates };
  },
});

/**
 * Admin mutation to update city info
 */
export const updateCity = mutation({
  args: {
    cityId: v.id("cities"),
    name: v.optional(v.string()),
    brandName: v.optional(v.string()),
    domain: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    const updates: Partial<typeof city> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.brandName !== undefined) updates.brandName = args.brandName;
    if (args.domain !== undefined) updates.domain = args.domain;
    if (args.fromEmail !== undefined) updates.fromEmail = args.fromEmail;

    await ctx.db.patch(args.cityId, updates);

    return { success: true, cityId: args.cityId };
  },
});

/**
 * Set icon storage ID for a city
 */
export const setCityIcon = mutation({
  args: {
    cityId: v.id("cities"),
    iconStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    await ctx.db.patch(args.cityId, {
      iconStorageId: args.iconStorageId,
    });

    return { success: true };
  },
});

/**
 * Set header image storage ID for a city
 */
export const setCityHeaderImage = mutation({
  args: {
    cityId: v.id("cities"),
    headerImageStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    await ctx.db.patch(args.cityId, {
      headerImageStorageId: args.headerImageStorageId,
    });

    return { success: true };
  },
});

/**
 * Admin mutation to create a new neighborhood
 */
export const createNeighborhood = mutation({
  args: {
    cityId: v.id("cities"),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify city exists
    const city = await ctx.db.get(args.cityId);
    if (!city) {
      throw new Error("City not found");
    }

    // Check if neighborhood slug already exists for this city
    const existingNeighborhood = await ctx.db
      .query("neighborhoods")
      .withIndex("by_city_and_slug", (q) =>
        q.eq("cityId", args.cityId).eq("slug", args.slug)
      )
      .unique();

    if (existingNeighborhood) {
      throw new Error(
        `Neighborhood with slug "${args.slug}" already exists in this city`
      );
    }

    const neighborhoodId = await ctx.db.insert("neighborhoods", {
      cityId: args.cityId,
      name: args.name,
      slug: args.slug,
    });

    return { neighborhoodId };
  },
});
