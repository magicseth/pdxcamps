import { query } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Status values for discovered sources
 */
const discoveredSourceStatusValidator = v.union(
  v.literal('pending_analysis'),
  v.literal('pending_review'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('scraper_generated'),
  v.literal('duplicate'),
);

/**
 * Get discovered sources pending review for a city
 * Returns sources filtered by city and optional status
 */
export const getDiscoveryQueue = query({
  args: {
    cityId: v.id('cities'),
    status: v.optional(discoveredSourceStatusValidator),
  },
  handler: async (ctx, args) => {
    // If status is provided, filter by it
    if (args.status) {
      return await ctx.db
        .query('discoveredSources')
        .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', args.status!))
        .order('desc')
        .collect();
    }

    // Otherwise, return all pending sources (pending_analysis and pending_review)
    const pendingAnalysis = await ctx.db
      .query('discoveredSources')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'pending_analysis'))
      .order('desc')
      .collect();

    const pendingReview = await ctx.db
      .query('discoveredSources')
      .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', 'pending_review'))
      .order('desc')
      .collect();

    // Combine and sort by discoveredAt descending
    return [...pendingAnalysis, ...pendingReview].sort((a, b) => b.discoveredAt - a.discoveredAt);
  },
});

/**
 * Get a single discovered source with its AI analysis
 */
export const getDiscoveredSource = query({
  args: {
    sourceId: v.id('discoveredSources'),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      return null;
    }

    // Optionally fetch the linked scrape source if it exists
    let scrapeSource = null;
    if (source.scrapeSourceId) {
      scrapeSource = await ctx.db.get(source.scrapeSourceId);
    }

    return {
      ...source,
      scrapeSource,
    };
  },
});

/**
 * List recent discovery searches for a city
 * Used for analytics and avoiding duplicate searches
 */
export const listDiscoverySearches = query({
  args: {
    cityId: v.id('cities'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    return await ctx.db
      .query('discoverySearches')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .order('desc')
      .take(limit);
  },
});

/**
 * Get discovery statistics for the admin dashboard
 * Returns counts of discovered sources by status
 */
export const getDiscoveryStats = query({
  args: {
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    // Get counts for each status
    const statuses = [
      'pending_analysis',
      'pending_review',
      'approved',
      'rejected',
      'scraper_generated',
      'duplicate',
    ] as const;

    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const sources = await ctx.db
        .query('discoveredSources')
        .withIndex('by_city_and_status', (q) => q.eq('cityId', args.cityId).eq('status', status))
        .collect();
      counts[status] = sources.length;
    }

    // Get recent search stats
    const recentSearches = await ctx.db
      .query('discoverySearches')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .order('desc')
      .take(10);

    const totalSearches = await ctx.db
      .query('discoverySearches')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    return {
      byStatus: counts,
      totalDiscovered:
        counts.pending_analysis +
        counts.pending_review +
        counts.approved +
        counts.rejected +
        counts.scraper_generated +
        counts.duplicate,
      actionableCount: counts.pending_analysis + counts.pending_review,
      totalSearches: totalSearches.length,
      recentSearches: recentSearches.map((s) => ({
        query: s.query,
        resultsCount: s.resultsCount,
        newSourcesFound: s.newSourcesFound,
        executedAt: s.executedAt,
      })),
    };
  },
});
