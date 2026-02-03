import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { slugify } from "../lib/helpers";
import { ageRangeValidator } from "../lib/validators";

/**
 * Create a new camp
 */
export const createCamp = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    ageRequirements: ageRangeValidator,
    website: v.optional(v.string()),
    imageUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify organization exists
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Generate slug from name
    const baseSlug = slugify(args.name);

    // Check for slug uniqueness and append number if needed
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("camps")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();

      if (!existing) {
        break;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    const campId = await ctx.db.insert("camps", {
      organizationId: args.organizationId,
      name: args.name,
      slug,
      description: args.description,
      categories: args.categories,
      ageRequirements: args.ageRequirements,
      typicalPriceRange: undefined,
      website: args.website,
      imageUrls: args.imageUrls,
      imageStorageIds: [],
      isActive: true,
    });

    return campId;
  },
});

/**
 * Update an existing camp
 */
export const updateCamp = mutation({
  args: {
    campId: v.id("camps"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    ageRequirements: v.optional(ageRangeValidator),
    website: v.optional(v.string()),
    imageUrls: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { campId, ...updates } = args;

    const camp = await ctx.db.get(campId);
    if (!camp) {
      throw new Error("Camp not found");
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
          .query("camps")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();

        if (!existing || existing._id === campId) {
          break;
        }

        counter++;
        slug = `${baseSlug}-${counter}`;
      }
      updateFields.slug = slug;
    }

    if (updates.description !== undefined) {
      updateFields.description = updates.description;
    }
    if (updates.categories !== undefined) {
      updateFields.categories = updates.categories;
    }
    if (updates.ageRequirements !== undefined) {
      updateFields.ageRequirements = updates.ageRequirements;
    }
    if (updates.website !== undefined) {
      updateFields.website = updates.website;
    }
    if (updates.imageUrls !== undefined) {
      updateFields.imageUrls = updates.imageUrls;
    }
    if (updates.isActive !== undefined) {
      updateFields.isActive = updates.isActive;
    }

    await ctx.db.patch(campId, updateFields);

    return campId;
  },
});

/**
 * Update camp images (used by image processing pipeline)
 */
export const updateCampImages = mutation({
  args: {
    campId: v.id("camps"),
    imageStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const camp = await ctx.db.get(args.campId);
    if (!camp) {
      throw new Error("Camp not found");
    }

    await ctx.db.patch(args.campId, {
      imageStorageIds: args.imageStorageIds,
    });

    return args.campId;
  },
});

/**
 * Update camp image style prompt (admin only)
 */
export const updateCampImageStyle = mutation({
  args: {
    campId: v.id("camps"),
    imageStylePrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const camp = await ctx.db.get(args.campId);
    if (!camp) {
      throw new Error("Camp not found");
    }

    await ctx.db.patch(args.campId, {
      imageStylePrompt: args.imageStylePrompt || undefined,
    });

    return args.campId;
  },
});

/**
 * Toggle featured status for a camp (admin only)
 */
export const toggleFeatured = mutation({
  args: {
    campId: v.id("camps"),
  },
  handler: async (ctx, args) => {
    const camp = await ctx.db.get(args.campId);
    if (!camp) {
      throw new Error("Camp not found");
    }

    await ctx.db.patch(args.campId, {
      isFeatured: !camp.isFeatured,
    });

    return { campId: args.campId, isFeatured: !camp.isFeatured };
  },
});
