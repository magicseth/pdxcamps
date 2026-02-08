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
 * Check if the current user was referred (for referee reward display).
 * Returns the referral status and whether they're eligible for a discount.
 */
export const getMyReferralStatus = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) return null;

    if (!family.referredByCode) {
      return { wasReferred: false, referrerName: null };
    }

    // Look up who referred them
    const referral = await ctx.db
      .query('referrals')
      .withIndex('by_code', (q) => q.eq('referralCode', family.referredByCode!))
      .first();

    let referrerName: string | null = null;
    if (referral) {
      const referrerFamily = await ctx.db.get(referral.referrerFamilyId);
      if (referrerFamily) {
        referrerName = referrerFamily.displayName;
      }
    }

    return {
      wasReferred: true,
      referrerName,
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
