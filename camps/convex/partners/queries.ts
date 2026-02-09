import { query } from '../_generated/server';
import { v } from 'convex/values';
import { checkIsAdmin } from '../lib/adminAuth';
import { Doc } from '../_generated/dataModel';

/**
 * List all partner applications with stats — admin only.
 */
export const listPartnerApplications = query({
  args: {
    statusFilter: v.optional(v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'))),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) return [];

    let applications;
    if (args.statusFilter) {
      applications = await ctx.db
        .query('partnerApplications')
        .withIndex('by_status', (q) => q.eq('status', args.statusFilter!))
        .order('desc')
        .collect();
    } else {
      applications = await ctx.db.query('partnerApplications').order('desc').collect();
    }

    // Enrich approved partners with referred family counts
    const enriched = await Promise.all(
      applications.map(async (app) => {
        let referredFamilyCount = 0;
        let totalCommissionsCents = 0;

        if (app.status === 'approved' && app.partnerCode) {
          // Count families referred by this partner
          const families = await ctx.db
            .query('families')
            .filter((q) => q.eq(q.field('referredByPartnerCode'), app.partnerCode))
            .collect();
          referredFamilyCount = families.length;

          // Sum commissions
          const commissions = await ctx.db
            .query('partnerCommissions')
            .withIndex('by_partner', (q) => q.eq('partnerApplicationId', app._id))
            .collect();
          totalCommissionsCents = commissions.reduce((sum, c) => sum + c.commissionCents, 0);
        }

        return {
          ...app,
          referredFamilyCount,
          totalCommissionsCents,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get aggregate stats for the partner dashboard — admin only.
 */
export const getPartnerStats = query({
  args: {},
  handler: async (ctx) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) return null;

    const all = await ctx.db.query('partnerApplications').collect();
    const allCommissions = await ctx.db.query('partnerCommissions').collect();

    return {
      totalApplications: all.length,
      pending: all.filter((a) => a.status === 'pending').length,
      approved: all.filter((a) => a.status === 'approved').length,
      rejected: all.filter((a) => a.status === 'rejected').length,
      totalCommissionsCents: allCommissions.reduce((sum, c) => sum + c.commissionCents, 0),
    };
  },
});

/**
 * Get dashboard data for the currently authenticated partner.
 * Returns null if the user is not an approved partner.
 */
export const getMyPartnerDashboard = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const email = identity.email;
    if (!email) return null;

    const application = await ctx.db
      .query('partnerApplications')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!application) return null;

    // Return minimal info for non-approved partners
    if (application.status !== 'approved' || !application.partnerCode) {
      return {
        status: application.status as 'pending' | 'rejected',
        organizationName: application.organizationName,
        contactName: application.contactName,
        partnerCode: null,
        partnerLink: null,
        approvedAt: null,
        referredFamilyCount: 0,
        totalEarningsCents: 0,
        totalPaidOutCents: 0,
        commissions: [] as Array<Doc<'partnerCommissions'>>,
      };
    }

    // Approved partner — gather stats
    const families = await ctx.db
      .query('families')
      .filter((q) => q.eq(q.field('referredByPartnerCode'), application.partnerCode))
      .collect();

    const commissions = await ctx.db
      .query('partnerCommissions')
      .withIndex('by_partner', (q) => q.eq('partnerApplicationId', application._id))
      .order('desc')
      .collect();

    const totalEarningsCents = commissions.reduce((sum, c) => sum + c.commissionCents, 0);

    return {
      status: 'approved' as const,
      organizationName: application.organizationName,
      contactName: application.contactName,
      partnerCode: application.partnerCode,
      partnerLink: `https://pdxcamps.com/p/${application.partnerCode}`,
      approvedAt: application.approvedAt ?? null,
      referredFamilyCount: families.length,
      totalEarningsCents,
      totalPaidOutCents: application.totalPaidOutCents ?? 0,
      commissions,
    };
  },
});
