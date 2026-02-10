"use node";

import { internalAction } from '../_generated/server';
import { internal, components } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// Plan prices in cents — must match Stripe prices
const PLAN_PRICES_CENTS: Record<string, number> = {
  monthly: 499, // $4.99/month
  summer: 2900, // $29/year Summer Pass (one-time)
};

const COMMISSION_RATE = 0.2; // 20%
const FIRST_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Daily cron: scan for new subscription payments from partner-referred families
 * and record commissions.
 */
export const processPartnerCommissions = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all families with partner attribution
    const referredFamilies: Array<{
      _id: Id<'families'>;
      workosUserId: string;
      referredByPartnerCode: string;
    }> = await ctx.runQuery(internal.partners.internals.getReferredFamilies);

    if (referredFamilies.length === 0) return;

    let commissionsCreated = 0;

    for (const family of referredFamilies) {
      try {
        // Look up the partner by code
        const partner = await ctx.runQuery(internal.partners.internals.getPartnerByCode, {
          partnerCode: family.referredByPartnerCode,
        });
        if (!partner) continue;

        // Check first-year cutoff: get earliest commission for this family
        const firstCommission = await ctx.runQuery(
          internal.partners.internals.getFirstCommissionForFamily,
          { familyId: family._id },
        );
        if (firstCommission && Date.now() - firstCommission.createdAt > FIRST_YEAR_MS) {
          continue; // Past first year, skip
        }

        // Check for active subscriptions via Stripe component
        const subscriptions = await ctx.runQuery(
          components.stripe.public.listSubscriptionsByUserId,
          { userId: family.workosUserId },
        );

        const activeSub = subscriptions.find(
          (sub) => sub.status === 'active' || sub.status === 'trialing',
        );
        if (!activeSub) continue;

        // Determine plan from metadata or price
        const plan = activeSub.metadata?.plan || 'monthly';
        const priceCents = PLAN_PRICES_CENTS[plan] || 499;
        const commissionCents = Math.round(priceCents * COMMISSION_RATE);

        // Determine period key for dedup
        const now = new Date();
        let period: string;
        if (plan === 'summer') {
          // One-time: use "onetime-{familyId}" so it only fires once
          period = `onetime-${family._id}`;
        } else {
          // Monthly: "2026-02"
          period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Check if commission already recorded for this partner+period
        const existing = await ctx.runQuery(
          internal.partners.internals.getCommissionByPartnerAndPeriod,
          {
            partnerApplicationId: partner._id,
            period,
            familyId: family._id,
          },
        );
        if (existing) continue;

        // Record commission
        await ctx.runMutation(internal.partners.internals.recordCommission, {
          partnerApplicationId: partner._id,
          familyId: family._id,
          amountCents: priceCents,
          commissionCents,
          plan,
          period,
          stripeSubscriptionId: activeSub.stripeSubscriptionId,
        });

        commissionsCreated++;
      } catch (err) {
        console.error(`Error processing partner commission for family ${family._id}:`, err);
      }
    }

    if (commissionsCreated > 0) {
      console.log(`Partner commissions: created ${commissionsCreated} new commission records`);
    }
  },
});

/**
 * Monthly cron: send earnings digest to all approved partners.
 */
export const sendPartnerDigestBatch = internalAction({
  args: {},
  handler: async (ctx) => {
    const partners = await ctx.runQuery(internal.partners.internals.getApprovedPartners);
    if (partners.length === 0) return;

    const now = new Date();
    const monthLabel = now.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    });

    // Previous month boundaries for "new this month" calculations
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    for (const partner of partners) {
      if (!partner.partnerCode) continue;

      try {
        // Get commissions from last month
        const commissions = await ctx.runQuery(
          internal.partners.internals.getCommissionsForPartnerInRange,
          {
            partnerApplicationId: partner._id,
            startTime: monthStart,
            endTime: monthEnd,
          },
        );

        // Get new referrals from last month
        const newReferrals = await ctx.runQuery(
          internal.partners.internals.countNewReferralsInRange,
          {
            partnerCode: partner.partnerCode,
            startTime: monthStart,
            endTime: monthEnd,
          },
        );

        const newCommissionsCents = commissions.reduce((sum, c) => sum + c.commissionCents, 0);

        await ctx.runAction(internal.partners.notifications.sendPartnerDigestEmail, {
          email: partner.email,
          contactName: partner.contactName,
          organizationName: partner.organizationName,
          partnerCode: partner.partnerCode,
          newReferrals,
          newCommissionsCents,
          totalEarningsCents: partner.totalEarningsCents || 0,
          totalPaidOutCents: partner.totalPaidOutCents || 0,
          monthLabel,
        });
      } catch (err) {
        console.error(`Error sending digest to partner ${partner._id}:`, err);
      }
    }
  },
});
