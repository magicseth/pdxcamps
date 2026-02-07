/**
 * Import Mutations
 *
 * Mutations for creating records during import.
 * Separated from import.ts because mutations can't be in "use node" files.
 */

import { mutation, internalMutation } from '../_generated/server';
import { v } from 'convex/values';
import { sessionsBySourceAggregate } from '../lib/sessionAggregate';

/**
 * Create an organization
 */
export const createOrganization = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    cityId: v.id('cities'),
  },
  handler: async (ctx, args) => {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return ctx.db.insert('organizations', {
      name: args.name,
      slug,
      description: args.description,
      website: args.website,
      logoUrl: args.logoUrl,
      cityIds: [args.cityId],
      isVerified: false,
      isActive: true,
    });
  },
});

/**
 * Create a camp
 */
export const createCamp = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    website: v.optional(v.string()),
    imageUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return ctx.db.insert('camps', {
      organizationId: args.organizationId,
      name: args.name,
      slug,
      description: args.description,
      categories: args.categories,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      website: args.website,
      imageUrls: args.imageUrls,
      imageStorageIds: [],
      isActive: true,
    });
  },
});

/**
 * Create a location with optional address and coordinates
 */
export const createLocation = mutation({
  args: {
    organizationId: v.id('organizations'),
    name: v.string(),
    cityId: v.id('cities'),
    // Optional structured address
    street: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    // Optional coordinates (from geocoding or source)
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('locations', {
      organizationId: args.organizationId,
      name: args.name,
      address: {
        street: args.street || 'TBD',
        city: args.city || 'Portland',
        state: args.state || 'OR',
        zip: args.zip || '97201',
      },
      cityId: args.cityId,
      // Use provided coordinates or fall back to Portland city center
      latitude: args.latitude ?? 45.5152,
      longitude: args.longitude ?? -122.6784,
      isActive: true,
    });
  },
});

/**
 * Create a session
 */
export const createSession = mutation({
  args: {
    campId: v.id('camps'),
    locationId: v.id('locations'),
    organizationId: v.id('organizations'),
    cityId: v.id('cities'),
    startDate: v.string(),
    endDate: v.string(),
    dropOffHour: v.number(),
    dropOffMinute: v.number(),
    pickUpHour: v.number(),
    pickUpMinute: v.number(),
    price: v.number(),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    registrationUrl: v.optional(v.string()),
    sourceId: v.id('scrapeSources'),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert('sessions', {
      campId: args.campId,
      locationId: args.locationId,
      organizationId: args.organizationId,
      cityId: args.cityId,
      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: { hour: args.dropOffHour, minute: args.dropOffMinute },
      pickUpTime: { hour: args.pickUpHour, minute: args.pickUpMinute },
      extendedCareAvailable: false,
      price: args.price,
      currency: 'USD',
      capacity: 20,
      enrolledCount: 0,
      waitlistCount: 0,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      status: 'active',
      waitlistEnabled: true,
      externalRegistrationUrl: args.registrationUrl,
      sourceId: args.sourceId,
      lastScrapedAt: Date.now(),
    });

    // Update aggregate count for this source (non-blocking - don't fail if aggregate errors)
    try {
      const doc = await ctx.db.get(sessionId);
      if (doc) {
        await sessionsBySourceAggregate.insert(ctx, doc);
      }
    } catch (e) {
      // Aggregate update failed - log but don't break session creation
      console.warn(`Failed to update session aggregate: ${e}`);
    }

    return sessionId;
  },
});

/**
 * Create a session with completeness tracking (internal use)
 */
