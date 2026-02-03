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
    const cityOrgs = organizations.filter((org) => org.cityIds.includes(args.cityId));

    // Resolve logo URLs from storage
    return Promise.all(
      cityOrgs.map(async (org) => {
        let resolvedLogoUrl: string | null = null;
        if (org.logoStorageId) {
          resolvedLogoUrl = await ctx.storage.getUrl(org.logoStorageId);
        }
        return {
          ...org,
          logoUrl: resolvedLogoUrl,
        };
      })
    );
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
    const org = await ctx.db.get(args.organizationId);
    if (!org) return null;

    // Resolve logo URL from storage
    let resolvedLogoUrl: string | null = null;
    if (org.logoStorageId) {
      resolvedLogoUrl = await ctx.storage.getUrl(org.logoStorageId);
    }

    return {
      ...org,
      logoUrl: resolvedLogoUrl,
    };
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

/**
 * List all organizations (for admin/logo processing)
 */
export const listAllOrganizations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

/**
 * List organizations with pagination and counts (single query)
 */
export const listOrganizationsPaginated = query({
  args: {
    cityId: v.optional(v.id("cities")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let organizations;
    if (args.cityId) {
      // Get all active orgs and filter by city
      const allOrgs = await ctx.db
        .query("organizations")
        .withIndex("by_is_active", (q) => q.eq("isActive", true))
        .collect();
      organizations = allOrgs.filter((org) => org.cityIds.includes(args.cityId!));
    } else {
      organizations = await ctx.db.query("organizations").collect();
    }

    // Calculate counts from same data
    const counts = {
      total: organizations.length,
      withLogo: organizations.filter((o) => o.logoStorageId || o.logoUrl).length,
      withoutLogo: organizations.filter((o) => !o.logoStorageId && !o.logoUrl).length,
      withWebsite: organizations.filter((o) => o.website).length,
    };

    const totalCount = organizations.length;
    const paginated = organizations.slice(0, limit);

    return {
      organizations: paginated,
      counts,
      totalCount,
      hasMore: totalCount > limit,
    };
  },
});

/**
 * Get organizations with logos for landing page showcase
 */
export const getOrganizationsWithLogos = query({
  args: {
    citySlug: v.string(),
  },
  handler: async (ctx, args) => {
    // Get city by slug
    const city = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.citySlug))
      .unique();

    if (!city) return [];

    // Get all active organizations with logos
    const organizations = await ctx.db
      .query("organizations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter to orgs in this city with logos
    const orgsWithLogos = organizations.filter(
      (org) => org.cityIds.includes(city._id) && org.logoStorageId
    );

    // Resolve logo URLs and return
    const results = await Promise.all(
      orgsWithLogos.map(async (org) => {
        const logoUrl = await ctx.storage.getUrl(org.logoStorageId!);
        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          logoUrl,
          website: org.website,
        };
      })
    );

    // Filter out any with null logo URLs and sort by name
    return results
      .filter((org) => org.logoUrl)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});
