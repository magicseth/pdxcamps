'use node';

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import Stripe from 'stripe';

/**
 * Amount of referral credit in cents ($5 = 1 month)
 */
const REFERRAL_CREDIT_AMOUNT_CENTS = 500;

/**
 * Apply referral credits when a user subscribes.
 * Called after successful subscription creation.
 * Takes a Stripe customer ID directly (obtained from webhook/subscription context).
 */
export const applyReferralCredits = internalAction({
  args: {
    familyId: v.id('families'),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; creditsApplied?: number; error?: string }> => {
    // Get the referral record to check available credits
    const referral = await ctx.runQuery(internal.referrals.internal.getReferralByFamily, {
      familyId: args.familyId,
    });

    if (!referral) {
      return { success: true, creditsApplied: 0 };
    }

    const creditsAvailable = referral.creditsEarned - referral.creditsApplied;
    if (creditsAvailable <= 0) {
      return { success: true, creditsApplied: 0 };
    }

    // Apply all available credits via Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    try {
      for (let i = 0; i < creditsAvailable; i++) {
        await stripe.invoiceItems.create({
          customer: args.stripeCustomerId,
          amount: -REFERRAL_CREDIT_AMOUNT_CENTS,
          currency: 'usd',
          description: 'Referral credit - 1 month free',
        });
      }

      // Mark all credits as applied
      await ctx.runMutation(internal.referrals.internal.markCreditApplied, {
        referralId: referral._id,
        creditsApplied: referral.creditsEarned,
      });

      console.log(`Applied ${creditsAvailable} referral credits for family: ${args.familyId}`);
      return { success: true, creditsApplied: creditsAvailable };
    } catch (error) {
      console.error(`Failed to apply referral credits:`, error);
      return { success: false, error: String(error) };
    }
  },
});
