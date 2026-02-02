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
