import { mutation, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { slugify } from '../lib/helpers';

/**
 * Create a new organization (admin only)
 */
export const createOrganization = mutation({
  args: {
    name: v.string(),
    website: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    description: v.optional(v.string()),
    cityIds: v.array(v.id('cities')),
  },
  handler: async (ctx, args) => {
    // Generate slug from name
    const baseSlug = slugify(args.name);

    // Check for slug uniqueness and append number if needed
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query('organizations')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .unique();

      if (!existing) {
        break;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    const organizationId = await ctx.db.insert('organizations', {
      name: args.name,
      slug,
      website: args.website,
      email: args.email,
      phone: args.phone,
      description: args.description,
      cityIds: args.cityIds,
      logoStorageId: undefined,
      isVerified: false,
      isActive: true,
    });

    return organizationId;
  },
});

/**
 * Update an existing organization
 */
export const updateOrganization = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.optional(v.string()),
    website: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    description: v.optional(v.string()),
    cityIds: v.optional(v.array(v.id('cities'))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organizationId, ...updates } = args;

    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    // Build update object with only defined fields
    const updateFields: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      updateFields.name = updates.name;
      // If name changes, update slug too
      const baseSlug = slugify(updates.name);
      let slug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await ctx.db
          .query('organizations')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .unique();

        if (!existing || existing._id === organizationId) {
          break;
        }

        counter++;
        slug = `${baseSlug}-${counter}`;
      }
      updateFields.slug = slug;
    }

    if (updates.website !== undefined) {
      updateFields.website = updates.website;
    }
    if (updates.email !== undefined) {
      updateFields.email = updates.email;
    }
    if (updates.phone !== undefined) {
      updateFields.phone = updates.phone;
    }
    if (updates.description !== undefined) {
      updateFields.description = updates.description;
    }
    if (updates.cityIds !== undefined) {
      updateFields.cityIds = updates.cityIds;
    }
    if (updates.isActive !== undefined) {
      updateFields.isActive = updates.isActive;
    }

    await ctx.db.patch(organizationId, updateFields);

    return organizationId;
  },
});

/**
 * Update organization logo storage ID (internal - used by logo population action)
 */
export const updateOrgLogo = internalMutation({
  args: {
    orgId: v.id('organizations'),
    logoStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      logoStorageId: args.logoStorageId,
    });
  },
});

/**
 * Update organization website and logo (internal - used by fix action)
 */
export const updateOrgWebsiteAndLogo = internalMutation({
  args: {
    orgId: v.id('organizations'),
    website: v.string(),
    logoStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      website: args.website,
      logoStorageId: args.logoStorageId,
    });
  },
});

/**
 * Clear logo from organization (for re-fetching)
 */
export const clearOrgLogo = internalMutation({
  args: {
    orgId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      logoStorageId: undefined,
    });
  },
});

/**
 * Clear all organization logos (for mass re-fetch)
 */
export const clearAllOrgLogos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query('organizations').collect();
    let cleared = 0;
    for (const org of orgs) {
      if (org.logoStorageId) {
        await ctx.db.patch(org._id, { logoStorageId: undefined });
        cleared++;
      }
    }
    return { cleared };
  },
});

/**
 * Fix organization website URL (add https:// if missing)
 */
export const fixOrgWebsite = internalMutation({
  args: {
    orgId: v.id('organizations'),
    website: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      website: args.website,
    });
  },
});

/**
 * Update organization website only (internal)
 */
export const updateOrgWebsite = internalMutation({
  args: {
    orgId: v.id('organizations'),
    website: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      website: args.website,
    });
  },
});
