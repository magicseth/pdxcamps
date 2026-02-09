/**
 * Directories — Queries & Mutations
 *
 * First-class directory entities for the scraping pipeline.
 * Directories are websites (aggregators, municipal sites, curated lists)
 * that list multiple camp organizations.
 */

import { query, mutation } from '../_generated/server';
import { v } from 'convex/values';

// ============ QUERIES ============

/**
 * List directories for a city with org counts
 */
export const listDirectoriesForCity = query({
  args: { cityId: v.id('cities') },
  handler: async (ctx, args) => {
    const directories = await ctx.db
      .query('directories')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    // Get org counts per directory
    const enriched = await Promise.all(
      directories.map(async (dir) => {
        const orgs = await ctx.db
          .query('organizations')
          .withIndex('by_directory', (q) => q.eq('discoveredFromDirectoryId', dir._id))
          .collect();

        // Count how many orgs have active scrapers
        let orgsWithScrapers = 0;
        for (const org of orgs) {
          const source = await ctx.db
            .query('scrapeSources')
            .withIndex('by_organization', (q) => q.eq('organizationId', org._id))
            .first();
          if (source && source.isActive && (source.scraperCode || source.scraperModule)) {
            orgsWithScrapers++;
          }
        }

        return {
          ...dir,
          orgCount: orgs.length,
          orgsWithScrapers,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get a directory with its organizations and scraper status
 */
export const getDirectoryWithOrgs = query({
  args: { directoryId: v.id('directories') },
  handler: async (ctx, args) => {
    const directory = await ctx.db.get(args.directoryId);
    if (!directory) return null;

    const orgs = await ctx.db
      .query('organizations')
      .withIndex('by_directory', (q) => q.eq('discoveredFromDirectoryId', args.directoryId))
      .collect();

    const orgsWithDetails = await Promise.all(
      orgs.map(async (org) => {
        const source = await ctx.db
          .query('scrapeSources')
          .withIndex('by_organization', (q) => q.eq('organizationId', org._id))
          .first();

        const sessionCount = source
          ? await ctx.db
              .query('sessions')
              .withIndex('by_source', (q) => q.eq('sourceId', source._id))
              .collect()
              .then((s) => s.length)
          : 0;

        // Determine scraper status
        let scraperStatus: 'no_scraper' | 'pending_dev' | 'active' | 'failing' | 'disabled' = 'no_scraper';
        if (source) {
          if (!source.isActive) {
            scraperStatus = 'disabled';
          } else if (source.scraperHealth.consecutiveFailures >= 3) {
            scraperStatus = 'failing';
          } else if (source.scraperCode || source.scraperModule) {
            scraperStatus = 'active';
          } else {
            scraperStatus = 'pending_dev';
          }
        } else {
          // Check for pending dev request
          const devRequest = await ctx.db
            .query('scraperDevelopmentRequests')
            .withIndex('by_source_url', (q) => q.eq('sourceUrl', org.website || ''))
            .first();
          if (devRequest && ['pending', 'in_progress', 'testing'].includes(devRequest.status)) {
            scraperStatus = 'pending_dev';
          }
        }

        return {
          ...org,
          scraperStatus,
          sourceId: source?._id,
          sessionCount,
          lastScrapedAt: source?.lastScrapedAt,
          dataQualityScore: source?.dataQualityScore,
          scraperHealth: source?.scraperHealth,
        };
      }),
    );

    return {
      ...directory,
      organizations: orgsWithDetails,
    };
  },
});

/**
 * Get aggregate directory stats for a city
 */
export const getDirectoryStats = query({
  args: { cityId: v.id('cities') },
  handler: async (ctx, args) => {
    const directories = await ctx.db
      .query('directories')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const total = directories.length;
    const crawled = directories.filter((d) => d.status === 'crawled').length;
    const pending = directories.filter((d) => d.status === 'discovered' || d.status === 'crawling').length;
    const failed = directories.filter((d) => d.status === 'failed').length;
    const excluded = directories.filter((d) => d.status === 'excluded').length;
    const orgsExtracted = directories.reduce((sum, d) => sum + (d.orgsExtracted || 0), 0);

    return { total, crawled, pending, failed, excluded, orgsExtracted };
  },
});

// ============ MUTATIONS ============

/**
 * Create a new directory
 */
export const createDirectory = mutation({
  args: {
    cityId: v.id('cities'),
    name: v.string(),
    url: v.string(),
    domain: v.string(),
    directoryType: v.union(
      v.literal('aggregator'),
      v.literal('municipal'),
      v.literal('curated_list'),
      v.literal('search_result'),
    ),
    linkPattern: v.optional(v.string()),
    baseUrlFilter: v.optional(v.string()),
    discoveredFrom: v.optional(v.string()),
    discoveryTaskId: v.optional(v.id('marketDiscoveryTasks')),
  },
  handler: async (ctx, args) => {
    // Check for duplicate URL
    const existing = await ctx.db
      .query('directories')
      .withIndex('by_url', (q) => q.eq('url', args.url))
      .first();

    if (existing) {
      return existing._id;
    }

    return ctx.db.insert('directories', {
      ...args,
      status: 'discovered',
      createdAt: Date.now(),
    });
  },
});

/**
 * Update directory status and stats
 */
export const updateDirectoryStatus = mutation({
  args: {
    directoryId: v.id('directories'),
    status: v.optional(
      v.union(
        v.literal('discovered'),
        v.literal('crawling'),
        v.literal('crawled'),
        v.literal('failed'),
        v.literal('excluded'),
      ),
    ),
    linksFound: v.optional(v.number()),
    orgsExtracted: v.optional(v.number()),
    lastCrawledAt: v.optional(v.number()),
    crawlError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { directoryId, ...updates } = args;
    const directory = await ctx.db.get(directoryId);
    if (!directory) throw new Error('Directory not found');

    const patch: Record<string, unknown> = {};
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.linksFound !== undefined) patch.linksFound = updates.linksFound;
    if (updates.orgsExtracted !== undefined) patch.orgsExtracted = updates.orgsExtracted;
    if (updates.lastCrawledAt !== undefined) patch.lastCrawledAt = updates.lastCrawledAt;
    if (updates.crawlError !== undefined) patch.crawlError = updates.crawlError;

    await ctx.db.patch(directoryId, patch);
    return directoryId;
  },
});

/**
 * Link an organization to the directory it was discovered from
 */
export const linkOrgToDirectory = mutation({
  args: {
    organizationId: v.id('organizations'),
    directoryId: v.id('directories'),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error('Organization not found');
    await ctx.db.patch(args.organizationId, {
      discoveredFromDirectoryId: args.directoryId,
    });
    return args.organizationId;
  },
});

/**
 * Exclude a directory from the pipeline
 */
export const excludeDirectory = mutation({
  args: { directoryId: v.id('directories') },
  handler: async (ctx, args) => {
    const directory = await ctx.db.get(args.directoryId);
    if (!directory) throw new Error('Directory not found');

    await ctx.db.patch(args.directoryId, { status: 'excluded' });
    return args.directoryId;
  },
});
