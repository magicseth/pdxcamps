import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireFamily } from '../lib/auth';

export const submitReview = mutation({
  args: {
    campId: v.id('camps'),
    sessionId: v.optional(v.id('sessions')),
    rating: v.number(),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    yearAttended: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Validate rating
    if (args.rating < 1 || args.rating > 5 || !Number.isInteger(args.rating)) {
      throw new Error('Rating must be an integer between 1 and 5');
    }

    // Check camp exists
    const camp = await ctx.db.get(args.campId);
    if (!camp) {
      throw new Error('Camp not found');
    }

    // Check for existing review by this family for this camp
    const existingReview = await ctx.db
      .query('reviews')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();
    const duplicate = existingReview.find((r) => r.campId === args.campId);
    if (duplicate) {
      throw new Error('You have already reviewed this camp');
    }

    // Auto-verify: check if this family has a registration for any session of this camp
    const registrations = await ctx.db
      .query('registrations')
      .withIndex('by_family', (q) => q.eq('familyId', family._id))
      .collect();

    const sessions = await Promise.all(
      registrations.map((r) => ctx.db.get(r.sessionId)),
    );

    const isVerified = sessions.some(
      (s) => s && s.campId === args.campId,
    );

    return await ctx.db.insert('reviews', {
      familyId: family._id,
      campId: args.campId,
      sessionId: args.sessionId,
      rating: args.rating,
      title: args.title,
      body: args.body,
      yearAttended: args.yearAttended,
      isVerified,
      status: 'published',
      createdAt: Date.now(),
    });
  },
});

export const deleteReview = mutation({
  args: {
    reviewId: v.id('reviews'),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    const review = await ctx.db.get(args.reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    if (review.familyId !== family._id) {
      throw new Error('You can only delete your own reviews');
    }

    await ctx.db.delete(args.reviewId);
  },
});
