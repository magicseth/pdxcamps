import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getFamily, requireFamily } from '../lib/auth';

/**
 * List all children for the current family.
 * Returns only active children by default.
 */
export const listChildren = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    const children = await ctx.db
      .query('children')
      .withIndex('by_family_and_active', (q) => q.eq('familyId', family._id).eq('isActive', true))
      .collect();

    return children;
  },
});

/**
 * Get a specific child by ID.
 * Verifies the child belongs to the current family.
 */
export const getChild = query({
  args: {
    childId: v.id('children'),
  },
  handler: async (ctx, args) => {
    const family = await getFamily(ctx);
    if (!family) {
      return null;
    }

    const child = await ctx.db.get(args.childId);
    if (!child) {
      return null;
    }

    // Verify the child belongs to the current family
    if (child.familyId !== family._id) {
      return null;
    }

    return child;
  },
});
