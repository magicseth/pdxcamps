import { mutation, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { requireFamily } from '../lib/auth';

/**
 * Maximum referral credits a user can earn
 */
export const MAX_REFERRAL_CREDITS = 8;

/**
 * Generate a unique referral code for the current user.
 * Creates a new referral record if one doesn't exist.
 */
export const generateReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const family = await requireFamily(ctx);

    // Check if user already has a referral code
    const existingReferral = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerFamilyId', family._id))
      .first();

    if (existingReferral) {
      return existingReferral.referralCode;
    }

    // Generate a unique 16-char hex code
    const code = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Create the referral record
    await ctx.db.insert('referrals', {
      referrerFamilyId: family._id,
      referralCode: code,
      creditsEarned: 0,
      creditsApplied: 0,
      createdAt: Date.now(),
    });

    return code;
  },
});

/**
 * Internal: Attribute a referral when a new family is created.
 * Called from createFamily when a referral code is provided.
 */
export const attributeReferral = internalMutation({
  args: {
    refereeFamilyId: v.id('families'),
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the referral record for this code
    const referral = await ctx.db
      .query('referrals')
      .withIndex('by_code', (q) => q.eq('referralCode', args.referralCode))
      .first();

    if (!referral) {
      // Invalid referral code - just log and continue
      console.log(`Invalid referral code: ${args.referralCode}`);
      return null;
    }

    // Check if this referee already has a referral event
    const existingEvent = await ctx.db
      .query('referralEvents')
      .withIndex('by_referee', (q) => q.eq('refereeFamilyId', args.refereeFamilyId))
      .first();

    if (existingEvent) {
      console.log(`Referee already has referral event: ${args.refereeFamilyId}`);
      return null;
    }

    // Create a pending referral event
    const eventId = await ctx.db.insert('referralEvents', {
      referralCode: args.referralCode,
      referrerFamilyId: referral.referrerFamilyId,
      refereeFamilyId: args.refereeFamilyId,
      status: 'pending',
      createdAt: Date.now(),
    });

    return eventId;
  },
});

/**
 * Internal: Complete a referral and award credit to the referrer.
 * Called when a referred user completes onboarding.
 */
export const completeReferral = internalMutation({
  args: {
    refereeFamilyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    // Find the pending referral event for this referee
    const event = await ctx.db
      .query('referralEvents')
      .withIndex('by_referee', (q) => q.eq('refereeFamilyId', args.refereeFamilyId))
      .first();

    if (!event || event.status !== 'pending') {
      // No pending referral for this family
      return null;
    }

    // Get the referrer's referral record
    const referral = await ctx.db
      .query('referrals')
      .withIndex('by_referrer', (q) => q.eq('referrerFamilyId', event.referrerFamilyId))
      .first();

    if (!referral) {
      console.log(`Referral record not found for family: ${event.referrerFamilyId}`);
      return null;
    }

    // Check if referrer has hit max credits
    if (referral.creditsEarned >= MAX_REFERRAL_CREDITS) {
      console.log(`Referrer has reached max credits: ${event.referrerFamilyId}`);
      // Still complete the event, just don't award more credits
      await ctx.db.patch(event._id, {
        status: 'completed',
        completedAt: Date.now(),
      });
      return null;
    }

    // Award credit to referrer
    const newCreditsEarned = referral.creditsEarned + 1;
    await ctx.db.patch(referral._id, {
      creditsEarned: newCreditsEarned,
    });

    // Complete the referral event
    await ctx.db.patch(event._id, {
      status: 'completed',
      completedAt: Date.now(),
    });

    // Get referrer's family info for email notification
    const referrerFamily = await ctx.db.get(event.referrerFamilyId);
    if (referrerFamily) {
      // Get city for branding
      const city = await ctx.db.get(referrerFamily.primaryCityId);

      // Schedule email notification
      await ctx.scheduler.runAfter(0, internal.email.sendReferralCreditEarnedEmail, {
        to: referrerFamily.email,
        displayName: referrerFamily.displayName,
        creditsEarned: newCreditsEarned,
        maxCredits: MAX_REFERRAL_CREDITS,
        brandName: city?.brandName,
        domain: city?.domain,
        fromEmail: city?.fromEmail,
      });
    }

    return {
      referrerId: event.referrerFamilyId,
      newCreditsEarned,
    };
  },
});