export const createSessionWithCompleteness = internalMutation({
  args: {
    campId: v.id('camps'),
    locationId: v.id('locations'),
    organizationId: v.id('organizations'),
    cityId: v.id('cities'),
    startDate: v.string(),
    endDate: v.string(),
    dropOffHour: v.number(),
    dropOffMinute: v.number(),
    pickUpHour: v.number(),
    pickUpMinute: v.number(),
    price: v.number(),
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    minGrade: v.optional(v.number()),
    maxGrade: v.optional(v.number()),
    registrationUrl: v.optional(v.string()),
    sourceId: v.id('scrapeSources'),
    // Completeness fields
    status: v.union(v.literal('draft'), v.literal('active')),
    completenessScore: v.number(),
    missingFields: v.array(v.string()),
    dataSource: v.union(v.literal('scraped'), v.literal('manual'), v.literal('enhanced')),
    // Capacity fields
    capacity: v.optional(v.number()),
    enrolledCount: v.optional(v.number()),
    // Overnight camp flag
    isOvernight: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert('sessions', {
      campId: args.campId,
      locationId: args.locationId,
      organizationId: args.organizationId,
      cityId: args.cityId,
      startDate: args.startDate,
      endDate: args.endDate,
      dropOffTime: { hour: args.dropOffHour, minute: args.dropOffMinute },
      pickUpTime: { hour: args.pickUpHour, minute: args.pickUpMinute },
      isOvernight: args.isOvernight,
      extendedCareAvailable: false,
      price: args.price,
      currency: 'USD',
      capacity: args.capacity ?? 20,
      enrolledCount: args.enrolledCount ?? 0,
      waitlistCount: 0,
      ageRequirements: {
        minAge: args.minAge,
        maxAge: args.maxAge,
        minGrade: args.minGrade,
        maxGrade: args.maxGrade,
      },
      status: args.status,
      waitlistEnabled: true,
      externalRegistrationUrl: args.registrationUrl,
      sourceId: args.sourceId,
      lastScrapedAt: Date.now(),
      // Completeness tracking
      completenessScore: args.completenessScore,
      missingFields: args.missingFields,
      dataSource: args.dataSource,
    });

    // Update aggregate count for this source (non-blocking - don't fail if aggregate errors)
    try {
      const doc = await ctx.db.get(sessionId);
      if (doc) {
        await sessionsBySourceAggregate.insert(ctx, doc);
      }
    } catch (e) {
      // Aggregate update failed - log but don't break session creation
      console.warn(`Failed to update session aggregate: ${e}`);
    }

    return sessionId;
  },
});

/**
 * Create a pending session for manual review
 */
export const createPendingSession = internalMutation({
  args: {
    jobId: v.id('scrapeJobs'),
    sourceId: v.id('scrapeSources'),
    rawData: v.string(),
    partialData: v.object({
      name: v.optional(v.string()),
      dateRaw: v.optional(v.string()),
      priceRaw: v.optional(v.string()),
      ageGradeRaw: v.optional(v.string()),
      timeRaw: v.optional(v.string()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      registrationUrl: v.optional(v.string()),
    }),
    validationErrors: v.array(
      v.object({
        field: v.string(),
        error: v.string(),
        attemptedValue: v.optional(v.string()),
      }),
    ),
    completenessScore: v.number(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('pendingSessions', {
      jobId: args.jobId,
      sourceId: args.sourceId,
      rawData: args.rawData,
      partialData: args.partialData,
      validationErrors: args.validationErrors,
      completenessScore: args.completenessScore,
      status: 'pending_review',
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a session's price (used when re-scraping finds a price for existing session)
 */
export const updateSessionPrice = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      price: args.price,
      lastScrapedAt: Date.now(),
    });
  },
});

/**
 * Update session price and capacity (availability)
 * Used when re-scraping to update existing sessions with fresh data
 */
export const updateSessionPriceAndCapacity = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    price: v.optional(v.number()),
    capacity: v.optional(v.number()),
    sourceId: v.optional(v.id('scrapeSources')),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      lastScrapedAt: Date.now(),
    };
    if (args.price !== undefined && args.price > 0) {
      updates.price = args.price;
    }
    if (args.capacity !== undefined && args.capacity >= 0) {
      updates.capacity = args.capacity;
    }
    // Backfill sourceId on sessions that were imported before tracking
    if (args.sourceId) {
      const session = await ctx.db.get(args.sessionId);
      if (session && !session.sourceId) {
        updates.sourceId = args.sourceId;
      }
    }
    if (Object.keys(updates).length > 1) {
      await ctx.db.patch(args.sessionId, updates);
    }
  },
});

