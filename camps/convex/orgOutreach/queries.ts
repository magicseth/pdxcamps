/**
 * Org Outreach Queries
 *
 * Queries for the admin org outreach pipeline.
 */

import { query, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { checkIsAdmin } from '../lib/adminAuth';

/**
 * Get outreach queue — all orgs with their outreach status.
 * Used for the admin outreach UI.
 */
export const getOutreachQueue = query({
  args: {
    cityId: v.optional(v.id('cities')),
    statusFilter: v.optional(
      v.union(
        v.literal('no_outreach'),
        v.literal('pending'),
        v.literal('sent'),
        v.literal('opened'),
        v.literal('replied'),
        v.literal('bounced'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) return [];

    // Get organizations
    let organizations;
    if (args.cityId) {
      const allOrgs = await ctx.db
        .query('organizations')
        .withIndex('by_is_active', (q) => q.eq('isActive', true))
        .collect();
      organizations = allOrgs.filter((org) => org.cityIds.includes(args.cityId!));
    } else {
      organizations = await ctx.db
        .query('organizations')
        .withIndex('by_is_active', (q) => q.eq('isActive', true))
        .collect();
    }

    // Get outreach records for all these orgs
    const results = await Promise.all(
      organizations.map(async (org) => {
        const outreachRecords = await ctx.db
          .query('orgOutreach')
          .withIndex('by_organization', (q) => q.eq('organizationId', org._id))
          .collect();

        // Get the latest outreach record
        const latestOutreach = outreachRecords.sort((a, b) => b.createdAt - a.createdAt)[0] || null;

        // Count active sessions
        const sessions = await ctx.db
          .query('sessions')
          .withIndex('by_organization_and_status', (q) =>
            q.eq('organizationId', org._id).eq('status', 'active'),
          )
          .collect();

        return {
          _id: org._id,
          name: org.name,
          slug: org.slug,
          email: org.email,
          website: org.website,
          cityIds: org.cityIds,
          sessionCount: sessions.length,
          outreachStatus: (latestOutreach?.status || 'no_outreach') as
            | 'no_outreach'
            | 'pending'
            | 'sent'
            | 'opened'
            | 'replied'
            | 'bounced',
          sequenceStep: latestOutreach?.sequenceStep || 0,
          lastSentAt: latestOutreach?.sentAt || null,
          outreachId: latestOutreach?._id || null,
          followUpCount: latestOutreach?.followUpCount || 0,
        };
      }),
    );

    // Filter by status if requested
    if (args.statusFilter) {
      return results.filter((r) => r.outreachStatus === args.statusFilter);
    }

    return results;
  },
});

/**
 * Get outreach history for a specific organization.
 */
export const getOrgOutreachHistory = query({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) return [];

    return await ctx.db
      .query('orgOutreach')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();
  },
});

/**
 * Get outreach stats for admin dashboard.
 */
export const getOutreachStats = query({
  args: {
    cityId: v.optional(v.id('cities')),
  },
  handler: async (ctx, args) => {
    const isAdmin = await checkIsAdmin(ctx);
    if (!isAdmin) return null;

    let outreachRecords;
    if (args.cityId) {
      outreachRecords = await ctx.db
        .query('orgOutreach')
        .withIndex('by_city', (q) => q.eq('cityId', args.cityId!))
        .collect();
    } else {
      outreachRecords = await ctx.db.query('orgOutreach').collect();
    }

    // Get counts by status
    const statusCounts = {
      pending: 0,
      sent: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
    };
    for (const record of outreachRecords) {
      statusCounts[record.status]++;
    }

    // Get total orgs with email
    let organizations;
    if (args.cityId) {
      const allOrgs = await ctx.db
        .query('organizations')
        .withIndex('by_is_active', (q) => q.eq('isActive', true))
        .collect();
      organizations = allOrgs.filter((org) => org.cityIds.includes(args.cityId!));
    } else {
      organizations = await ctx.db
        .query('organizations')
        .withIndex('by_is_active', (q) => q.eq('isActive', true))
        .collect();
    }

    const withEmail = organizations.filter((o) => o.email).length;
    const contacted = new Set(outreachRecords.map((r) => r.organizationId)).size;

    return {
      totalOrgs: organizations.length,
      withEmail,
      contacted,
      notContacted: withEmail - contacted,
      ...statusCounts,
    };
  },
});

/**
 * Get all pending outreach records (internal, for batch sending).
 */
export const getPendingOutreach = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('orgOutreach')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();
  },
});

/**
 * Internal query to get org data for email sending.
 */
export const getOrgForOutreach = internalQuery({
  args: {
    outreachId: v.id('orgOutreach'),
  },
  handler: async (ctx, args) => {
    const outreach = await ctx.db.get(args.outreachId);
    if (!outreach) return null;

    const org = await ctx.db.get(outreach.organizationId);
    if (!org) return null;

    const city = await ctx.db.get(outreach.cityId);
    if (!city) return null;

    // Count sessions for the org
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_organization_and_status', (q) =>
        q.eq('organizationId', org._id).eq('status', 'active'),
      )
      .collect();

    // Count families in this city
    const families = await ctx.db
      .query('families')
      .withIndex('by_primary_city', (q) => q.eq('primaryCityId', outreach.cityId))
      .collect();

    return {
      outreach,
      org,
      city,
      sessionCount: sessions.length,
      familyCount: families.length,
      brandName: city.brandName || 'PDX Camps',
      domain: city.domain || 'pdxcamps.com',
      fromEmail: city.fromEmail || 'hello@pdxcamps.com',
    };
  },
});
