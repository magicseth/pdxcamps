/**
 * Market Discovery
 *
 * Manages the discovery of camp organizations in new markets via web search.
 * Creates tasks that the local daemon picks up to search Google/Bing,
 * extract camp URLs from directories, and feed them into the scraping pipeline.
 */

import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';

// Known camp directory domains to prioritize for deep crawl
const KNOWN_DIRECTORIES = [
  'activityhero.com',
  'sawyer.com',
  'campsearch.com',
  'mysummercamps.com',
  'acacamps.org',
  'campnavigator.com',
  'kidscamps.com',
  'summercampdirectories.com',
];

/**
 * Generate search queries for a region
 */
function generateSearchQueries(regionName: string): string[] {
  const currentYear = new Date().getFullYear();
  return [
    `${regionName} summer camps`,
    `${regionName} summer camps ${currentYear}`,
    `${regionName} kids day camps`,
    `${regionName} children summer programs`,
    `${regionName} youth camps`,
    `best summer camps in ${regionName}`,
    `${regionName} camp directory`,
    `${regionName} summer activities for kids`,
    `${regionName} STEM camps`,
    `${regionName} sports camps`,
    `${regionName} art camps for kids`,
    `${regionName} outdoor adventure camps`,
  ];
}

/**
 * Create a new market discovery task
 */
export const createDiscoveryTask = mutation({
  args: {
    regionName: v.string(), // e.g., "Phoenix, Arizona" or "Boston, Massachusetts"
    citySlug: v.optional(v.string()), // Existing city slug, or create new
    createCity: v.optional(v.boolean()), // Create city if it doesn't exist
    cityName: v.optional(v.string()), // For new city
    cityState: v.optional(v.string()), // For new city
    cityTimezone: v.optional(v.string()), // For new city
    centerLatitude: v.optional(v.number()), // For new city
    centerLongitude: v.optional(v.number()), // For new city
    maxSearchResults: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let cityId: Id<'cities'>;

    // Find or create city
    if (args.citySlug) {
      const existingCity = await ctx.db
        .query('cities')
        .withIndex('by_slug', (q) => q.eq('slug', args.citySlug!))
        .first();

      if (!existingCity) {
        throw new Error(`City not found: ${args.citySlug}`);
      }
      cityId = existingCity._id;
    } else if (args.createCity && args.cityName && args.cityState) {
      // Create new city
      const slug = args.cityName.toLowerCase().replace(/\s+/g, '-');

      // Check if city already exists
      const existingCity = await ctx.db
        .query('cities')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .first();

      if (existingCity) {
        cityId = existingCity._id;
      } else {
        cityId = await ctx.db.insert('cities', {
          name: args.cityName,
          slug,
          state: args.cityState,
          timezone: args.cityTimezone || 'America/Phoenix', // Default for Arizona
          isActive: true,
          centerLatitude: args.centerLatitude || 33.4484, // Phoenix default
          centerLongitude: args.centerLongitude || -112.074,
        });
      }
    } else {
      throw new Error('Must provide either citySlug or createCity with cityName and cityState');
    }

    // Check for existing pending/in-progress task for this city
    const existingTask = await ctx.db
      .query('marketDiscoveryTasks')
      .withIndex('by_city', (q) => q.eq('cityId', cityId))
      .filter((q) =>
        q.or(
          q.eq(q.field('status'), 'pending'),
          q.eq(q.field('status'), 'searching'),
          q.eq(q.field('status'), 'discovering'),
        ),
      )
      .first();

    if (existingTask) {
      throw new Error(`A discovery task is already in progress for this market`);
    }

    // Generate search queries
    const searchQueries = generateSearchQueries(args.regionName);

    // Create the task
    const taskId = await ctx.db.insert('marketDiscoveryTasks', {
      cityId,
      regionName: args.regionName,
      status: 'pending',
      searchQueries,
      maxSearchResults: args.maxSearchResults || 50,
      createdAt: Date.now(),
    });

    return { taskId, cityId, searchQueries };
  },
});

/**
 * Get pending discovery tasks for the daemon
 */
export const getPendingDiscoveryTasks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query('marketDiscoveryTasks')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .take(args.limit || 5);
  },
});

/**
 * Claim a discovery task (atomic operation for daemon)
 */
export const claimDiscoveryTask = mutation({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      return null;
    }

    if (task.status !== 'pending') {
      return null; // Already claimed
    }

    await ctx.db.patch(args.taskId, {
      status: 'searching',
      claimedAt: Date.now(),
      claimedBy: args.sessionId,
    });

    return task;
  },
});

/**
 * Update discovery progress
 */
export const updateDiscoveryProgress = mutation({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
    searchesCompleted: v.optional(v.number()),
    directoriesFound: v.optional(v.number()),
    urlsDiscovered: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal('searching'), v.literal('discovering'), v.literal('completed'), v.literal('failed')),
    ),
    discoveredUrls: v.optional(
      v.array(
        v.object({
          url: v.string(),
          source: v.string(),
          title: v.optional(v.string()),
          domain: v.string(),
        }),
      ),
    ),
    directoryUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    const task = await ctx.db.get(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    // Only update provided fields
    const patch: Record<string, unknown> = {};
    if (updates.searchesCompleted !== undefined) patch.searchesCompleted = updates.searchesCompleted;
    if (updates.directoriesFound !== undefined) patch.directoriesFound = updates.directoriesFound;
    if (updates.urlsDiscovered !== undefined) patch.urlsDiscovered = updates.urlsDiscovered;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.discoveredUrls !== undefined) patch.discoveredUrls = updates.discoveredUrls;
    if (updates.directoryUrls !== undefined) patch.directoryUrls = updates.directoryUrls;

    await ctx.db.patch(taskId, patch);

    return taskId;
  },
});

