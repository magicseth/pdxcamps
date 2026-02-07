/**
 * Coverage Comparison
 *
 * Compares our scrape sources against reference camp listings
 * to identify gaps in coverage.
 */

import { query, mutation } from '../_generated/server';
import { v } from 'convex/values';
import { similarity } from './deduplication';

interface ReferenceCamp {
  name: string;
  url?: string;
}

interface CoverageResult {
  totalReference: number;
  inOurSystem: number;
  missing: ReferenceCamp[];
  coveragePercent: string;
  matches: Array<{
    referenceName: string;
    matchedSourceName: string;
    similarity: number;
  }>;
}

/**
 * Compare our sources against a reference list of camps
 */
export const compareCoverage = query({
  args: {
    referenceCamps: v.array(
      v.object({
        name: v.string(),
        url: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<CoverageResult> => {
    const ourSources = await ctx.db.query('scrapeSources').collect();

    const missing: ReferenceCamp[] = [];
    const matches: CoverageResult['matches'] = [];

    for (const ref of args.referenceCamps) {
      let bestMatch: { source: (typeof ourSources)[0]; score: number } | null = null;

      for (const source of ourSources) {
        const score = similarity(source.name, ref.name);
        if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { source, score };
        }
      }

      if (bestMatch) {
        matches.push({
          referenceName: ref.name,
          matchedSourceName: bestMatch.source.name,
          similarity: Math.round(bestMatch.score * 100),
        });
      } else {
        missing.push(ref);
      }
    }

    const inOurSystem = args.referenceCamps.length - missing.length;
    const coveragePercent =
      args.referenceCamps.length > 0 ? ((inOurSystem / args.referenceCamps.length) * 100).toFixed(1) : '0';

    return {
      totalReference: args.referenceCamps.length,
      inOurSystem,
      missing,
      coveragePercent,
      matches,
    };
  },
});

/**
 * Get coverage stats for the dashboard
 */
export const getCoverageStats = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query('scrapeSources').collect();
    const activeSources = sources.filter((s) => s.isActive);

    // Count sources with data
    const sourcesWithData = sources.filter((s) => (s.sessionCount ?? 0) > 0);

    // Count by quality tier
    const highQuality = sources.filter((s) => s.qualityTier === 'high');
    const mediumQuality = sources.filter((s) => s.qualityTier === 'medium');
    const lowQuality = sources.filter((s) => s.qualityTier === 'low');

    return {
      totalSources: sources.length,
      activeSources: activeSources.length,
      sourcesWithData: sourcesWithData.length,
      qualityBreakdown: {
        high: highQuality.length,
        medium: mediumQuality.length,
        low: lowQuality.length,
        unrated: sources.length - highQuality.length - mediumQuality.length - lowQuality.length,
      },
      dataSuccessRate: activeSources.length > 0 ? Math.round((sourcesWithData.length / activeSources.length) * 100) : 0,
    };
  },
});

/**
 * Quick add a source from a reference camp
 */
export const addSourceFromReference = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    cityId: v.id('cities'), // Required: market this source belongs to
  },
  handler: async (ctx, args) => {
    // Check if source already exists
    const existing = await ctx.db
      .query('scrapeSources')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .first();

    if (existing) {
      throw new Error('A source with this URL already exists');
    }

    // Create new source
    const sourceId = await ctx.db.insert('scrapeSources', {
      name: args.name,
      url: args.url,
      cityId: args.cityId,
      scraperConfig: {
        version: 1,
        generatedAt: Date.now(),
        generatedBy: 'manual',
        entryPoints: [{ url: args.url, type: 'session_list' }],
        sessionExtraction: {
          containerSelector: '',
          fields: {
            name: { selector: '' },
            dates: { selector: '', format: '' },
          },
        },
        requiresJavaScript: true,
      },
      scraperHealth: {
        consecutiveFailures: 0,
        totalRuns: 0,
        successRate: 0,
        needsRegeneration: true,
      },
      scrapeFrequencyHours: 24,
      isActive: false, // Start inactive until scraper is configured
    });

    return sourceId;
  },
});

/**
 * Get sources that are missing sessions (active but no data)
 */
export const getSourcesNeedingAttention = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query('scrapeSources').collect();

    // Sources that are active but have no sessions
    const noDataSources = sources.filter((s) => s.isActive && (s.sessionCount ?? 0) === 0);

    // Sources with failing scrapers
    const failingSources = sources.filter((s) => s.isActive && s.scraperHealth.consecutiveFailures > 0);

    // Sources that need regeneration
    const needsRegenSources = sources.filter((s) => s.isActive && s.scraperHealth.needsRegeneration);

    // Sources with suggested URL updates
    const urlUpdateSources = sources.filter((s) => s.suggestedUrl);

    return {
      noData: noDataSources.map((s) => ({
        _id: s._id,
        name: s.name,
        url: s.url,
        lastScrapedAt: s.lastScrapedAt,
      })),
      failing: failingSources.map((s) => ({
        _id: s._id,
        name: s.name,
        url: s.url,
        consecutiveFailures: s.scraperHealth.consecutiveFailures,
        lastError: s.scraperHealth.lastError,
      })),
      needsRegen: needsRegenSources.map((s) => ({
        _id: s._id,
        name: s.name,
        url: s.url,
      })),
      urlUpdates: urlUpdateSources.map((s) => ({
        _id: s._id,
        name: s.name,
        currentUrl: s.url,
        suggestedUrl: s.suggestedUrl,
      })),
    };
  },
});
