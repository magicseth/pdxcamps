import { mutation, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { requireFamily } from '../lib/auth';

/**
 * Submit a request to add a camp to the database
 * If URL is provided, we'll scrape it directly
 * If not, we'll search for the camp and try to find it
 */
export const submitCampRequest = mutation({
  args: {
    campName: v.string(),
    organizationName: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const family = await requireFamily(ctx);

    // Get the family's city
    const city = await ctx.db.get(family.primaryCityId);
    if (!city) {
      throw new Error('City not found');
    }

    // Check if we already have this organization by website URL
    if (args.websiteUrl) {
      const domain = new URL(args.websiteUrl).hostname.replace(/^www\./, '');
      const sources = await ctx.db.query('scrapeSources').collect();
      const existingSource = sources.find((s) => {
        try {
          const sourceDomain = new URL(s.url).hostname.replace(/^www\./, '');
          return sourceDomain === domain;
        } catch {
          return false;
        }
      });

      if (existingSource) {
        // Already have this source - mark as duplicate
        const requestId = await ctx.db.insert('campRequests', {
          familyId: family._id,
          cityId: family.primaryCityId,
          campName: args.campName,
          organizationName: args.organizationName,
          websiteUrl: args.websiteUrl,
          location: args.location,
          notes: args.notes,
          status: 'duplicate',
          scrapeSourceId: existingSource._id,
          createdAt: Date.now(),
          processedAt: Date.now(),
        });
        return { requestId, status: 'duplicate', message: 'This camp is already in our database!' };
      }
    }

    // Create the request
    const requestId = await ctx.db.insert('campRequests', {
      familyId: family._id,
      cityId: family.primaryCityId,
      campName: args.campName,
      organizationName: args.organizationName,
      websiteUrl: args.websiteUrl,
      location: args.location,
      notes: args.notes,
      status: 'pending',
      createdAt: Date.now(),
    });

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.campRequests.actions.processCampRequest, {
      requestId,
    });

    // Notify Seth
    await ctx.scheduler.runAfter(0, internal.email.sendNewUserNotification, {
      userEmail: family.email,
      displayName: family.displayName,
      cityName: city.name,
      brandName: `Camp Request: ${args.campName}`,
    });

    return { requestId, status: 'pending', message: "We're looking for this camp!" };
  },
});

/**
 * Update a camp request status (internal use)
 */
export const updateRequestStatus = internalMutation({
  args: {
    requestId: v.id('campRequests'),
    status: v.union(
      v.literal('pending'),
      v.literal('searching'),
      v.literal('scraping'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('duplicate'),
    ),
    foundUrl: v.optional(v.string()),
    scrapeSourceId: v.optional(v.id('scrapeSources')),
    organizationId: v.optional(v.id('organizations')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { requestId, ...updates } = args;

    const cleanUpdates: Record<string, unknown> = { status: updates.status };
    if (updates.foundUrl) cleanUpdates.foundUrl = updates.foundUrl;
    if (updates.scrapeSourceId) cleanUpdates.scrapeSourceId = updates.scrapeSourceId;
    if (updates.organizationId) cleanUpdates.organizationId = updates.organizationId;
    if (updates.errorMessage) cleanUpdates.errorMessage = updates.errorMessage;

    if (['completed', 'failed', 'duplicate'].includes(updates.status)) {
      cleanUpdates.processedAt = Date.now();
    }

    await ctx.db.patch(requestId, cleanUpdates);

    // Trigger "camp request fulfilled" email when status → completed
    if (updates.status === 'completed') {
      await ctx.scheduler.runAfter(
        0,
        internal.emailAutomation.actions.sendCampRequestFulfilledEmail,
        { requestId },
      );
    }
  },
});

/**
 * Create organization and scrape source for a user-requested camp
 * Also queues scraper development request
 */
export const createOrgAndSource = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    website: v.string(),
    cityId: v.id('cities'),
    requestedBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if org already exists by slug
    const existingOrg = await ctx.db
      .query('organizations')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    let organizationId = existingOrg?._id;

    if (!organizationId) {
      // Create the organization
      organizationId = await ctx.db.insert('organizations', {
        name: args.name,
        slug: args.slug,
        website: args.website,
        cityIds: [args.cityId],
        isActive: true,
        isVerified: false,
      });
    }

    // Create scrape source (inactive - needs scraper development)
    const sourceId = await ctx.db.insert('scrapeSources', {
      organizationId,
      cityId: args.cityId,
      name: args.name,
      url: args.website,
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
      sourceName: args.name,
      sourceUrl: args.website,
      sourceId: sourceId,
      cityId: args.cityId,
      requestedAt: now,
      requestedBy: args.requestedBy,
      notes: args.notes || 'User-requested camp',
      status: 'pending',
    });

    return { organizationId, sourceId };
  },
});
