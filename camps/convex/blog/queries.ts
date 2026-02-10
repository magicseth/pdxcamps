import { query } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get all published blog posts, sorted by publishedAt descending.
 * No auth required - public API for SSR.
 */
export const listPublished = query({
  args: {
    cityId: v.optional(v.id('cities')),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);

    let posts;
    if (args.cityId) {
      // Use compound index to get published posts for this city
      posts = await ctx.db
        .query('blogPosts')
        .withIndex('by_status_city', (q) =>
          q.eq('status', 'published').eq('cityId', args.cityId)
        )
        .collect();
    } else {
      posts = await ctx.db
        .query('blogPosts')
        .withIndex('by_status', (q) => q.eq('status', 'published'))
        .collect();
    }

    if (args.category) {
      posts = posts.filter((p) => p.category === args.category);
    }

    // Sort by publishedAt descending
    posts.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    posts = posts.slice(0, limit);

    // Resolve hero images
    const withImages = await Promise.all(
      posts.map(async (post) => {
        let heroImageUrl: string | undefined;
        if (post.heroImageStorageId) {
          heroImageUrl = (await ctx.storage.getUrl(post.heroImageStorageId)) ?? undefined;
        }
        return {
          _id: post._id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          heroImageUrl,
          category: post.category,
          tags: post.tags,
          publishedAt: post.publishedAt,
        };
      }),
    );

    return withImages;
  },
});

/**
 * Get a single blog post by slug.
 * No auth required - public API for SSR.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query('blogPosts')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    if (!post || post.status !== 'published') {
      return null;
    }

    let heroImageUrl: string | undefined;
    if (post.heroImageStorageId) {
      heroImageUrl = (await ctx.storage.getUrl(post.heroImageStorageId)) ?? undefined;
    }

    return {
      ...post,
      heroImageUrl,
    };
  },
});

/**
 * Get related posts (same category + city, excluding current).
 */
export const getRelated = query({
  args: {
    slug: v.string(),
    category: v.string(),
    cityId: v.optional(v.id('cities')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 3;

    // Use compound index for status+category
    const posts = await ctx.db
      .query('blogPosts')
      .withIndex('by_status_category', (q) =>
        q.eq('status', 'published').eq('category', args.category)
      )
      .collect();

    let filtered = posts.filter((p) => p.slug !== args.slug);
    if (args.cityId) {
      filtered = filtered.filter((p) => p.cityId === args.cityId);
    }

    filtered.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    filtered = filtered.slice(0, limit);

    return filtered.map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      category: p.category,
      publishedAt: p.publishedAt,
    }));
  },
});

/**
 * Get all published post slugs (for sitemap / generateStaticParams).
 */
export const getAllSlugs = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query('blogPosts')
      .withIndex('by_status', (q) => q.eq('status', 'published'))
      .collect();

    return posts.map((p) => ({ slug: p.slug }));
  },
});
