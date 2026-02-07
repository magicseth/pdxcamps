import { internalQuery, internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get a family by ID (internal use)
 */
export const getFamilyById = internalQuery({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.familyId);
  },
});

/**
 * Get a family by WorkOS user ID (internal use)
 */
export const getFamilyByWorkosId = internalQuery({
  args: {
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('families')
      .withIndex('by_workos_user_id', (q) => q.eq('workosUserId', args.workosUserId))
      .first();
  },
});

/**
 * Get referral record by family ID (internal use)
 */
export const getReferralByFamily = internalQuery({
  args: {
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerFamilyId', args.familyId))
      .first();
  },
});

/**
 * Mark referral credits as applied (internal use)
 */
export const markCreditApplied = internalMutation({
  args: {
    referralId: v.id('referrals'),
    creditsApplied: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      creditsApplied: args.creditsApplied,
    });
  },
});

/**
 * Get referral record by code (internal use for validation)
 */
export const getReferralByCode = internalQuery({
  args: {
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('referrals')
      .withIndex('by_code', (q) => q.eq('referralCode', args.referralCode))
      .first();
  },
});
