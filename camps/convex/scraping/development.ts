/**
 * Scraper Development
 *
 * Manages the queue of sites needing scraper development
 * and tracks Claude Code sessions working on them.
 */

import { mutation, query, internalMutation, MutationCtx } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { workflow } from './scrapeWorkflow';
import { Id } from '../_generated/dataModel';

/**
 * Create a scrape job and schedule its workflow.
 * Use this instead of raw ctx.db.insert('scrapeJobs', ...) to ensure
 * the workflow actually starts.
 */
async function createJobWithWorkflow(
  ctx: MutationCtx,
  sourceId: Id<'scrapeSources'>,
  triggeredBy: string,
): Promise<Id<'scrapeJobs'> | null> {
  // Check for existing pending/running job
  const existingPending = await ctx.db
    .query('scrapeJobs')
    .withIndex('by_source_and_status', (q) => q.eq('sourceId', sourceId).eq('status', 'pending'))
    .first();
  if (existingPending) return null;

  const existingRunning = await ctx.db
    .query('scrapeJobs')
    .withIndex('by_source_and_status', (q) => q.eq('sourceId', sourceId).eq('status', 'running'))
    .first();
  if (existingRunning) return null;

  const jobId = await ctx.db.insert('scrapeJobs', {
    sourceId,
    status: 'pending',
    triggeredBy,
    retryCount: 0,
  });

  // Schedule workflow start in a separate transaction with jitter
  const jitterMs = 100 + Math.floor(Math.random() * 3900);
  await ctx.scheduler.runAfter(jitterMs, internal.scraping.scrapeWorkflow.startWorkflowForJob, {
    jobId,
    sourceId,
  });

  return jobId;
}

/**
 * Request scraper development for a new site
 */
export const requestScraperDevelopment = mutation({
  args: {
    sourceName: v.string(),
    sourceUrl: v.string(),
    cityId: v.id('cities'), // Required: market this request is for
    sourceId: v.optional(v.id('scrapeSources')),
    notes: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing pending request for same URL
    const existing = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_source_url', (q) => q.eq('sourceUrl', args.sourceUrl))
      .filter((q) => q.or(q.eq(q.field('status'), 'pending'), q.eq(q.field('status'), 'in_progress')))
      .first();

    if (existing) {
      throw new Error('A scraper development request already exists for this URL');
    }

    return ctx.db.insert('scraperDevelopmentRequests', {
      sourceName: args.sourceName,
      sourceUrl: args.sourceUrl,
      cityId: args.cityId,
      sourceId: args.sourceId,
      notes: args.notes,
      requestedBy: args.requestedBy,
      requestedAt: Date.now(),
      status: 'pending',
      scraperVersion: 0,
    });
  },
});

/**
 * Get pending scraper development requests (for the daemon to pick up)
 */
export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .collect();
  },
});

/**
 * Get all scraper development requests with optional status filter
 */
export const listRequests = query({
  args: {
    status: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('testing'),
        v.literal('needs_feedback'),
        v.literal('completed'),
        v.literal('failed'),
      ),
    ),
    limit: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal('asc'), v.literal('desc'))),
    cityId: v.optional(v.id('cities')), // Filter by city/market
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const order = args.sortOrder ?? 'asc'; // Default to oldest first

    let requests;

    // Use index for filtering when possible
    if (args.cityId) {
      // Filter by city using the index
      requests = await ctx.db
        .query('scraperDevelopmentRequests')
        .withIndex('by_city', (q) => q.eq('cityId', args.cityId!))
        .order(order)
        .take(limit * 2);

      // Post-filter by status if needed
      if (args.status) {
        requests = requests.filter((r) => r.status === args.status);
      }
    } else if (args.status) {
      requests = await ctx.db
        .query('scraperDevelopmentRequests')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .order(order)
        .take(limit);
    } else {
      requests = await ctx.db.query('scraperDevelopmentRequests').order(order).take(limit);
    }

    // Enrich with city name (now just a simple lookup since cityId is directly on the request)
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const city = await ctx.db.get(request.cityId);
        return {
          ...request,
          cityName: city?.name,
          citySlug: city?.slug,
        };
      }),
    );

    return enrichedRequests.slice(0, limit);
  },
});

