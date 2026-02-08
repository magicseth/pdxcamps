/**
 * Churn Queries
 *
 * Internal queries for win-back email personalization.
 */

import { internalQuery } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get basic family info for win-back emails.
 */
export const getFamilyForWinback = internalQuery({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    const family = await ctx.db.get(args.familyId);
    if (!family) return null;
    return {
      email: family.email,
      displayName: family.displayName,
      primaryCityId: family.primaryCityId,
    };
  },
});

/**
 * Get the count of saved camps for a family (for win-back personalization).
 */
export const getSavedCampCount = internalQuery({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    const regs = await ctx.db
      .query('registrations')
      .withIndex('by_family_and_status', (q) => q.eq('familyId', args.familyId).eq('status', 'interested'))
      .collect();

    const registered = await ctx.db
      .query('registrations')
      .withIndex('by_family_and_status', (q) => q.eq('familyId', args.familyId).eq('status', 'registered'))
      .collect();

    return regs.length + registered.length;
  },
});
