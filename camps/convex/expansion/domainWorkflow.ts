/**
 * Domain Check Workflow with Rate Limiting
 *
 * Uses Convex workflows and rate limiter to check domain availability.
 * Porkbun allows 1 domain check per 10 seconds, enforced via rate limiter.
 */

import { WorkflowManager } from '@convex-dev/workflow';
import { RateLimiter, SECOND } from '@convex-dev/rate-limiter';
import { components, internal } from '../_generated/api';
import { v } from 'convex/values';
import { mutation, internalMutation, internalAction, query } from '../_generated/server';

// Create workflow manager
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 1, // Only 1 domain check workflow at a time
  },
});

// Create rate limiter for Porkbun API
// 1 request per 10 seconds (we use 11 to be safe)
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  porkbunDomainCheck: {
    kind: 'fixed window',
    rate: 1,
    period: 11 * SECOND,
  },
});

// Result type for domain checks
const domainResultValidator = v.object({
  domain: v.string(),
  available: v.boolean(),
  price: v.optional(v.string()),
  error: v.optional(v.string()),
});

/**
 * Define the domain checking workflow
 */
export const checkDomainsWorkflow = workflow.define({
  args: {
    marketKey: v.string(),
    domains: v.array(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    results: v.array(domainResultValidator),
  }),
  handler: async (
    step,
    args,
  ): Promise<{
    success: boolean;
    results: Array<{
      domain: string;
      available: boolean;
      price?: string;
      error?: string;
    }>;
  }> => {
    const results: Array<{
      domain: string;
      available: boolean;
      price?: string;
      error?: string;
    }> = [];

    for (let i = 0; i < args.domains.length; i++) {
      const domain = args.domains[i];

      // Consume rate limit token (will throw and retry if rate limited)
      await step.runMutation(internal.expansion.domainWorkflow.consumeRateLimit, {});

      // Check this domain
      const result = await step.runAction(
        internal.expansion.domainWorkflow.checkSingleDomain,
        { domain },
        { retry: true },
      );

      results.push(result);

      // Save intermediate result so UI can show progress
      await step.runMutation(internal.expansion.domainWorkflow.saveDomainResult, {
        marketKey: args.marketKey,
        domain: result.domain,
        available: result.available,
        price: result.price,
        error: result.error,
        index: i,
        total: args.domains.length,
      });
    }

    // Mark workflow complete
    await step.runMutation(internal.expansion.domainWorkflow.markWorkflowComplete, {
      marketKey: args.marketKey,
      results,
    });

    return {
      success: true,
      results,
    };
  },
});

/**
 * Consume a rate limit token - throws if rate limited, workflow will retry
 */
export const consumeRateLimit = internalMutation({
  args: {},
  handler: async (ctx) => {
    const status = await rateLimiter.limit(ctx, 'porkbunDomainCheck', {
      throws: false,
    });
    if (!status.ok) {
      // Throw a regular error so workflow retries with backoff
      throw new Error(`Rate limited, retry after ${status.retryAfter}ms`);
    }
    return { ok: true };
  },
});

/**
 * Internal action to check a single domain
 */
export const checkSingleDomain = internalAction({
  args: { domain: v.string() },
  returns: domainResultValidator,
  handler: async (
    _,
    args,
  ): Promise<{
    domain: string;
    available: boolean;
    price?: string;
    error?: string;
  }> => {
    const apiKey = process.env.PORKBUN_API_KEY;
    const secretKey = process.env.PORKBUN_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return {
        domain: args.domain,
        available: false,
        error: 'Porkbun API credentials not configured',
      };
    }

    try {
      const response = await fetch(`https://api.porkbun.com/api/json/v3/domain/checkDomain/${args.domain}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          secretapikey: secretKey,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'ERROR') {
        return {
          domain: args.domain,
          available: false,
          error: data.message || `API error: ${response.status}`,
        };
      }

      const isAvailable = data.status === 'SUCCESS' && data.response?.avail === 'yes';
      return {
        domain: args.domain,
        available: isAvailable,
        price: data.response?.price,
      };
    } catch (error) {
      return {
        domain: args.domain,
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Save a domain check result (called during workflow for progress updates)
 */
export const saveDomainResult = internalMutation({
  args: {
    marketKey: v.string(),
    domain: v.string(),
    available: v.boolean(),
    price: v.optional(v.string()),
    error: v.optional(v.string()),
    index: v.number(),
    total: v.number(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query('expansionMarkets')
      .withIndex('by_market_key', (q) => q.eq('marketKey', args.marketKey))
      .unique();

    if (!market) return;

    // Update progress timestamp so UI knows we're still working
    await ctx.db.patch(market._id, {
      updatedAt: Date.now(),
    });

    console.log(
      `Domain check progress: ${args.index + 1}/${args.total} - ${args.domain}: ${args.available ? 'available' : 'taken'}`,
    );
  },
});

/**
 * Mark workflow as complete and store final results
 */
export const markWorkflowComplete = internalMutation({
  args: {
    marketKey: v.string(),
    results: v.array(domainResultValidator),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query('expansionMarkets')
      .withIndex('by_market_key', (q) => q.eq('marketKey', args.marketKey))
      .unique();

    if (market) {
      await ctx.db.patch(market._id, {
        updatedAt: Date.now(),
      });
    }

    console.log(`Domain check complete for ${args.marketKey}:`, args.results);
  },
});

/**
 * Start a domain check workflow - returns workflow ID for status tracking
 */
export const startDomainCheck = mutation({
  args: {
    marketKey: v.string(),
    domains: v.array(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Initialize market if not exists
    const existing = await ctx.db
      .query('expansionMarkets')
      .withIndex('by_market_key', (q) => q.eq('marketKey', args.marketKey))
      .unique();

    if (!existing) {
      // Auto-initialize the market
      const { getExpansionMarketByKey } = await import('../../lib/expansionMarkets');
      const marketData = getExpansionMarketByKey(args.marketKey);
      if (!marketData) {
        throw new Error(`Unknown market key: ${args.marketKey}`);
      }

      await ctx.db.insert('expansionMarkets', {
        marketKey: args.marketKey,
        tier: marketData.tier,
        domainPurchased: false,
        dnsConfigured: false,
        status: 'not_started',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Start the workflow
    const workflowId = await workflow.start(ctx, internal.expansion.domainWorkflow.checkDomainsWorkflow, {
      marketKey: args.marketKey,
      domains: args.domains,
    });

    return workflowId as string;
  },
});

/**
 * Get workflow status and results
 */
export const getDomainCheckStatus = query({
  args: { workflowId: v.string() },
  handler: async (ctx, args) => {
    // Cast string to WorkflowId type
    const status = await workflow.status(ctx, args.workflowId as unknown as Parameters<typeof workflow.status>[1]);
    return status;
  },
});