/**
 * Get a specific request by ID
 */
export const getRequest = query({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.requestId);
  },
});

/**
 * Claim a request for processing (called by daemon)
 */
export const claimRequest = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    claudeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request is not pending (status: ${request.status})`);
    }

    await ctx.db.patch(args.requestId, {
      status: 'in_progress',
      claudeSessionId: args.claudeSessionId,
      claudeSessionStartedAt: Date.now(),
    });

    return args.requestId;
  },
});

/**
 * Atomically get next pending request AND claim it
 * Safe for parallel workers - only one worker will get each request
 * Optionally filter by cityId to focus on a specific market
 */
export const getNextAndClaim = mutation({
  args: {
    workerId: v.string(),
    cityId: v.optional(v.id('cities')),
  },
  handler: async (ctx, args) => {
    let pending;

    if (args.cityId) {
      // Filter by city - use city index then filter by status
      pending = await ctx.db
        .query('scraperDevelopmentRequests')
        .withIndex('by_city', (q) => q.eq('cityId', args.cityId!))
        .filter((q) => q.eq(q.field('status'), 'pending'))
        .first();
    } else {
      // Get any pending request
      pending = await ctx.db
        .query('scraperDevelopmentRequests')
        .withIndex('by_status', (q) => q.eq('status', 'pending'))
        .first();
    }

    if (!pending) {
      return null; // No work available
    }

    // Claim it atomically
    await ctx.db.patch(pending._id, {
      status: 'in_progress',
      claudeSessionId: args.workerId,
      claudeSessionStartedAt: Date.now(),
    });

    return pending;
  },
});

/**
 * Update the generated scraper code (called by daemon after Claude Code writes it)
 */
export const updateScraperCode = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    scraperCode: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    await ctx.db.patch(args.requestId, {
      generatedScraperCode: args.scraperCode,
      scraperVersion: (request.scraperVersion || 0) + 1,
      status: 'testing',
    });

    return args.requestId;
  },
});

/**
 * Record test results
 * If test fails and under retry limit, automatically adds error as feedback and retries
 */
export const recordTestResults = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    sessionsFound: v.number(),
    sampleData: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    const maxRetries = request.maxTestRetries ?? 3;
    const currentRetries = request.testRetryCount ?? 0;

    if (args.error) {
      // Test failed
      if (currentRetries < maxRetries) {
        // Auto-retry: add error as feedback and go back to pending
        const feedbackHistory = request.feedbackHistory || [];
        feedbackHistory.push({
          feedbackAt: Date.now(),
          feedbackBy: 'auto-test',
          feedback: `Test failed with error: ${args.error}\n\nPlease fix the scraper to handle this error.`,
          scraperVersionBefore: request.scraperVersion || 0,
        });

        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: args.sessionsFound,
          lastTestSampleData: args.sampleData,
          lastTestError: args.error,
          testRetryCount: currentRetries + 1,
          feedbackHistory,
          status: 'pending', // Go back to pending for Claude to retry
        });
      } else {
        // Max retries reached, mark as failed
        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: args.sessionsFound,
          lastTestSampleData: args.sampleData,
          lastTestError: args.error,
          status: 'failed',
        });
      }
    } else if (args.sessionsFound === 0) {
      // Check if 0 sessions is expected/valid (seasonal catalog, site not yet published, etc.)
      let zeroIsExpected = false;
      if (args.sampleData) {
        try {
          const sampleParsed = JSON.parse(args.sampleData);
          if (sampleParsed.expectedEmpty === true) {
            zeroIsExpected = true;
          }
        } catch {
          // Not JSON, treat as regular 0-session failure
        }
      }

      if (zeroIsExpected) {
        // Valid 0 sessions - mark as completed (seasonal catalog, etc.)
        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: 0,
          lastTestSampleData: args.sampleData,
          lastTestError: undefined,
          status: 'completed',
        });
      } else if (currentRetries < maxRetries) {
        // Test passed but found no sessions - treat as failure
        const feedbackHistory = request.feedbackHistory || [];
        feedbackHistory.push({
          feedbackAt: Date.now(),
          feedbackBy: 'auto-test',
          feedback: `Test ran successfully but found 0 sessions. The page likely has camp data - please improve the extraction logic to find the sessions.`,
          scraperVersionBefore: request.scraperVersion || 0,
        });

        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: 0,
          lastTestSampleData: args.sampleData,
          testRetryCount: currentRetries + 1,
          feedbackHistory,
          status: 'pending',
        });
      } else {
        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: 0,
          lastTestSampleData: args.sampleData,
          status: 'failed',
        });
      }
    } else {
      // Test succeeded with sessions found - auto-approve and deploy!
      await ctx.db.patch(args.requestId, {
        lastTestRun: Date.now(),
        lastTestSessionsFound: args.sessionsFound,
        lastTestSampleData: args.sampleData,
        lastTestError: undefined,
        status: 'completed',
        completedAt: Date.now(),
        finalScraperCode: request.generatedScraperCode,
      });

      // Deploy the scraper code to a source
      if (request.generatedScraperCode) {
        let sourceId = request.sourceId;

        // If no sourceId, try to find existing source by URL
        if (!sourceId) {
          const existingSource = await ctx.db
            .query('scrapeSources')
            .withIndex('by_url', (q) => q.eq('url', request.sourceUrl))
            .first();

          if (existingSource) {
            sourceId = existingSource._id;
            // Link the request to this source for future reference
            await ctx.db.patch(args.requestId, { sourceId });
          }
        }

        // If still no source, create one
        if (!sourceId) {
          // Find or create organization based on domain
          const domain = new URL(request.sourceUrl).hostname.replace(/^www\./, '');
          const slug = domain.replace(/\./g, '-');

          let organization = await ctx.db
            .query('organizations')
            .withIndex('by_slug', (q) => q.eq('slug', slug))
            .first();

          if (!organization) {
            // Create a new organization
            const orgId = await ctx.db.insert('organizations', {
              name: request.sourceName,
              slug,
              website: `https://${domain}`,
              cityIds: [request.cityId],
              isActive: true,
              isVerified: false,
            });
            organization = await ctx.db.get(orgId);
          } else if (!organization.cityIds.includes(request.cityId)) {
            // Add this city to existing org
            await ctx.db.patch(organization._id, {
              cityIds: [...organization.cityIds, request.cityId],
            });
          }

          // Create the source
          sourceId = await ctx.db.insert('scrapeSources', {
            name: request.sourceName,
            url: request.sourceUrl,
            organizationId: organization!._id,
            cityId: request.cityId,
            scrapeFrequencyHours: 168, // Weekly
            scraperCode: request.generatedScraperCode,
            isActive: true,
            scraperHealth: {
              consecutiveFailures: 0,
              successRate: 0,
              totalRuns: 0,
              needsRegeneration: false,
            },
          });

          // Link the request to the new source
          await ctx.db.patch(args.requestId, { sourceId });
        } else {
          // Update existing source with new scraper code
          await ctx.db.patch(sourceId, {
            scraperCode: request.generatedScraperCode,
            isActive: true,
          });
        }

        // Create a scrape job to run the newly approved scraper
        await createJobWithWorkflow(ctx, sourceId, 'auto-approval');
      }
    }

    return args.requestId;
  },
});

