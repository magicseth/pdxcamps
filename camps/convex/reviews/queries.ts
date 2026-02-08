import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getFamily } from '../lib/auth';

export const getReviewsForCamp = query({
  args: {
    campId: v.id('camps'),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_camp_and_status', (q) =>
        q.eq('campId', args.campId).eq('status', 'published'),
      )
      .collect();

    // Sort by createdAt descending
    reviews.sort((a, b) => b.createdAt - a.createdAt);

    // Fetch reviewer display names
    const familyIds = Array.from(new Set(reviews.map((r) => r.familyId)));
    const families = await Promise.all(familyIds.map((id) => ctx.db.get(id)));
    const familyMap = new Map(
      families.filter(Boolean).map((f) => [f!._id, f!]),
    );

    return reviews.map((review) => {
      const family = familyMap.get(review.familyId);
      return {
        ...review,
        reviewerName: family?.displayName ?? 'Anonymous',
      };
    });
  },
});

export const getCampRatingSummary = query({
  args: {
    campId: v.id('camps'),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_camp_and_status', (q) =>
        q.eq('campId', args.campId).eq('status', 'published'),
      )
      .collect();

    if (reviews.length === 0) {
      return { averageRating: 0, reviewCount: 0 };
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return {
      averageRating: Math.round((sum / reviews.length) * 10) / 10,
      reviewCount: reviews.length,
    };
  },
});

export const getMyReviews = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    const reviews = await ctx.db
      .query('reviews')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    // Fetch camp names
    const campIds = Array.from(new Set(reviews.map((r) => r.campId)));
    const camps = await Promise.all(campIds.map((id) => ctx.db.get(id)));
    const campMap = new Map(
      camps.filter(Boolean).map((c) => [c!._id, c!]),
    );

    return reviews.map((review) => ({
      ...review,
      campName: campMap.get(review.campId)?.name ?? 'Unknown Camp',
    }));
  },
});
