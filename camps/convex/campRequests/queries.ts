import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getFamily } from "../lib/auth";

/**
 * Get all camp requests for the current family
 */
export const listMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const family = await getFamily(ctx);
    if (!family) {
      return [];
    }

    return await ctx.db
      .query("campRequests")
      .withIndex("by_family", (q) => q.eq("familyId", family._id))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single camp request (internal)
 */
export const getRequest = internalQuery({
  args: {
    requestId: v.id("campRequests"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requestId);
  },
});

/**
 * Find scrape source by domain (internal)
 * Searches for sources where the URL contains the domain
 */
export const findSourceByDomain = internalQuery({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all sources and filter by domain in URL
    const sources = await ctx.db.query("scrapeSources").collect();
    return sources.find((s) => {
      try {
        const sourceDomain = new URL(s.url).hostname.replace(/^www\./, "");
        return sourceDomain === args.domain;
      } catch {
        return false;
      }
    }) || null;
  },
});

/**
 * Get pending camp requests (for admin)
 */
export const listPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("campRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(50);
  },
});

/**
 * Get all camp requests with family info (for admin)
 */
export const listAllRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("campRequests")
      .order("desc")
      .take(args.limit || 100);

    // Enrich with family info
    return Promise.all(
      requests.map(async (request) => {
        const family = await ctx.db.get(request.familyId);
        const city = await ctx.db.get(request.cityId);
        return {
          ...request,
          familyEmail: family?.email,
          familyName: family?.displayName,
          cityName: city?.name,
        };
      })
    );
  },
});
