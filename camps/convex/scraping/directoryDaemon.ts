/**
 * Directory Seeding Daemon - Queries & Mutations
 *
 * Automatically processes queued directory URLs to discover and seed
 * camp organizations for a market.
 *
 * Flow:
 * 1. Add directory URLs to queue via queueDirectoryUrls mutation
 * 2. Daemon processes queue items (processDirectoryQueue action in directoryDaemonActions.ts)
 * 3. For each URL: scrape → extract links → create orgs → create sources
 */

import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// ============================================
// MUTATIONS - Queue Management
// ============================================

/**
 * Add directory URLs to the processing queue
 */
export const queueDirectoryUrls = mutation({
  args: {
    citySlug: v.string(),
    urls: v.array(v.string()),
    linkPattern: v.optional(v.string()),
    baseUrlFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get city
    const city = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.citySlug))
      .first();

    if (!city) {
      throw new Error(`City not found: ${args.citySlug}`);
    }

    const queuedIds: Id<"directoryQueue">[] = [];

    for (const url of args.urls) {
      // Skip if already in queue
      const existing = await ctx.db
        .query("directoryQueue")
        .filter((q) => q.eq(q.field("url"), url))
        .first();

      if (existing) {
        continue;
      }

      const id = await ctx.db.insert("directoryQueue", {
        cityId: city._id,
        url,
        status: "pending",
        linkPattern: args.linkPattern,
        baseUrlFilter: args.baseUrlFilter,
      });
      queuedIds.push(id);
    }

    return { queued: queuedIds.length, cityId: city._id };
  },
});

/**
 * Get pending items from the queue
 */
export const getPendingDirectories = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("directoryQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(args.limit ?? 5);
  },
});

/**
 * Get queue status
 */
export const getQueueStatus = query({
  args: { citySlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let items = await ctx.db.query("directoryQueue").collect();

    if (args.citySlug) {
      const citySlug = args.citySlug;
      const city = await ctx.db
        .query("cities")
        .withIndex("by_slug", (q) => q.eq("slug", citySlug))
        .first();
      if (city) {
        items = items.filter((i) => i.cityId === city._id);
      }
    }

    const pending = items.filter((i) => i.status === "pending").length;
    const processing = items.filter((i) => i.status === "processing").length;
    const completed = items.filter((i) => i.status === "completed").length;
    const failed = items.filter((i) => i.status === "failed").length;

    return { total: items.length, pending, processing, completed, failed, items };
  },
});

// Internal mutation to update queue item status
export const updateQueueItem = internalMutation({
  args: {
    id: v.id("directoryQueue"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    linksFound: v.optional(v.number()),
    orgsCreated: v.optional(v.number()),
    orgsExisted: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      processedAt: Date.now(),
    });
  },
});

// Action to process directory queue is in directoryDaemonActions.ts
// Call api.scraping.directoryDaemonActions.processDirectoryQueue

/**
 * Directly seed camp URLs (no scraping needed)
 * Use this when you have a list of camp organization URLs
 */
export const seedCampUrls = mutation({
  args: {
    citySlug: v.string(),
    urls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Get city
    const city = await ctx.db
      .query("cities")
      .withIndex("by_slug", (q) => q.eq("slug", args.citySlug))
      .first();

    if (!city) {
      throw new Error(`City not found: ${args.citySlug}`);
    }

    let created = 0;
    let existed = 0;
    const results: Array<{ url: string; name: string; status: string }> = [];

    for (const url of args.urls) {
      try {
        // Parse domain and generate name
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, "");
        const name = domain
          .replace(/\.(com|org|edu|net|gov|co|io)$/i, "")
          .split(/[.-]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        // Check if org already exists by domain
        const existingOrgs = await ctx.db.query("organizations").collect();
        const existingOrg = existingOrgs.find((o) => {
          if (!o.website) return false;
          try {
            const orgDomain = new URL(o.website).hostname.replace(/^www\./, "");
            return orgDomain === domain;
          } catch {
            return false;
          }
        });

        if (existingOrg) {
          existed++;
          results.push({ url, name, status: "existed" });
          continue;
        }

        // Create organization
        const orgId = await ctx.db.insert("organizations", {
          name,
          slug: domain.replace(/\./g, "-"),
          website: url,
          cityIds: [city._id],
          isActive: true,
          isVerified: false,
        });

        // Create scrape source
        await ctx.db.insert("scrapeSources", {
          organizationId: orgId,
          cityId: city._id,
          name,
          url,
          scrapeFrequencyHours: 168, // weekly
          isActive: false, // needs scraper development first
          scraperHealth: {
            consecutiveFailures: 0,
            totalRuns: 0,
            successRate: 0,
            needsRegeneration: false,
          },
        });

        created++;
        results.push({ url, name, status: "created" });
      } catch (err) {
        results.push({
          url,
          name: "Error",
          status: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    return { created, existed, total: args.urls.length, results };
  },
});
