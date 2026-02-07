import { query } from '../_generated/server';
import { getFamily } from '../lib/auth';
import { MAX_REFERRAL_CREDITS } from './mutations';

/**
 * Get the current user's referral info.
 * Returns null if user is not authenticated or has no referral code yet.
 */
export const getReferralInfo = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return null;
    }

    // Get the referral record
    const referral = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerFamilyId', family._id))
      .first();

    if (!referral) {
      return {
        hasCode: false,
        referralCode: null,
        creditsEarned: 0,
        creditsApplied: 0,
        creditsAvailable: 0,
        maxCredits: MAX_REFERRAL_CREDITS,
      };
    }

    return {
      hasCode: true,
      referralCode: referral.referralCode,
      creditsEarned: referral.creditsEarned,
      creditsApplied: referral.creditsApplied,
      creditsAvailable: referral.creditsEarned - referral.creditsApplied,
      maxCredits: MAX_REFERRAL_CREDITS,
    };
  },
});

/**
 * Get a list of referral events for the current user (as referrer).
 */
export const listReferralEvents = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    const events = await ctx.db
      .query('referralEvents')
      .withIndex('by_referrer', (q) => q.eq('referrerFamilyId', family._id))
      .collect();

    return events.map((e) => ({
      status: e.status,
      createdAt: e.createdAt,
      completedAt: e.completedAt,
    }));
  },
});
