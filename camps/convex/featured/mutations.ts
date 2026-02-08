import { mutation, internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Create a featured listing for a camp or org.
 */
export const createFeaturedListing = mutation({
  args: {
    organizationId: v.id('organizations'),
    campId: v.optional(v.id('camps')),
    tier: v.union(v.literal('featured'), v.literal('spotlight')),
    durationWeeks: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + args.durationWeeks * 7 * 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert('featuredListings', {
      organizationId: args.organizationId,
      campId: args.campId,
      tier: args.tier,
      startsAt: now,
      expiresAt,
      status: 'active',
      createdAt: now,
    });

    // Mark the camp as featured if specific camp
    if (args.campId) {
      const camp = await ctx.db.get(args.campId);
      if (camp) {
        await ctx.db.patch(args.campId, { isFeatured: true } as any);
      }
    }

    return id;
  },
});

/**
 * Expire outdated featured listings. Called by daily cron.
 */
export const expireFeaturedListings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeListings = await ctx.db
      .query('featuredListings')
      .withIndex('by_status', (q) => q.eq('status', 'active'))
      .collect();

    let expired = 0;
    for (const listing of activeListings) {
      if (listing.expiresAt <= now) {
        await ctx.db.patch(listing._id, { status: 'expired' });

        // Unmark camp as featured
        if (listing.campId) {
          const camp = await ctx.db.get(listing.campId);
          if (camp) {
            await ctx.db.patch(listing.campId, { isFeatured: false } as any);
          }
        }
        expired++;
      }
    }

    return { expired };
  },
});
