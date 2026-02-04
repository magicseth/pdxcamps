/**
 * Contact Extractor Helpers
 * Internal mutations and queries for contact extraction (non-Node.js)
 */

import { internalMutation, internalQuery, query, mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation to update organization contact info
 */
export const updateOrgContactInfo = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, string> = {};

    if (args.email) {
      updates.email = args.email;
    }
    if (args.phone) {
      updates.phone = args.phone;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.organizationId, updates);
    }
  },
});

/**
 * Internal query to get organization details
 */
export const getOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});

/**
 * Get organizations that need contact extraction
 * (have website but no email)
 */
export const getOrgsNeedingContactInfo = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allOrgs = await ctx.db
      .query("organizations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter to orgs with website but no email
    const needsContact = allOrgs.filter(
      (org) => org.website && !org.email
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
      .query("organizations")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();

    const withWebsite = allOrgs.filter((org) => org.website);
    const withEmail = allOrgs.filter((org) => org.email);
    const needsExtraction = allOrgs.filter((org) => org.website && !org.email);

    return {
      total: allOrgs.length,
      withWebsite: withWebsite.length,
      withEmail: withEmail.length,
      needsExtraction: needsExtraction.length,
    };
  },
});