/**
 * Submit feedback to improve the scraper
 */
export const submitFeedback = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    feedback: v.string(),
    feedbackBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    const feedbackHistory = request.feedbackHistory || [];
    feedbackHistory.push({
      feedbackAt: Date.now(),
      feedbackBy: args.feedbackBy,
      feedback: args.feedback,
      scraperVersionBefore: request.scraperVersion || 0,
    });

    await ctx.db.patch(args.requestId, {
      feedbackHistory,
      status: 'pending', // Go back to pending for Claude Code to pick up
    });

    return args.requestId;
  },
});

/**
 * Approve the scraper and mark as completed
 */
export const approveScraperCode = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (!request.generatedScraperCode) {
      throw new Error('No scraper code to approve');
    }

    await ctx.db.patch(args.requestId, {
      status: 'completed',
      completedAt: Date.now(),
      finalScraperCode: request.generatedScraperCode,
    });

    // If linked to a source, update the source's scraper code and trigger a scrape
    if (request.sourceId) {
      await ctx.db.patch(request.sourceId, {
        scraperCode: request.generatedScraperCode,
      });

      // Create a scrape job to run the newly approved scraper
      await createJobWithWorkflow(ctx, request.sourceId, 'scraper-approval');
    }

    return args.requestId;
  },
});

