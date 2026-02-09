import { internalQuery, internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Get all families that were referred by a partner.
 */
export const getReferredFamilies = internalQuery({
  args: {},
  handler: async (ctx) => {
    const families = await ctx.db.query('families').collect();
    return families
      .filter((f) => f.referredByPartnerCode)
      .map((f) => ({
        _id: f._id,
        workosUserId: f.workosUserId,
        referredByPartnerCode: f.referredByPartnerCode!,
      }));
  },
});

/**
 * Look up a partner application by partner code.
 */
export const getPartnerByCode = internalQuery({
  args: { partnerCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('partnerApplications')
      .withIndex('by_partner_code', (q) => q.eq('partnerCode', args.partnerCode))
      .first();
  },
});

/**
 * Get the earliest commission for a given family (for first-year cutoff).
 */
export const getFirstCommissionForFamily = internalQuery({
  args: { familyId: v.id('families') },
  handler: async (ctx, args) => {
    const commissions = await ctx.db
      .query('partnerCommissions')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .order('asc')
      .first();
    return commissions;
  },
});

/**
 * Check for existing commission by partner + period + family (dedup).
 */
export const getCommissionByPartnerAndPeriod = internalQuery({
  args: {
    partnerApplicationId: v.id('partnerApplications'),
    period: v.string(),
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    const commissions = await ctx.db
      .query('partnerCommissions')
      .withIndex('by_partner_and_period', (q) =>
        q.eq('partnerApplicationId', args.partnerApplicationId).eq('period', args.period),
      )
      .collect();
    return commissions.find((c) => c.familyId === args.familyId) || null;
  },
});

/**
 * Record a new commission and update partner earnings.
 */
export const recordCommission = internalMutation({
  args: {
    partnerApplicationId: v.id('partnerApplications'),
    familyId: v.id('families'),
    amountCents: v.number(),
    commissionCents: v.number(),
    plan: v.string(),
    period: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('partnerCommissions', {
      partnerApplicationId: args.partnerApplicationId,
      familyId: args.familyId,
      amountCents: args.amountCents,
      commissionCents: args.commissionCents,
      plan: args.plan,
      period: args.period,
      stripeSubscriptionId: args.stripeSubscriptionId,
      createdAt: Date.now(),
    });

    // Update partner running totals
    const partner = await ctx.db.get(args.partnerApplicationId);
    if (partner) {
      await ctx.db.patch(args.partnerApplicationId, {
        totalEarningsCents: (partner.totalEarningsCents || 0) + args.commissionCents,
      });
    }
  },
});

/**
 * Get all approved partners.
 */
export const getApprovedPartners = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('partnerApplications')
      .withIndex('by_status', (q) => q.eq('status', 'approved'))
      .collect();
  },
});

/**
 * Get commissions for a partner in a given time range.
 */
export const getCommissionsForPartnerInRange = internalQuery({
  args: {
    partnerApplicationId: v.id('partnerApplications'),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const commissions = await ctx.db
      .query('partnerCommissions')
      .withIndex('by_partner', (q) => q.eq('partnerApplicationId', args.partnerApplicationId))
      .collect();
    return commissions.filter((c) => c.createdAt >= args.startTime && c.createdAt < args.endTime);
  },
});

/**
 * Count families referred by a partner in a given time range.
 */
export const countNewReferralsInRange = internalQuery({
  args: {
    partnerCode: v.string(),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const families = await ctx.db
      .query('families')
      .filter((q) => q.eq(q.field('referredByPartnerCode'), args.partnerCode))
      .collect();
    // Use _creationTime for when the family was created
    return families.filter(
      (f) => f._creationTime >= args.startTime && f._creationTime < args.endTime,
    ).length;
  },
});
