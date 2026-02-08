import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Create a new blog post (internal only - called by generation action).
 */
export const create = internalMutation({
  args: {
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    excerpt: v.string(),
    heroImageStorageId: v.optional(v.id('_storage')),
    cityId: v.optional(v.id('cities')),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    generatedBy: v.optional(v.union(v.literal('claude'), v.literal('manual'))),
    publish: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const publish = args.publish ?? false;

    // Check for duplicate slug
    const existing = await ctx.db
      .query('blogPosts')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    if (existing) {
      // Update existing post instead
      await ctx.db.patch(existing._id, {
        title: args.title,
        content: args.content,
        excerpt: args.excerpt,
        heroImageStorageId: args.heroImageStorageId,
        cityId: args.cityId,
        category: args.category,
        tags: args.tags,
        metaTitle: args.metaTitle,
        metaDescription: args.metaDescription,
        generatedBy: args.generatedBy,
        generatedAt: now,
        updatedAt: now,
        ...(publish && !existing.publishedAt
          ? { status: 'published' as const, publishedAt: now }
          : {}),
      });
      return existing._id;
    }

    return await ctx.db.insert('blogPosts', {
      title: args.title,
      slug: args.slug,
      content: args.content,
      excerpt: args.excerpt,
      heroImageStorageId: args.heroImageStorageId,
      cityId: args.cityId,
      category: args.category,
      tags: args.tags,
      metaTitle: args.metaTitle,
      metaDescription: args.metaDescription,
      generatedBy: args.generatedBy,
      generatedAt: now,
      status: publish ? 'published' : 'draft',
      publishedAt: publish ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});
