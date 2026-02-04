/**
 * Contact Extractor Helpers
 * Internal mutations and queries for contact extraction (non-Node.js)
 */

import { internalMutation, internalQuery } from "../_generated/server";
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