/**
 * Update source session counts and quality metrics.
 *
 * IMPORTANT: Session counts are now passed as arguments to avoid read-write conflicts.
 * Previously, this mutation queried all sessions which caused conflicts when
 * sessions were being created concurrently by the import pipeline.
 */
export const updateSourceSessionCounts = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
    sessionCount: v.number(),
    activeSessionCount: v.number(),
    dataQualityScore: v.number(),
    qualityTier: v.union(v.literal('high'), v.literal('medium'), v.literal('low')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      sessionCount: args.sessionCount,
      activeSessionCount: args.activeSessionCount,
      dataQualityScore: args.dataQualityScore,
      qualityTier: args.qualityTier,
      lastSessionsFoundAt: args.sessionCount > 0 ? Date.now() : undefined,
    });
  },
});

/**
 * Update a pending session status
 */
export const updatePendingSessionStatus = mutation({
  args: {
    pendingSessionId: v.id('pendingSessions'),
    status: v.union(
      v.literal('pending_review'),
      v.literal('manually_fixed'),
      v.literal('imported'),
      v.literal('discarded'),
    ),
    reviewedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingSessionId, {
      status: args.status,
      reviewedAt: Date.now(),
      reviewedBy: args.reviewedBy,
    });
  },
});

// ============ URL DISCOVERY MUTATIONS ============

/**
 * Record a URL check in history
 */
export const recordUrlCheck = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
    url: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return;

    const history = source.urlHistory || [];
    history.push({
      url: args.url,
      status: args.status,
      checkedAt: Date.now(),
    });

    // Keep only last 10 entries
    const trimmedHistory = history.slice(-10);

    await ctx.db.patch(args.sourceId, {
      urlHistory: trimmedHistory,
    });
  },
});

/**
 * Suggest a URL update for a source
 */
export const suggestUrlUpdate = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
    suggestedUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      suggestedUrl: args.suggestedUrl,
    });
  },
});

/**
 * Apply a suggested URL update
 */
export const applyUrlUpdate = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source?.suggestedUrl) return;

    await ctx.db.patch(args.sourceId, {
      url: source.suggestedUrl,
      suggestedUrl: undefined,
    });
  },
});

// ============ SESSION AGGREGATE FUNCTIONS ============

/**
 * Get session count for a source from the aggregate.
 * This is much faster than querying all sessions.
 */
export const getSourceSessionCount = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
  },
  handler: async (ctx, args) => {
    const count = await sessionsBySourceAggregate.count(ctx, {
      namespace: args.sourceId,
    });
    return count;
  },
});

/**
 * Delete a session and update the aggregate.
 * Use this instead of ctx.db.delete() for sessions to keep counts accurate.
 */
export const deleteSessionWithAggregate = internalMutation({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    // Remove from aggregate
    await sessionsBySourceAggregate.delete(ctx, session);

    // Delete the session
    await ctx.db.delete(args.sessionId);
  },
});

/**
 * Backfill the session aggregate from existing sessions.
 * Run this once after deploying the aggregate to populate it.
 *
 * Processes in batches to avoid timeout. Call repeatedly until done.
 * Returns { done: true } when complete.
 */
