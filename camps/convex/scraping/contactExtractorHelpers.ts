/**
 * Contact Extractor Helpers
 * Internal mutations and queries for contact extraction (non-Node.js)
 */

import { internalMutation, internalQuery, query, mutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Internal mutation to update organization contact info
 * Always records the attempt timestamp to prevent retrying the same orgs
 */
export const updateOrgContactInfo = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, string | number> = {
      // Always record that we attempted extraction
      contactExtractionAttemptedAt: Date.now(),
    };

    if (args.email) {
      updates.email = args.email;
    }
    if (args.phone) {
      updates.phone = args.phone;
    }

    await ctx.db.patch(args.organizationId, updates);
  },
});

/**
 * Public mutation to update organization contact info (for local daemon)
 */
export const saveOrgContactInfo = mutation({
  args: {
    organizationId: v.id('organizations'),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, string | number> = {
      contactExtractionAttemptedAt: Date.now(),
    };

    if (args.email) {
      updates.email = args.email;
    }
    if (args.phone) {
      updates.phone = args.phone;
    }

    await ctx.db.patch(args.organizationId, updates);
  },
});

/**
 * Internal query to get organization details
 */
export const getOrganization = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});

/**
 * Get organizations that need contact extraction
 * (have website but no email, not attempted in last 7 days)
 */
export const getOrgsNeedingContactInfo = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allOrgs = await ctx.db
      .query('organizations')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Filter to orgs with website but no email, not recently attempted
    const needsContact = allOrgs.filter(
      (org) =>
        org.website &&
        !org.email &&
        (!org.contactExtractionAttemptedAt || org.contactExtractionAttemptedAt < sevenDaysAgo),
    );

    return needsContact.slice(0, args.limit ?? 10);
  },
});

/**
 * Get count of orgs needing contact info
 */
export const getContactExtractionStats = query({
  args: {},
  handler: async (ctx) => {
    const allOrgs = await ctx.db
      .query('organizations')
      .withIndex('by_is_active', (q) => q.eq('isActive', true))
      .collect();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const withWebsite = allOrgs.filter((org) => org.website);
    const withEmail = allOrgs.filter((org) => org.email);
    const attempted = allOrgs.filter((org) => org.contactExtractionAttemptedAt);
    const needsExtraction = allOrgs.filter(
      (org) =>
        org.website &&
        !org.email &&
        (!org.contactExtractionAttemptedAt || org.contactExtractionAttemptedAt < sevenDaysAgo),
    );

    return {
      total: allOrgs.length,
      withWebsite: withWebsite.length,
      withEmail: withEmail.length,
      attempted: attempted.length,
      needsExtraction: needsExtraction.length,
    };
  },
});
