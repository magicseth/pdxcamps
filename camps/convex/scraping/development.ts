/**
 * Scraper Development
 *
 * Manages the queue of sites needing scraper development
 * and tracks Claude Code sessions working on them.
 */

import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflow } from "./scrapeWorkflow";

/**
 * Request scraper development for a new site
 */
export const requestScraperDevelopment = mutation({
  args: {
    sourceName: v.string(),
    sourceUrl: v.string(),
    cityId: v.id("cities"), // Required: market this request is for
    sourceId: v.optional(v.id("scrapeSources")),
    notes: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing pending request for same URL
    const existing = await ctx.db
      .query("scraperDevelopmentRequests")
      .filter((q) =>
        q.and(
          q.eq(q.field("sourceUrl"), args.sourceUrl),
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "in_progress")
          )
        )
      )
      .first();

    if (existing) {
      throw new Error("A scraper development request already exists for this URL");
    }

    return ctx.db.insert("scraperDevelopmentRequests", {
      sourceName: args.sourceName,
      sourceUrl: args.sourceUrl,
      cityId: args.cityId,
      sourceId: args.sourceId,
      notes: args.notes,
      requestedBy: args.requestedBy,
      requestedAt: Date.now(),
      status: "pending",
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
      .query("scraperDevelopmentRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
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
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("testing"),
        v.literal("needs_feedback"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    cityId: v.optional(v.id("cities")), // Filter by city/market
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const order = args.sortOrder ?? "asc"; // Default to oldest first

    let requests;

    // Use index for filtering when possible
    if (args.cityId) {
      // Filter by city using the index
      requests = await ctx.db
        .query("scraperDevelopmentRequests")
        .withIndex("by_city", (q) => q.eq("cityId", args.cityId!))
        .order(order)
        .take(limit * 2);

      // Post-filter by status if needed
      if (args.status) {
        requests = requests.filter(r => r.status === args.status);
      }
    } else if (args.status) {
      requests = await ctx.db
        .query("scraperDevelopmentRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order(order)
        .take(limit);
    } else {
      requests = await ctx.db
        .query("scraperDevelopmentRequests")
        .order(order)
        .take(limit);
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
      })
    );

    return enrichedRequests.slice(0, limit);
  },
});

/**
 * Get a specific request by ID
 */
export const getRequest = query({
  args: {
    requestId: v.id("scraperDevelopmentRequests"),
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
    requestId: v.id("scraperDevelopmentRequests"),
    claudeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error(`Request is not pending (status: ${request.status})`);
    }

    await ctx.db.patch(args.requestId, {
      status: "in_progress",
      claudeSessionId: args.claudeSessionId,
      claudeSessionStartedAt: Date.now(),
    });

    return args.requestId;
  },
});

/**
 * Atomically get next pending request AND claim it
 * Safe for parallel workers - only one worker will get each request
 */
export const getNextAndClaim = mutation({
  args: {
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the first pending request
    const pending = await ctx.db
      .query("scraperDevelopmentRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();

    if (!pending) {
      return null; // No work available
    }

    // Claim it atomically
    await ctx.db.patch(pending._id, {
      status: "in_progress",
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
    requestId: v.id("scraperDevelopmentRequests"),
    scraperCode: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await ctx.db.patch(args.requestId, {
      generatedScraperCode: args.scraperCode,
      scraperVersion: (request.scraperVersion || 0) + 1,
      status: "testing",
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
    requestId: v.id("scraperDevelopmentRequests"),
    sessionsFound: v.number(),
    sampleData: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
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
          feedbackBy: "auto-test",
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
          status: "pending", // Go back to pending for Claude to retry
        });
      } else {
        // Max retries reached, mark as failed
        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: args.sessionsFound,
          lastTestSampleData: args.sampleData,
          lastTestError: args.error,
          status: "failed",
        });
      }
    } else if (args.sessionsFound === 0) {
      // Test passed but found no sessions - treat as failure
      if (currentRetries < maxRetries) {
        const feedbackHistory = request.feedbackHistory || [];
        feedbackHistory.push({
          feedbackAt: Date.now(),
          feedbackBy: "auto-test",
          feedback: `Test ran successfully but found 0 sessions. The page likely has camp data - please improve the extraction logic to find the sessions.`,
          scraperVersionBefore: request.scraperVersion || 0,
        });

        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: 0,
          lastTestSampleData: args.sampleData,
          testRetryCount: currentRetries + 1,
          feedbackHistory,
          status: "pending",
        });
      } else {
        await ctx.db.patch(args.requestId, {
          lastTestRun: Date.now(),
          lastTestSessionsFound: 0,
          lastTestSampleData: args.sampleData,
          status: "failed",
        });
      }
    } else {
      // Test succeeded with sessions found
      await ctx.db.patch(args.requestId, {
        lastTestRun: Date.now(),
        lastTestSessionsFound: args.sessionsFound,
        lastTestSampleData: args.sampleData,
        lastTestError: undefined,
        status: "needs_feedback",
      });
    }

    return args.requestId;
  },
});