/**
 * Complete a discovery task with results
 */
export const completeDiscoveryTask = mutation({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
    orgsCreated: v.number(),
    orgsExisted: v.number(),
    sourcesCreated: v.number(),
    discoveredUrls: v.optional(
      v.array(
        v.object({
          url: v.string(),
          source: v.string(),
          title: v.optional(v.string()),
          domain: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    await ctx.db.patch(args.taskId, {
      status: 'completed',
      orgsCreated: args.orgsCreated,
      orgsExisted: args.orgsExisted,
      sourcesCreated: args.sourcesCreated,
      discoveredUrls: args.discoveredUrls,
      completedAt: Date.now(),
    });

    return args.taskId;
  },
});

/**
 * Mark a discovery task as failed
 */
export const failDiscoveryTask = mutation({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: 'failed',
      error: args.error,
      completedAt: Date.now(),
    });

    return args.taskId;
  },
});

/**
 * Get discovery task status
 */
export const getDiscoveryTaskStatus = query({
  args: { taskId: v.id('marketDiscoveryTasks') },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    // Get city info
    const city = await ctx.db.get(task.cityId);

    return {
      ...task,
      cityName: city?.name,
      citySlug: city?.slug,
    };
  },
});

/**
 * Get all discovery tasks for a city
 */
export const getDiscoveryTasksForCity = query({
  args: { cityId: v.id('cities') },
  handler: async (ctx, args) => {
    return ctx.db
      .query('marketDiscoveryTasks')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .order('desc')
      .collect();
  },
});

/**
 * List all discovery tasks with optional filters
 */
export const listDiscoveryTasks = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('searching'),
        v.literal('discovering'),
        v.literal('completed'),
        v.literal('failed'),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let tasks;

    if (args.status) {
      const filtered = await ctx.db
        .query('marketDiscoveryTasks')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .collect();
      // Sort by creation time descending
      filtered.sort((a, b) => b._creationTime - a._creationTime);
      tasks = filtered.slice(0, args.limit || 50);
    } else {
      const allTasks = await ctx.db.query('marketDiscoveryTasks').collect();
      // Sort by creation time descending
      allTasks.sort((a, b) => b._creationTime - a._creationTime);
      tasks = allTasks.slice(0, args.limit || 50);
    }

    // Enrich with city info
    return Promise.all(
      tasks.map(async (task) => {
        const city = await ctx.db.get(task.cityId);
        return {
          ...task,
          cityName: city?.name,
          citySlug: city?.slug,
        };
      }),
    );
  },
});

/**
 * Create organizations and sources from discovered URLs
 */
export const createOrgsFromDiscoveredUrls = mutation({
  args: {
    taskId: v.id('marketDiscoveryTasks'),
    urls: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        domain: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    let created = 0;
    let existed = 0;
    let sourcesCreated = 0;

    // Load all org domains ONCE before the loop to avoid repeated full-table scans
    const allOrgs = await ctx.db.query('organizations').collect();
    const existingDomains = new Set<string>();
    for (const org of allOrgs) {
      if (!org.website) continue;
      try {
        const domain = new URL(org.website).hostname.replace(/^www\./, '');
        existingDomains.add(domain);
      } catch {
        // skip invalid URLs
      }
    }

    for (const item of args.urls) {
      try {
        // Generate name from title or domain
        let name = item.title || '';
        if (!name || name.length < 3) {
          name = item.domain
            .replace(/\.(com|org|edu|net|gov|co|io)$/i, '')
            .split(/[.-]/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }

        // Clean up name
        name = name.slice(0, 100); // Limit length

        // Check if org already exists by domain
        if (existingDomains.has(item.domain)) {
          existed++;
          continue;
        }

        // Track newly created domains to avoid duplicates within this batch
        existingDomains.add(item.domain);

        // Create organization
        const orgId = await ctx.db.insert('organizations', {
          name,
          slug: item.domain.replace(/\./g, '-'),
          website: item.url,
          cityIds: [task.cityId],
          isActive: true,
          isVerified: false,
        });

        // Create scrape source
        const sourceId = await ctx.db.insert('scrapeSources', {
          organizationId: orgId,
          cityId: task.cityId,
          name,
          url: item.url,
          scrapeFrequencyHours: 168, // weekly
          isActive: false, // needs scraper development first
          scraperHealth: {
            consecutiveFailures: 0,
            totalRuns: 0,
            successRate: 0,
            needsRegeneration: false,
          },
        });

        // Queue scraper development request
        await ctx.db.insert('scraperDevelopmentRequests', {
          sourceName: name,
          sourceUrl: item.url,
          sourceId: sourceId,
          cityId: task.cityId,
          requestedAt: Date.now(),
          requestedBy: 'market-discovery',
          notes: `Auto-discovered from web search for: ${task.regionName}`,
          status: 'pending',
        });

        created++;
        sourcesCreated++;
      } catch (e) {
        // Log error but continue
        console.error(`Failed to create org for ${item.url}:`, e);
      }
    }

    return { created, existed, sourcesCreated };
  },
});

/**
 * Reset a failed task to pending
 */
export const resetDiscoveryTask = mutation({
  args: { taskId: v.id('marketDiscoveryTasks') },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    await ctx.db.patch(args.taskId, {
      status: 'pending',
      error: undefined,
      claimedAt: undefined,
      claimedBy: undefined,
      searchesCompleted: undefined,
      directoriesFound: undefined,
      urlsDiscovered: undefined,
      completedAt: undefined,
    });

    return args.taskId;
  },
});

// Export the known directories for use in actions
export { KNOWN_DIRECTORIES, generateSearchQueries };