/**
 * Bulk approve all scrapers in needs_feedback status
 * This deploys them to their sources and kicks off scrape jobs
 */
export const bulkApproveNeedsFeedback = mutation({
  args: {
    limit: v.optional(v.number()),
    cityId: v.optional(v.id('cities')),
  },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_status', (q) => q.eq('status', 'needs_feedback'))
      .collect();
    const limit = args.limit || 100;

    const filtered = args.cityId ? requests.filter((r) => r.cityId === args.cityId) : requests;

    const toProcess = filtered.slice(0, limit);
    let approved = 0;
    let deployed = 0;

    for (const request of toProcess) {
      if (!request.generatedScraperCode) continue;

      // Mark as completed
      await ctx.db.patch(request._id, {
        status: 'completed',
        completedAt: Date.now(),
        finalScraperCode: request.generatedScraperCode,
      });
      approved++;

      // Deploy to source, activate it, and create scrape job
      if (request.sourceId) {
        await ctx.db.patch(request.sourceId, {
          scraperCode: request.generatedScraperCode,
          isActive: true,
        });

        await createJobWithWorkflow(ctx, request.sourceId, 'bulk-approval');
        deployed++;
      }
    }

    return {
      totalInNeedsFeedback: filtered.length,
      approved,
      deployed,
    };
  },
});

/**
 * Activate all sources that have scraper code but are inactive
 * Also creates scrape jobs to run them
 */
