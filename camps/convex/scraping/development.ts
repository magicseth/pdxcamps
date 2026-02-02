/**
 * Scraper Development
 *
 * Manages the queue of sites needing scraper development
 * and tracks Claude Code sessions working on them.
 */

import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Request scraper development for a new site
 */
export const requestScraperDevelopment = mutation({
  args: {
    sourceName: v.string(),
    sourceUrl: v.string(),
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
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      return ctx.db
        .query("scraperDevelopmentRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return ctx.db
      .query("scraperDevelopmentRequests")
      .order("desc")
      .take(limit);
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

    // If linked to a source, update the source's scraper code
    if (request.sourceId) {
      await ctx.db.patch(request.sourceId, {
        scraperCode: request.generatedScraperCode,
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