export const backfillSessionAggregate = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    // Query sessions with pagination
    const query = ctx.db.query('sessions');

    const sessions = await query.take(batchSize + 1);
    const hasMore = sessions.length > batchSize;
    const toProcess = hasMore ? sessions.slice(0, batchSize) : sessions;

    let processed = 0;
    for (const session of toProcess) {
      try {
        await sessionsBySourceAggregate.insert(ctx, session);
        processed++;
      } catch (e) {
        // Item might already exist in aggregate, skip
        console.log(`Skipping session ${session._id}: ${e}`);
      }
    }

    return {
      processed,
      hasMore,
      nextCursor: hasMore ? toProcess[toProcess.length - 1]._id : undefined,
    };
  },
});

/**
 * Clear and rebuild the session aggregate for a specific source.
 * Use this if the aggregate gets out of sync.
 */
export const rebuildSessionAggregate = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
  },
  handler: async (ctx, args) => {
    // Clear existing entries for this source
    await sessionsBySourceAggregate.clear(ctx, {
      namespace: args.sourceId,
    });

    // Re-add all sessions for this source
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .collect();

    for (const session of sessions) {
      await sessionsBySourceAggregate.insert(ctx, session);
    }

    return { rebuilt: sessions.length };
  },
});

/**
 * Migration: Flag existing overnight camps based on name/description keywords.
 * Run this once after deploying the isOvernight field.
 *
 * Processes in batches to avoid timeout. Call repeatedly until done.
 * Returns { done: true } when complete.
 */
export const migrateOvernightCamps = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const overnightKeywords = ['overnight', 'sleepaway', 'residential', 'sleep-away'];

    // Get sessions that haven't been checked yet (isOvernight is undefined)
    const sessions = await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('isOvernight'), undefined))
      .take(batchSize + 1);

    const hasMore = sessions.length > batchSize;
    const toProcess = hasMore ? sessions.slice(0, batchSize) : sessions;

    let updated = 0;
    let checked = 0;

    for (const session of toProcess) {
      checked++;

      // Get the camp to check its name and description
      const camp = await ctx.db.get(session.campId);
      if (!camp) continue;

      const textToSearch = `${camp.name || ''} ${camp.description || ''} ${session.campName || ''}`.toLowerCase();
      const isOvernight = overnightKeywords.some((keyword) => textToSearch.includes(keyword));

      // Only update if it's an overnight camp (saves write operations)
      if (isOvernight) {
        await ctx.db.patch(session._id, { isOvernight: true });
        updated++;
      } else {
        // Set to false so we don't reprocess
        await ctx.db.patch(session._id, { isOvernight: false });
      }
    }

    return {
      checked,
      updated,
      hasMore,
    };
  },
});

/**
 * Create an alert for suspicious zero-price pattern during import.
 * This indicates that the scraper's price extraction may be broken.
 *
 * Avoids creating duplicates by checking for recent unacknowledged alerts.
 */
export const createZeroPriceAlert = internalMutation({
  args: {
    sourceId: v.id('scrapeSources'),
    sourceName: v.string(),
    zeroPricePercent: v.number(),
    zeroPriceCount: v.number(),
    totalCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for existing unacknowledged alert for this source (within last 24 hours)
    const existingAlerts = await ctx.db
      .query('scraperAlerts')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .collect();

    const recentDuplicate = existingAlerts.some(
      (alert) =>
        alert.alertType === 'scraper_degraded' &&
        alert.acknowledgedAt === undefined &&
        alert.message.includes('zero-price') &&
        alert.createdAt > Date.now() - 24 * 60 * 60 * 1000,
    );

    if (recentDuplicate) {
      return { created: false, reason: 'Duplicate alert exists' };
    }

    await ctx.db.insert('scraperAlerts', {
      sourceId: args.sourceId,
      alertType: 'scraper_degraded',
      message: `Scraper "${args.sourceName}" has suspicious zero-price pattern: ${args.zeroPricePercent}% of sessions (${args.zeroPriceCount}/${args.totalCount}) have $0 price. Price extraction may be broken.`,
      severity: 'warning',
      createdAt: Date.now(),
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
    });

    return { created: true };
  },
});
