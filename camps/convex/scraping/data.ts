import { mutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Store raw scraped data for a job
 */
export const storeRawData = mutation({
  args: {
    jobId: v.id('scrapeJobs'),
    rawJson: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error('Scrape job not found');
    }

    const rawDataId = await ctx.db.insert('scrapeRawData', {
      jobId: args.jobId,
      sourceId: job.sourceId,
      rawJson: args.rawJson,
      processedAt: undefined,
      resultingSessionId: undefined,
      processingError: undefined,
    });

    return rawDataId;
  },
});

/**
 * Record a detected change during scraping
 */
export const recordChange = mutation({
  args: {
    jobId: v.id('scrapeJobs'),
    sessionId: v.optional(v.id('sessions')),
    changeType: v.union(
      v.literal('session_added'),
      v.literal('session_removed'),
      v.literal('status_changed'),
      v.literal('price_changed'),
      v.literal('dates_changed'),
    ),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error('Scrape job not found');
    }

    const changeId = await ctx.db.insert('scrapeChanges', {
      jobId: args.jobId,
      sourceId: job.sourceId,
      sessionId: args.sessionId,
      changeType: args.changeType,
      previousValue: args.previousValue,
      newValue: args.newValue,
      detectedAt: Date.now(),
      notified: false,
    });

    return changeId;
  },
});

/**
 * Store image map for a job (URL -> storage ID mapping)
 */
export const storeImageMap = mutation({
  args: {
    jobId: v.id('scrapeJobs'),
    imageMap: v.record(v.string(), v.id('_storage')),
  },
  handler: async (ctx, args) => {
    // Store as raw data associated with the job
    const existingRaw = await ctx.db
      .query('scrapeRawData')
      .withIndex('by_job', (q) => q.eq('jobId', args.jobId))
      .first();

    if (existingRaw) {
      const current = JSON.parse(existingRaw.rawJson || '{}');
      current.imageMap = args.imageMap;
      await ctx.db.patch(existingRaw._id, {
        rawJson: JSON.stringify(current),
      });
    }

    return { stored: Object.keys(args.imageMap).length };
  },
});