export const activateSourcesWithScrapers = mutation({
  args: {
    cityId: v.optional(v.id('cities')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sources = await ctx.db.query('scrapeSources').collect();
    const limit = args.limit || 100;

    // Filter to sources with scraper code that are inactive
    let toActivate = sources.filter((s) => (s.scraperCode || s.scraperModule) && !s.isActive);

    if (args.cityId) {
      toActivate = toActivate.filter((s) => s.cityId === args.cityId);
    }

    toActivate = toActivate.slice(0, limit);

    let activated = 0;
    let jobsCreated = 0;

    for (const source of toActivate) {
      await ctx.db.patch(source._id, {
        isActive: true,
      });
      activated++;

      // Create a scrape job
      const bulkJobId = await createJobWithWorkflow(ctx, source._id, 'bulk-activation');
      if (bulkJobId) jobsCreated++;
    }

    return {
      totalInactiveWithScrapers: sources.filter((s) => (s.scraperCode || s.scraperModule) && !s.isActive).length,
      activated,
      jobsCreated,
    };
  },
});

/**
 * Retroactively deploy scrapers from completed requests that weren't deployed
 * This fixes requests where sourceId was missing during original completion
 */
export const deployCompletedScrapers = mutation({
  args: {
    cityId: v.optional(v.id('cities')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Find requests with scraper code
    let requests = await ctx.db.query('scraperDevelopmentRequests').collect();

    // Filter to those with scraper code (either generated or final)
    requests = requests.filter((r) => r.generatedScraperCode || r.finalScraperCode);

    if (args.cityId) {
      requests = requests.filter((r) => r.cityId === args.cityId);
    }

    requests = requests.slice(0, limit);

    let deployed = 0;
    let skipped = 0;
    let jobsCreated = 0;
    const results: string[] = [];

    for (const request of requests) {
      const scraperCode = request.finalScraperCode || request.generatedScraperCode;
      if (!scraperCode) {
        skipped++;
        continue;
      }

      // Check if source already has this scraper deployed
      let source = request.sourceId ? await ctx.db.get(request.sourceId) : null;

      if (!source) {
        // Try to find source by URL
        source = await ctx.db
          .query('scrapeSources')
          .withIndex('by_url', (q) => q.eq('url', request.sourceUrl))
          .first();
      }

      if (source) {
        // Check if already has scraper code
        if (source.scraperCode && source.isActive) {
          skipped++;
          continue;
        }

        // Deploy scraper to existing source
        await ctx.db.patch(source._id, {
          scraperCode,
          isActive: true,
        });

        // Link request to source if not already linked
        if (!request.sourceId) {
          await ctx.db.patch(request._id, { sourceId: source._id });
        }

        // Create scrape job
        const retro1JobId = await createJobWithWorkflow(ctx, source._id, 'retroactive-deployment');

        deployed++;
        if (retro1JobId) jobsCreated++;
        results.push(`Deployed to existing source: ${source.name}`);
      } else {
        // Need to create source - find or create organization first
        const domain = new URL(request.sourceUrl).hostname.replace(/^www\./, '');
        const slug = domain.replace(/\./g, '-');

        let organization = await ctx.db
          .query('organizations')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .first();

        if (!organization) {
          const orgId = await ctx.db.insert('organizations', {
            name: request.sourceName,
            slug,
            website: `https://${domain}`,
            cityIds: [request.cityId],
            isActive: true,
            isVerified: false,
          });
          organization = await ctx.db.get(orgId);
        } else if (!organization.cityIds.includes(request.cityId)) {
          await ctx.db.patch(organization._id, {
            cityIds: [...organization.cityIds, request.cityId],
          });
        }

        // Create source
        const sourceId = await ctx.db.insert('scrapeSources', {
          name: request.sourceName,
          url: request.sourceUrl,
          organizationId: organization!._id,
          cityId: request.cityId,
          scrapeFrequencyHours: 168,
          scraperCode,
          isActive: true,
          scraperHealth: {
            consecutiveFailures: 0,
            successRate: 0,
            totalRuns: 0,
            needsRegeneration: false,
          },
        });

        // Link request to new source
        await ctx.db.patch(request._id, { sourceId });

        // Create scrape job
        const retro2JobId = await createJobWithWorkflow(ctx, sourceId, 'retroactive-deployment');

        deployed++;
        if (retro2JobId) jobsCreated++;
        results.push(`Created new source: ${request.sourceName}`);
      }
    }

    return {
      processed: requests.length,
      deployed,
      skipped,
      jobsCreated,
      results: results.slice(0, 20),
    };
  },
});

/**
 * Copy scraper code from development requests to their linked sources
 * and activate them. For sources created by market discovery.
 */
export const syncScrapersToSources = mutation({
  args: {
    cityId: v.id('cities'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    // Get all sources for this city
    const sources = await ctx.db
      .query('scrapeSources')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    // Get all development requests for this city that have scraper code
    const requests = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const requestsByUrl = new Map(
      requests.filter((r) => r.generatedScraperCode || r.finalScraperCode).map((r) => [r.sourceUrl, r]),
    );

    let synced = 0;
    let jobsCreated = 0;
    const results: string[] = [];

    for (const source of sources.slice(0, limit)) {
      // Skip if already has scraper code and is active
      if (source.scraperCode && source.isActive) {
        continue;
      }

      // Find matching request by URL
      const request = requestsByUrl.get(source.url);
      if (!request) {
        continue;
      }

      const scraperCode = request.finalScraperCode || request.generatedScraperCode;
      if (!scraperCode) {
        continue;
      }

      // Update source with scraper code and activate
      await ctx.db.patch(source._id, {
        scraperCode,
        isActive: true,
      });

      // Link request to source if not already linked
      if (!request.sourceId) {
        await ctx.db.patch(request._id, { sourceId: source._id });
      }

      // Create scrape job
      const syncJobId = await createJobWithWorkflow(ctx, source._id, 'scraper-sync');

      synced++;
      if (syncJobId) jobsCreated++;
      results.push(`Synced: ${source.name}`);
    }

    return {
      sourcesChecked: Math.min(sources.length, limit),
      requestsWithCode: requestsByUrl.size,
      synced,
      jobsCreated,
      results: results.slice(0, 20),
    };
  },
});

/**
 * Fix broken sourceId references and redeploy scrapers
 * For requests where sourceId points to non-existent source
 */
export const fixAndDeployBrokenRequests = mutation({
  args: {
    cityId: v.id('cities'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get requests with scraper code for this city
    const requests = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const withCode = requests.filter((r) => r.generatedScraperCode || r.finalScraperCode);

    let fixed = 0;
    let deployed = 0;
    let jobsCreated = 0;
    const results: string[] = [];

    for (const request of withCode.slice(0, limit)) {
      const scraperCode = request.finalScraperCode || request.generatedScraperCode;
      if (!scraperCode) continue;

      // Check if sourceId is valid
      let source = request.sourceId ? await ctx.db.get(request.sourceId) : null;

      if (!source) {
        // Clear invalid sourceId
        if (request.sourceId) {
          await ctx.db.patch(request._id, { sourceId: undefined });
          fixed++;
        }

        // Try to find source by URL
        source = await ctx.db
          .query('scrapeSources')
          .withIndex('by_url', (q) => q.eq('url', request.sourceUrl))
          .first();
      }

      // If still no source, create one
      if (!source) {
        const domain = new URL(request.sourceUrl).hostname.replace(/^www\./, '');
        const slug = domain.replace(/\./g, '-');

        // Find or create organization
        let org = await ctx.db
          .query('organizations')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .first();

        if (!org) {
          const orgId = await ctx.db.insert('organizations', {
            name: request.sourceName,
            slug,
            website: `https://${domain}`,
            cityIds: [request.cityId],
            isActive: true,
            isVerified: false,
          });
          org = await ctx.db.get(orgId);
        }

        // Create source with scraper code
        const sourceId = await ctx.db.insert('scrapeSources', {
          name: request.sourceName,
          url: request.sourceUrl,
          organizationId: org!._id,
          cityId: request.cityId,
          scrapeFrequencyHours: 168,
          scraperCode,
          isActive: true,
          scraperHealth: {
            consecutiveFailures: 0,
            successRate: 0,
            totalRuns: 0,
            needsRegeneration: false,
          },
        });

        // Link request to new source
        await ctx.db.patch(request._id, { sourceId });
        source = await ctx.db.get(sourceId);
        deployed++;
        results.push(`Created: ${request.sourceName}`);
      } else {
        // Update existing source if needed
        if (!source.scraperCode || !source.isActive) {
          await ctx.db.patch(source._id, {
            scraperCode,
            isActive: true,
          });
          deployed++;
          results.push(`Updated: ${source.name}`);
        } else {
          results.push(`Already active: ${source.name}`);
          continue; // Don't create another job
        }
      }

      // Create scrape job
      const fixJobId = await createJobWithWorkflow(ctx, source!._id, 'fix-and-deploy');
      if (fixJobId) jobsCreated++;
    }

    return {
      requestsWithCode: withCode.length,
      fixed,
      deployed,
      jobsCreated,
      results: results.slice(0, 30),
    };
  },
});

/**
 * Mark request as failed
 */
export const markFailed = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    await ctx.db.patch(args.requestId, {
      status: 'failed',
      lastTestError: args.reason || 'Marked as failed',
    });

    return args.requestId;
  },
});

/**
 * Mark a request as directory processed (completed without building a scraper)
 * Used when a URL is detected as a directory/listing site containing links to other camps
 */
export const markDirectoryProcessed = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    notes: v.string(),
    linksFound: v.number(),
    requestsCreated: v.number(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    await ctx.db.patch(args.requestId, {
      status: 'completed',
      completedAt: Date.now(),
      notes: args.notes,
      // Store metadata about the directory processing
      generatedScraperCode: `// DIRECTORY: This URL was detected as a listing/directory site.\n// ${args.linksFound} camp links were found.\n// ${args.requestsCreated} new scraper development requests were created.\n// No scraper was built for this directory.`,
    });

    return args.requestId;
  },
});