/**
 * Submit feedback to improve the scraper
 */
export const submitFeedback = mutation({
  args: {
    requestId: v.id("scraperDevelopmentRequests"),
    feedback: v.string(),
    feedbackBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
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
      status: "pending", // Go back to pending for Claude Code to pick up
    });

    return args.requestId;
  },
});

/**
 * Approve the scraper and mark as completed
 */
export const approveScraperCode = mutation({
  args: {
    requestId: v.id("scraperDevelopmentRequests"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    if (!request.generatedScraperCode) {
      throw new Error("No scraper code to approve");
    }

    await ctx.db.patch(args.requestId, {
      status: "completed",
      completedAt: Date.now(),
      finalScraperCode: request.generatedScraperCode,
    });

    // If linked to a source, update the source's scraper code and trigger a scrape
    if (request.sourceId) {
      await ctx.db.patch(request.sourceId, {
        scraperCode: request.generatedScraperCode,
      });

      // Create a scrape job to run the newly approved scraper
      const jobId = await ctx.db.insert("scrapeJobs", {
        sourceId: request.sourceId,
        status: "pending",
        triggeredBy: "scraper-approval",
        retryCount: 0,
      });

      // Start the scraping workflow
      const workflowId = await workflow.start(
        ctx,
        internal.scraping.scrapeWorkflow.scrapeSourceWorkflow,
        {
          jobId,
          sourceId: request.sourceId,
        }
      );

      await ctx.db.patch(jobId, {
        workflowId: workflowId as string,
      });
    }

    return args.requestId;
  },
});

/**
 * Mark request as failed
 */
export const markFailed = mutation({
  args: {
    requestId: v.id("scraperDevelopmentRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await ctx.db.patch(args.requestId, {
      status: "failed",
      lastTestError: args.reason || "Marked as failed",
    });

    return args.requestId;
  },
});

/**
 * Reset a request to pending (for retry)
 */
export const resetToPending = mutation({
  args: {
    requestId: v.id("scraperDevelopmentRequests"),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await ctx.db.patch(args.requestId, {
      status: "pending",
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
    requestId: v.id("scraperDevelopmentRequests"),
    clearCode: v.optional(v.boolean()), // Also clear generated code
    clearFeedback: v.optional(v.boolean()), // Also clear feedback history
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    const updates: Record<string, unknown> = {
      status: "pending",
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
    requestId: v.id("scraperDevelopmentRequests"),
    exploration: v.object({
      siteType: v.optional(v.string()),
      hasMultipleLocations: v.optional(v.boolean()),
      locations: v.optional(
        v.array(
          v.object({
            name: v.string(),
            url: v.optional(v.string()),
            siteId: v.optional(v.string()),
          })
        )
      ),
      hasCategories: v.optional(v.boolean()),
      categories: v.optional(
        v.array(
          v.object({
            name: v.string(),
            id: v.optional(v.string()),
          })
        )
      ),
      registrationSystem: v.optional(v.string()),
      urlPatterns: v.optional(v.array(v.string())),
      navigationNotes: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
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
 * Submit scraper feedback from Control Center
 * Creates or updates a development request for a source with feedback
 */
export const submitScraperFeedbackFromSource = mutation({
  args: {
    sourceId: v.id("scrapeSources"),
    feedback: v.string(),
    requestRescan: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error("Source not found");
    }

    // Check for existing development request for this source
    const existing = await ctx.db
      .query("scraperDevelopmentRequests")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "testing"),
          q.eq(q.field("status"), "needs_feedback")
        )
      )
      .first();

    if (existing) {
      // Add feedback to existing request
      const feedbackHistory = existing.feedbackHistory || [];
      feedbackHistory.push({
        feedbackAt: Date.now(),
        feedbackBy: "control-center",
        feedback: args.feedback,
        scraperVersionBefore: existing.scraperVersion || 0,
      });

      await ctx.db.patch(existing._id, {
        feedbackHistory,
        status: "pending", // Reset to pending so daemon picks it up
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
    const requestId = await ctx.db.insert("scraperDevelopmentRequests", {
      sourceName: source.name,
      sourceUrl: source.url,
      cityId: source.cityId,
      sourceId: args.sourceId,
      notes: args.feedback,
      requestedBy: "control-center",
      requestedAt: Date.now(),
      status: "pending",
      scraperVersion: 0,
      feedbackHistory: [
        {
          feedbackAt: Date.now(),
          feedbackBy: "control-center",
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