/**
 * Reset a request to pending (for retry)
 */
export const resetToPending = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    await ctx.db.patch(args.requestId, {
      status: 'pending',
      claudeSessionId: undefined,
      claudeSessionStartedAt: undefined,
    });

    return args.requestId;
  },
});

/**
 * Force restart a request - works on any status, resets retry count
 */
export const forceRestart = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    clearCode: v.optional(v.boolean()), // Also clear generated code
    clearFeedback: v.optional(v.boolean()), // Also clear feedback history
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    const updates: Record<string, unknown> = {
      status: 'pending',
      claudeSessionId: undefined,
      claudeSessionStartedAt: undefined,
      testRetryCount: 0,
      lastTestError: undefined,
    };

    if (args.clearCode) {
      updates.generatedScraperCode = undefined;
      updates.scraperVersion = 0;
      updates.lastTestRun = undefined;
      updates.lastTestSessionsFound = undefined;
      updates.lastTestSampleData = undefined;
    }

    if (args.clearFeedback) {
      updates.feedbackHistory = undefined;
    }

    await ctx.db.patch(args.requestId, updates);

    return args.requestId;
  },
});

/**
 * Save site exploration results
 * Called by daemon after exploring a site's navigation structure
 */
export const saveExploration = mutation({
  args: {
    requestId: v.id('scraperDevelopmentRequests'),
    exploration: v.object({
      siteType: v.optional(v.string()),
      hasMultipleLocations: v.optional(v.boolean()),
      locations: v.optional(
        v.array(
          v.object({
            name: v.string(),
            url: v.optional(v.string()),
            siteId: v.optional(v.string()),
          }),
        ),
      ),
      hasCategories: v.optional(v.boolean()),
      categories: v.optional(
        v.array(
          v.object({
            name: v.string(),
            id: v.optional(v.string()),
          }),
        ),
      ),
      registrationSystem: v.optional(v.string()),
      urlPatterns: v.optional(v.array(v.string())),
      navigationNotes: v.optional(v.array(v.string())),
      // API Discovery results
      discoveredApis: v.optional(
        v.array(
          v.object({
            url: v.string(),
            method: v.string(),
            contentType: v.string(),
            responseSize: v.number(),
            matchCount: v.number(),
            structureHint: v.optional(v.string()),
            urlPattern: v.optional(v.string()),
            sampleData: v.optional(v.string()),
          }),
        ),
      ),
      apiSearchTerm: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    await ctx.db.patch(args.requestId, {
      siteExploration: {
        exploredAt: Date.now(),
        ...args.exploration,
      },
    });

    return args.requestId;
  },
});

/**
 * Create scraper dev requests for all sources without scrapers in a city
 * This fills the gap where directory seeding creates sources but not dev requests
 */
export const createDevRequestsForOrphanedSources = mutation({
  args: {
    cityId: v.id('cities'),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const limit = args.limit ?? 100;

    // Get all sources for this city
    const sources = await ctx.db
      .query('scrapeSources')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    // Filter to sources without scrapers (include inactive - they need scrapers before activation)
    const orphanedSources = sources.filter((s) => !s.scraperModule && !s.scraperCode);

    // Get existing dev requests to avoid duplicates
    const existingRequests = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_city', (q) => q.eq('cityId', args.cityId))
      .collect();

    const existingSourceIds = new Set(existingRequests.filter((r) => r.sourceId).map((r) => r.sourceId));
    const existingUrls = new Set(existingRequests.map((r) => r.sourceUrl));

    // Find sources that need dev requests
    const needsDevRequest = orphanedSources.filter((s) => !existingSourceIds.has(s._id) && !existingUrls.has(s.url));

    const created: Array<{ name: string; url: string }> = [];

    for (const source of needsDevRequest.slice(0, limit)) {
      if (!dryRun) {
        await ctx.db.insert('scraperDevelopmentRequests', {
          sourceName: source.name,
          sourceUrl: source.url,
          cityId: args.cityId,
          sourceId: source._id,
          requestedBy: 'auto-orphan-fill',
          requestedAt: Date.now(),
          status: 'pending',
          scraperVersion: 0,
        });
      }
      created.push({ name: source.name, url: source.url });
    }

    return {
      dryRun,
      totalSources: sources.length,
      orphanedSources: orphanedSources.length,
      alreadyHaveRequests: orphanedSources.length - needsDevRequest.length,
      needDevRequests: needsDevRequest.length,
      created: created.length,
      createdList: created.slice(0, 20),
    };
  },
});

/**
 * Submit scraper feedback from Control Center
 * Creates or updates a development request for a source with feedback
 */
export const submitScraperFeedbackFromSource = mutation({
  args: {
    sourceId: v.id('scrapeSources'),
    feedback: v.string(),
    requestRescan: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error('Source not found');
    }

    // Check for existing development request for this source
    const existing = await ctx.db
      .query('scraperDevelopmentRequests')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .filter((q) =>
        q.or(
          q.eq(q.field('status'), 'pending'),
          q.eq(q.field('status'), 'in_progress'),
          q.eq(q.field('status'), 'testing'),
          q.eq(q.field('status'), 'needs_feedback'),
        ),
      )
      .first();

    if (existing) {
      // Add feedback to existing request
      const feedbackHistory = existing.feedbackHistory || [];
      feedbackHistory.push({
        feedbackAt: Date.now(),
        feedbackBy: 'control-center',
        feedback: args.feedback,
        scraperVersionBefore: existing.scraperVersion || 0,
      });

      await ctx.db.patch(existing._id, {
        feedbackHistory,
        status: 'pending', // Reset to pending so daemon picks it up
      });

      // Optionally flag source for rescan
      if (args.requestRescan) {
        await ctx.db.patch(args.sourceId, {
          needsRescan: true,
          rescanRequestedAt: Date.now(),
          rescanReason: args.feedback,
        });
      }

      return existing._id;
    }

    // Create new development request
    const requestId = await ctx.db.insert('scraperDevelopmentRequests', {
      sourceName: source.name,
      sourceUrl: source.url,
      cityId: source.cityId,
      sourceId: args.sourceId,
      notes: args.feedback,
      requestedBy: 'control-center',
      requestedAt: Date.now(),
      status: 'pending',
      scraperVersion: 0,
      feedbackHistory: [
        {
          feedbackAt: Date.now(),
          feedbackBy: 'control-center',
          feedback: args.feedback,
          scraperVersionBefore: 0,
        },
      ],
    });

    // Optionally flag source for rescan
    if (args.requestRescan) {
      await ctx.db.patch(args.sourceId, {
        needsRescan: true,
        rescanRequestedAt: Date.now(),
        rescanReason: args.feedback,
      });
    }

    return requestId;
  },
});
